"""Render sample-data Markdown files to PDFs and seed them as Documents.

Idempotent: if a document with the same checksum already exists in the org, skip.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ids import doc_id
from app.core.logging import logger
from app.models.document import Document, DocumentChunk
from app.models.organization import Organization
from app.services import storage
from app.services.chunking import chunk_pages
from app.services.classifier import classify_text, detect_title
from app.services.embedding import embed_text
from app.services.parsing import extract_text
from app.services.pdf import render_pdf

SAMPLE_DIR = Path("/app/sample_data")


@dataclass
class Sample:
    filename_md: str
    title: str
    document_type: str
    declared_version: str | None = None


SAMPLES: List[Sample] = [
    Sample("sop.md", "Sample Prep SOP", "sop", "v1.3"),
    Sample("sds.md", "SDS — Reagent A", "sds", "v2.1"),
    Sample("equipment_manual.md", "BP-1000 Pipette Manual", "manual", None),
]


async def seed_sample_documents(session: AsyncSession, org: Organization) -> None:
    if not SAMPLE_DIR.exists():
        logger.info("sample_data dir not found, skipping document seed: {}", SAMPLE_DIR)
        return
    for sample in SAMPLES:
        md_path = SAMPLE_DIR / sample.filename_md
        if not md_path.exists():
            logger.warning("Sample missing: {}", md_path)
            continue
        md_text = md_path.read_text(encoding="utf-8")
        try:
            pdf_bytes = render_pdf(md_text)
        except Exception as e:  # noqa: BLE001
            logger.error("PDF render failed for {}: {}", sample.filename_md, e)
            continue
        checksum = hashlib.sha256(pdf_bytes).hexdigest()

        existing = (
            await session.execute(
                select(Document).where(
                    Document.org_id == org.id,
                    Document.checksum == checksum,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            logger.info("Sample doc already seeded: {}", sample.title)
            continue

        new_doc = Document(
            id=doc_id(),
            org_id=org.id,
            document_type=sample.document_type,
            title=sample.title,
            declared_version=sample.declared_version,
            storage_path="",
            mime_type="application/pdf",
            checksum=checksum,
        )
        new_doc.storage_path = f"orgs/{org.id}/documents/{new_doc.id}/{sample.filename_md.replace('.md','.pdf')}"
        try:
            storage.put_bytes(new_doc.storage_path, pdf_bytes, "application/pdf")
        except Exception as e:  # noqa: BLE001
            logger.error("Storage upload failed for {}: {}", sample.filename_md, e)
            continue

        text, page_count, pages = extract_text(pdf_bytes, "application/pdf")
        new_doc.extracted_text = text
        new_doc.page_count = page_count
        if not new_doc.title:
            new_doc.title = detect_title(text) or sample.title
        if new_doc.document_type == "unknown":
            new_doc.document_type = classify_text(text)
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
        new_doc.parse_status = "ready"
        new_doc.parse_metadata = {"page_count": page_count, "chunks": len(chunks), "seeded": True}
        logger.info(
            "Seeded sample document: {} ({} pages, {} chunks)",
            sample.title,
            page_count,
            len(chunks),
        )
