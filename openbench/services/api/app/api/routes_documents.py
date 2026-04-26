from __future__ import annotations

import asyncio
import hashlib
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentContext, current_context
from app.core.config import settings
from app.core.ids import doc_id
from app.db.session import get_db
from app.models.document import Document, DocumentChunk
from app.models.protocol import Protocol, ProtocolVersion
from app.schemas.documents import (
    DocumentChunkOut,
    DocumentDetail,
    DocumentFinalizeRequest,
    DocumentOut,
    DocumentUploadInit,
    DocumentUploadResponse,
)
from app.services import storage
from app.services.audit import record_audit
from app.services.chunking import chunk_pages
from app.services.classifier import classify_text, detect_title
from app.services.embedding import embed_text
from app.services.ocr import ocr_pdf_pages, tesseract_available
from app.services.parsing import extract_text
from app.services.uploads import (
    DOCUMENT_MIME_TYPES,
    ensure_allowed_mime,
    ensure_document_object_size,
    infer_mime_type,
    read_upload_limited,
    safe_filename,
    validate_document_bytes,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _doc_storage_key(org_id: str, doc: str, filename: str) -> str:
    safe = safe_filename(filename, fallback="document")
    return f"orgs/{org_id}/documents/{doc}/{safe}"


def _is_low_text_extraction(text: str, chunks: list[object], page_count: int) -> bool:
    normalized = " ".join((text or "").split())
    return page_count > 0 and (len(normalized) < 80 or not chunks)


def _normalize_doc_type(value: str | None) -> str:
    doc_type = value or "unknown"
    if doc_type not in {"sop", "sds", "manual", "policy", "unknown"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unsupported document type")
    return doc_type


@router.post("/upload", response_model=DocumentUploadResponse)
async def init_upload(
    payload: DocumentUploadInit,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentUploadResponse:
    ctx.require_min("reviewer")
    mime_type = ensure_allowed_mime(infer_mime_type(payload.mime_type, payload.filename), DOCUMENT_MIME_TYPES)
    storage.ensure_bucket()
    new_doc = Document(
        id=doc_id(),
        org_id=ctx.org_id,
        document_type=_normalize_doc_type(payload.suggested_type),
        title=safe_filename(payload.filename, fallback="document"),
        declared_version=payload.declared_version,
        storage_path="",
        mime_type=mime_type,
        created_by=ctx.user_id,
    )
    new_doc.storage_path = _doc_storage_key(ctx.org_id, new_doc.id, payload.filename)
    session.add(new_doc)
    await session.commit()
    url = storage.presigned_put_url(new_doc.storage_path, content_type=mime_type)
    return DocumentUploadResponse(
        document_id=new_doc.id,
        upload_url=url,
        storage_path=new_doc.storage_path,
    )


@router.post("/{document_id}/finalize", response_model=DocumentDetail)
async def finalize_upload(
    document_id: str,
    payload: DocumentFinalizeRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentDetail:
    ctx.require_min("reviewer")
    doc = (
        await session.execute(select(Document).where(Document.id == document_id, Document.org_id == ctx.org_id))
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")

    head = storage.head_object(doc.storage_path)
    ensure_document_object_size(head.get("ContentLength") if head else None)
    raw = storage.get_bytes(doc.storage_path)
    validate_document_bytes(raw, doc.mime_type)
    if payload.checksum is None:
        doc.checksum = hashlib.sha256(raw).hexdigest()
    else:
        doc.checksum = payload.checksum

    text, page_count, pages = extract_text(raw, doc.mime_type)
    ocr_used = False
    # Sparse-text PDFs trigger an OCR pass with Tesseract.
    if doc.mime_type == "application/pdf":
        try:
            preview_chunks = chunk_pages(pages)
            if _is_low_text_extraction(text, preview_chunks, page_count) and tesseract_available():
                # Tesseract OCR is CPU-bound + spawns a subprocess per page;
                # offload it so a 20-page scanned PDF doesn't block the event
                # loop and stall every other inflight request.
                ocr_text, ocr_pc, ocr_pages = await asyncio.to_thread(ocr_pdf_pages, raw)
                if ocr_text.strip():
                    text, page_count, pages = ocr_text, ocr_pc or page_count, ocr_pages or pages
                    ocr_used = True
        except Exception:  # OCR is best-effort; fall through with original text
            pass
    doc.extracted_text = text
    doc.page_count = page_count
    inferred_type = classify_text(text)
    if doc.document_type in ("unknown", None):
        doc.document_type = inferred_type
    if not doc.title or doc.title == doc.storage_path.split("/")[-1]:
        doc.title = detect_title(text) or doc.title

    # Chunk + index
    res = await session.execute(select(DocumentChunk).where(DocumentChunk.document_id == doc.id))
    for c in res.scalars().all():
        await session.delete(c)
    chunks = chunk_pages(pages)
    for i, ch in enumerate(chunks):
        session.add(
            DocumentChunk(
                document_id=doc.id,
                chunk_index=i,
                page_no=ch.page_no,
                section_label=ch.section_label,
                chunk_text=ch.text,
                citation_json={
                    "document_id": doc.id,
                    "page_no": ch.page_no,
                    "section_label": ch.section_label,
                },
                embedding=embed_text(ch.text),
            )
        )
    if _is_low_text_extraction(text, chunks, page_count):
        doc.parse_status = "needs_ocr"
        doc.parse_metadata = {
            "page_count": page_count,
            "chunks": len(chunks),
            "inferred_type": inferred_type,
            "ocr_attempted": ocr_used,
            "warnings": [
                "Text extraction produced little or no readable text even after OCR." if ocr_used
                else "Text extraction produced little or no readable text. OCR or a higher-quality source is required.",
            ],
        }
    else:
        doc.parse_status = "ready"
        doc.parse_metadata = {
            "page_count": page_count,
            "chunks": len(chunks),
            "inferred_type": inferred_type,
            "ocr_used": ocr_used,
            "warnings": [],
        }
    doc.ocr_status = "applied" if ocr_used else doc.ocr_status

    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="document.finalize",
        target_type="document",
        target_id=doc.id,
        summary=f"Finalized {doc.title} ({doc.document_type}, {len(chunks)} chunks{', OCR' if ocr_used else ''})",
    )
    await session.commit()
    return DocumentDetail(
        **DocumentOut.model_validate(doc).model_dump(),
        extracted_text_preview=(doc.extracted_text or "")[:1500],
        chunk_count=len(chunks),
    )


@router.post("/upload-direct", response_model=DocumentDetail)
async def upload_direct(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    suggested_type: str | None = Form(default=None),
    declared_version: str | None = Form(default=None),
) -> DocumentDetail:
    """Convenience path: upload + finalize in one request (used by Console UI)."""
    ctx.require_min("reviewer")
    raw = await read_upload_limited(file, max_bytes=settings.max_document_upload_bytes)
    mime_type = ensure_allowed_mime(infer_mime_type(file.content_type, file.filename), DOCUMENT_MIME_TYPES)
    validate_document_bytes(raw, mime_type)
    storage.ensure_bucket()
    new_doc = Document(
        id=doc_id(),
        org_id=ctx.org_id,
        document_type=_normalize_doc_type(suggested_type),
        title=safe_filename(file.filename, fallback="document"),
        declared_version=declared_version,
        storage_path="",
        mime_type=mime_type,
        created_by=ctx.user_id,
    )
    new_doc.storage_path = _doc_storage_key(ctx.org_id, new_doc.id, new_doc.title)
    storage.put_bytes(new_doc.storage_path, raw, new_doc.mime_type)
    new_doc.checksum = hashlib.sha256(raw).hexdigest()
    text, page_count, pages = extract_text(raw, new_doc.mime_type)
    ocr_used = False
    if new_doc.mime_type == "application/pdf":
        try:
            preview_chunks = chunk_pages(pages)
            if _is_low_text_extraction(text, preview_chunks, page_count) and tesseract_available():
                # Tesseract OCR is CPU-bound + spawns a subprocess per page;
                # offload it so a 20-page scanned PDF doesn't block the event
                # loop and stall every other inflight request.
                ocr_text, ocr_pc, ocr_pages = await asyncio.to_thread(ocr_pdf_pages, raw)
                if ocr_text.strip():
                    text, page_count, pages = ocr_text, ocr_pc or page_count, ocr_pages or pages
                    ocr_used = True
        except Exception:
            pass
    new_doc.extracted_text = text
    new_doc.page_count = page_count
    inferred_type = classify_text(text)
    if new_doc.document_type == "unknown":
        new_doc.document_type = inferred_type
    if (not new_doc.title) or len(new_doc.title) < 4:
        new_doc.title = detect_title(text) or new_doc.title
    if ocr_used:
        new_doc.ocr_status = "applied"
    session.add(new_doc)
    await session.flush()

    chunks = chunk_pages(pages)
    for i, ch in enumerate(chunks):
        session.add(
            DocumentChunk(
                document_id=new_doc.id,
                chunk_index=i,
                page_no=ch.page_no,
                section_label=ch.section_label,
                chunk_text=ch.text,
                citation_json={
                    "document_id": new_doc.id,
                    "page_no": ch.page_no,
                    "section_label": ch.section_label,
                },
                embedding=embed_text(ch.text),
            )
        )
    if _is_low_text_extraction(text, chunks, page_count):
        new_doc.parse_status = "needs_ocr"
        new_doc.parse_metadata = {
            "page_count": page_count,
            "chunks": len(chunks),
            "inferred_type": inferred_type,
            "warnings": [
                "Text extraction produced little or no readable text. OCR or a higher-quality source is required."
            ],
        }
    else:
        new_doc.parse_status = "ready"
        new_doc.parse_metadata = {
            "page_count": page_count,
            "chunks": len(chunks),
            "inferred_type": inferred_type,
            "warnings": [],
        }

    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="document.upload_direct",
        target_type="document",
        target_id=new_doc.id,
        summary=f"Uploaded {new_doc.title}",
    )
    await session.commit()
    return DocumentDetail(
        **DocumentOut.model_validate(new_doc).model_dump(),
        extracted_text_preview=(new_doc.extracted_text or "")[:1500],
        chunk_count=len(chunks),
    )


@router.get("", response_model=List[DocumentOut])
async def list_documents(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> List[DocumentOut]:
    if ctx.has_min("reviewer"):
        res = await session.execute(
            select(Document).where(Document.org_id == ctx.org_id).order_by(Document.created_at.desc())
        )
        return [DocumentOut.model_validate(d) for d in res.scalars().all()]
    allowed_ids = await _operator_visible_document_ids(session, ctx.org_id)
    if not allowed_ids:
        return []
    res = await session.execute(
        select(Document)
        .where(Document.org_id == ctx.org_id, Document.id.in_(allowed_ids))
        .order_by(Document.created_at.desc())
    )
    return [DocumentOut.model_validate(d) for d in res.scalars().all()]


@router.get("/{document_id}", response_model=DocumentDetail)
async def get_document(
    document_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentDetail:
    doc = await _get_visible_document(session, document_id, ctx)
    chunks_res = await session.execute(
        select(DocumentChunk).where(DocumentChunk.document_id == doc.id)
    )
    chunk_count = len(chunks_res.scalars().all())
    return DocumentDetail(
        **DocumentOut.model_validate(doc).model_dump(),
        extracted_text_preview=(doc.extracted_text or "")[:1500],
        chunk_count=chunk_count,
    )


@router.get("/{document_id}/chunks", response_model=List[DocumentChunkOut])
async def list_chunks(
    document_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> List[DocumentChunkOut]:
    doc = await _get_visible_document(session, document_id, ctx)
    res = await session.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == doc.id)
        .order_by(DocumentChunk.chunk_index)
    )
    return [DocumentChunkOut.model_validate(c) for c in res.scalars().all()]


@router.get("/{document_id}/download-url")
async def download_url(
    document_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    doc = await _get_visible_document(session, document_id, ctx)
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="document.download_url",
        target_type="document",
        target_id=doc.id,
        summary=f"Issued document download URL for {doc.title}",
    )
    await session.commit()
    return {"url": storage.presigned_get_url(doc.storage_path)}


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    ctx.require_min("reviewer")
    doc = (
        await session.execute(select(Document).where(Document.id == document_id, Document.org_id == ctx.org_id))
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    try:
        storage.delete_object(doc.storage_path)
    except Exception:
        pass
    await session.delete(doc)
    await session.commit()
    return {"status": "deleted"}


async def _operator_visible_document_ids(session: AsyncSession, org_id: str) -> set[str]:
    """Operators only see documents that are bound to a *published* protocol version."""
    res = await session.execute(
        select(ProtocolVersion)
        .join(Protocol, ProtocolVersion.protocol_id == Protocol.id)
        .where(Protocol.org_id == org_id, ProtocolVersion.status == "published")
    )
    visible: set[str] = set()
    for version in res.scalars().all():
        visible.update(str(doc_id) for doc_id in (version.source_doc_ids or []))
    return visible


async def _get_visible_document(
    session: AsyncSession, document_id: str, ctx: CurrentContext
) -> Document:
    doc = (
        await session.execute(
            select(Document).where(Document.id == document_id, Document.org_id == ctx.org_id)
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    if ctx.has_min("reviewer"):
        return doc
    visible_ids = await _operator_visible_document_ids(session, ctx.org_id)
    if document_id not in visible_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return doc
