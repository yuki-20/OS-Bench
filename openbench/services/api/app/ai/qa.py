"""Step Q&A pipeline."""
from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import call_json
from app.ai.prompts import QA_SYSTEM
from app.core.config import settings
from app.models.document import Document
from app.models.protocol import ProtocolStep, ProtocolVersion
from app.services.retrieval import render_context, search_chunks


async def answer_step_question(
    session: AsyncSession,
    *,
    protocol_version_id: str,
    step_id: Optional[str],
    question: str,
    context_mode: str = "current_step_only",
) -> Dict[str, Any]:
    pv = (
        await session.execute(select(ProtocolVersion).where(ProtocolVersion.id == protocol_version_id))
    ).scalar_one()
    document_ids: Sequence[str] = list(pv.source_doc_ids or [])

    step = None
    if step_id:
        step = (await session.execute(select(ProtocolStep).where(ProtocolStep.id == step_id))).scalar_one_or_none()

    chunks = await search_chunks(session, question, document_ids=document_ids, limit=8)
    context = render_context(chunks)

    docs = (
        (await session.execute(select(Document).where(Document.id.in_(document_ids))))
        .scalars()
        .all()
    )
    doc_index = "\n".join(f"- {d.id}: {d.document_type} \"{d.title}\"" for d in docs)

    step_block = ""
    if step is not None and context_mode != "full_protocol":
        step_block = (
            f"CURRENT STEP {step.step_key}: {step.title}\n"
            f"Instruction: {step.instruction}\n"
            f"Required PPE: {', '.join(step.required_ppe_json or [])}\n"
            f"Engineering controls: {', '.join(step.controls_json or [])}\n"
            f"Stop conditions: {', '.join(step.stop_conditions_json or [])}\n"
        )
    user = (
        f"DOCUMENT INDEX:\n{doc_index}\n\n"
        f"{step_block}\n"
        f"APPROVED CONTEXT (from documents):\n{context}\n\n"
        f"OPERATOR QUESTION: {question}\n\n"
        "Answer per the system contract. JSON ONLY."
    )
    result = await asyncio.to_thread(
        call_json,
        system=QA_SYSTEM,
        messages=[{"role": "user", "content": user}],
        model=settings.anthropic_fast_model,
        temperature=0.1,
        max_tokens=64000,
    )
    valid_doc_ids = {d.id for d in docs}
    citations = []
    for c in result.get("citations") or []:
        if c.get("document_id") in valid_doc_ids:
            citations.append(
                {
                    "document_id": c.get("document_id"),
                    "page_no": c.get("page_no"),
                    "section_label": c.get("section_label"),
                    "chunk_id": c.get("chunk_id"),
                    "quote_summary": c.get("quote_summary") or "",
                }
            )
    return {
        "answer_text": (result.get("answer_text") or "").strip(),
        "citations": citations,
        "confidence": result.get("confidence") or "medium",
        "escalation_required": bool(result.get("escalation_required")),
        "suggested_action": result.get("suggested_action"),
    }
