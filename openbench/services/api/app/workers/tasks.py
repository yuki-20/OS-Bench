"""Async Celery tasks: heavy parsing, compilation, photo assessment, report generation.

The synchronous API routes already handle these inline for the demo, but they can be
offloaded to workers in production simply by enqueueing these tasks.
"""
from __future__ import annotations

import asyncio
from typing import Any

from app.workers.celery_app import celery


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery.task(name="openbench.parse_document")
def parse_document(document_id: str) -> dict[str, Any]:
    """Re-parse a document (used when the upload happened via signed URL)."""
    from sqlalchemy import select

    from app.db.session import session_scope
    from app.models.document import Document, DocumentChunk
    from app.services import storage
    from app.services.chunking import chunk_pages
    from app.services.classifier import classify_text, detect_title
    from app.services.parsing import extract_text

    async def inner() -> dict[str, Any]:
        async with session_scope() as session:
            doc = (
                await session.execute(select(Document).where(Document.id == document_id))
            ).scalar_one()
            raw = storage.get_bytes(doc.storage_path)
            text, page_count, pages = extract_text(raw, doc.mime_type)
            doc.extracted_text = text
            doc.page_count = page_count
            if doc.document_type == "unknown":
                doc.document_type = classify_text(text)
            if not doc.title or len(doc.title) < 4:
                doc.title = detect_title(text) or doc.title

            res = await session.execute(
                select(DocumentChunk).where(DocumentChunk.document_id == doc.id)
            )
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
                    )
                )
            doc.parse_status = "ready"
            doc.parse_metadata = {"page_count": page_count, "chunks": len(chunks)}
            return {"document_id": document_id, "chunks": len(chunks), "page_count": page_count}

    return _run(inner())


@celery.task(name="openbench.compile_protocol")
def compile_protocol_task(version_id: str) -> dict[str, Any]:
    return {"version_id": version_id, "status": "noop"}


@celery.task(name="openbench.purge_retention")
def purge_retention_task(org_id: str | None = None) -> dict[str, Any]:
    """Apply each org's retention_policy_days: delete completed/cancelled runs
    older than the cutoff plus their attachments + assessments + handovers +
    AI traces. Open runs are never auto-purged. Returns per-org counts.

    Pass org_id to run for a single org; otherwise iterates over all orgs.
    """
    from app.services.retention import purge_org_retention
    from app.db.session import session_scope
    from app.models.organization import Organization
    from sqlalchemy import select

    async def inner() -> dict[str, Any]:
        results: dict[str, Any] = {}
        async with session_scope() as session:
            if org_id:
                orgs = (
                    await session.execute(select(Organization).where(Organization.id == org_id))
                ).scalars().all()
            else:
                orgs = (await session.execute(select(Organization))).scalars().all()
            for org in orgs:
                summary = await purge_org_retention(session, org)
                results[org.id] = summary
        return {"orgs": results}

    return _run(inner())


@celery.task(name="openbench.generate_handover")
def generate_handover_task(run_id: str) -> dict[str, Any]:
    from app.ai.report import generate_report, render_markdown
    from app.db.session import session_scope
    from app.models.handover import HandoverReport
    from sqlalchemy import select
    from datetime import datetime
    from app.services.pdf import markdown_to_html

    async def inner() -> dict[str, Any]:
        async with session_scope() as session:
            report_json = await generate_report(session, run_id)
            md = render_markdown(report_json)
            html = markdown_to_html(md)
            existing = (
                await session.execute(
                    select(HandoverReport).where(HandoverReport.run_id == run_id)
                )
            ).scalar_one_or_none()
            if existing is None:
                existing = HandoverReport(run_id=run_id)
                session.add(existing)
            existing.report_json = report_json
            existing.markdown_body = md
            existing.html_body = html
            existing.generated_at = datetime.utcnow()
        return {"run_id": run_id}

    return _run(inner())
