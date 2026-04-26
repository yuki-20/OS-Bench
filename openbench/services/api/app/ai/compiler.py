"""Protocol compiler — turns approved documents into a structured protocol graph."""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any, Dict, List, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import call_json
from app.ai.prompts import HAZARD_MAPPER_SYSTEM, PROTOCOL_COMPILER_SYSTEM
from app.core.config import settings
from app.core.logging import logger
from app.models.document import Document, DocumentChunk
from sqlalchemy import select


@dataclass
class DocBundle:
    document_id: str
    document_type: str
    title: str
    text: str
    chunks: List[DocumentChunk]


async def gather_documents(session: AsyncSession, document_ids: Sequence[str]) -> List[DocBundle]:
    stmt = select(Document).where(Document.id.in_(list(document_ids)))
    docs = (await session.execute(stmt)).scalars().all()
    bundles: List[DocBundle] = []
    for d in docs:
        chunks = (
            (
                await session.execute(
                    select(DocumentChunk)
                    .where(DocumentChunk.document_id == d.id)
                    .order_by(DocumentChunk.chunk_index)
                )
            )
            .scalars()
            .all()
        )
        bundles.append(
            DocBundle(
                document_id=d.id,
                document_type=d.document_type,
                title=d.title or d.document_type.upper(),
                text=d.extracted_text,
                chunks=chunks,
            )
        )
    return bundles


def _format_doc_block(b: DocBundle, max_chars: int = 14000) -> str:
    parts = [f"=== DOCUMENT id={b.document_id} type={b.document_type} title={b.title!r} ==="]
    if b.chunks:
        for c in b.chunks:
            head = f"[chunk={c.id} page={c.page_no or '-'} section={c.section_label or '-'}]"
            parts.append(f"{head}\n{c.chunk_text}")
    else:
        parts.append(b.text)
    text = "\n\n".join(parts)
    if len(text) > max_chars:
        text = text[:max_chars] + "\n... [truncated]"
    return text


async def compile_protocol(
    session: AsyncSession, document_ids: Sequence[str], suggested_name: str | None = None
) -> Dict[str, Any]:
    bundles = await gather_documents(session, document_ids)
    if not bundles:
        return {
            "name": suggested_name or "Untitled Protocol",
            "summary": "No source documents provided.",
            "steps": [],
        }
    sop_bundles = [b for b in bundles if b.document_type == "sop"]
    if not sop_bundles:
        sop_bundles = bundles
    primary_block = "\n\n".join(_format_doc_block(b, max_chars=18000) for b in sop_bundles)
    other_blocks = "\n\n".join(
        _format_doc_block(b, max_chars=8000) for b in bundles if b not in sop_bundles
    )
    user_text = (
        f"PRIMARY SOURCE (SOP):\n{primary_block}\n\n"
        + (f"SUPPORTING DOCUMENTS:\n{other_blocks}\n\n" if other_blocks else "")
        + "Compile the executable protocol graph as specified. Return JSON ONLY."
    )
    if suggested_name:
        user_text = f"Suggested protocol name: {suggested_name}\n\n" + user_text

    logger.info("Compile protocol: documents={}", [b.document_id for b in bundles])
    # Opus 4.7 max output. Input context up to 1M is handled automatically by
    # the model — no client-side cap.
    result = await asyncio.to_thread(
        call_json,
        system=PROTOCOL_COMPILER_SYSTEM,
        messages=[{"role": "user", "content": user_text}],
        model=settings.anthropic_model,
        max_tokens=64000,
        temperature=0.1,
    )
    return _post_process(result, bundles)


def _post_process(result: Dict[str, Any], bundles: List[DocBundle]) -> Dict[str, Any]:
    valid_doc_ids = {b.document_id for b in bundles}
    valid_chunk_ids = {c.id for b in bundles for c in b.chunks}
    steps_in = result.get("steps") or []
    cleaned: List[Dict[str, Any]] = []
    used_keys: set[str] = set()
    for idx, s in enumerate(steps_in, start=1):
        key = s.get("step_key") or f"S{idx}"
        if key in used_keys:
            key = f"S{idx}"
        used_keys.add(key)
        refs = []
        for r in s.get("source_refs") or []:
            doc_id = r.get("document_id")
            if doc_id in valid_doc_ids:
                refs.append(
                    {
                        "document_id": doc_id,
                        "page_no": r.get("page_no"),
                        "section_label": r.get("section_label"),
                        "chunk_id": r.get("chunk_id") if r.get("chunk_id") in valid_chunk_ids else None,
                        "quote_summary": r.get("quote_summary") or "",
                    }
                )
        confidence = s.get("confidence") or "medium"
        confidence_score = {"low": 0.4, "medium": 0.7, "high": 0.9}.get(confidence, 0.6)
        cleaned.append(
            {
                "step_key": key,
                "title": (s.get("title") or "Untitled step").strip()[:380],
                "instruction": (s.get("instruction") or "").strip(),
                "is_skippable": bool(s.get("is_skippable")),
                "prerequisites": [str(p) for p in (s.get("prerequisites") or []) if p],
                "required_ppe": [str(p) for p in (s.get("required_ppe") or []) if p],
                "controls": [str(p) for p in (s.get("controls") or []) if p],
                "materials": [str(p) for p in (s.get("materials") or []) if p],
                "equipment": [str(p) for p in (s.get("equipment") or []) if p],
                "timers": [
                    {
                        "label": t.get("label") or "",
                        "duration_seconds": int(t.get("duration_seconds") or 0),
                        "auto_start": bool(t.get("auto_start")),
                    }
                    for t in (s.get("timers") or [])
                    if t.get("duration_seconds")
                ],
                "visual_checks": [
                    {
                        "check_id": v.get("check_id") or f"V{i+1}",
                        "claim": v.get("claim") or "",
                        "required": bool(v.get("required", True)),
                        "rationale": v.get("rationale") or "",
                    }
                    for i, v in enumerate(s.get("visual_checks") or [])
                ],
                "stop_conditions": [str(p) for p in (s.get("stop_conditions") or []) if p],
                "expected_observations": [
                    str(p) for p in (s.get("expected_observations") or []) if p
                ],
                "data_capture": [
                    {
                        "key": d.get("key") or f"field_{i}",
                        "label": d.get("label") or d.get("key") or "",
                        "kind": d.get("kind") or "text",
                        "units": d.get("units"),
                        "options": d.get("options"),
                        "required": bool(d.get("required")),
                    }
                    for i, d in enumerate(s.get("data_capture") or [])
                ],
                "source_refs": refs,
                "confidence": confidence,
                "confidence_score": confidence_score,
            }
        )
    return {
        "name": (result.get("name") or "Untitled Protocol").strip(),
        "summary": (result.get("summary") or "").strip(),
        "steps": cleaned,
    }


async def compile_hazards(
    session: AsyncSession, document_ids: Sequence[str], step_keys: Sequence[str]
) -> Dict[str, Any]:
    bundles = await gather_documents(session, document_ids)
    safety_bundles = [b for b in bundles if b.document_type in ("sds", "policy", "manual")]
    if not safety_bundles:
        safety_bundles = bundles
    docblocks = "\n\n".join(_format_doc_block(b, max_chars=12000) for b in safety_bundles)
    step_list = ", ".join(step_keys)
    user = (
        f"SAFETY DOCUMENTS:\n{docblocks}\n\n"
        f"PROTOCOL STEP KEYS: {step_list}\n\n"
        "Produce the hazard map JSON as specified."
    )
    result = await asyncio.to_thread(
        call_json,
        system=HAZARD_MAPPER_SYSTEM,
        messages=[{"role": "user", "content": user}],
        model=settings.anthropic_model,
        max_tokens=64000,
        temperature=0.1,
    )
    valid_doc_ids = {b.document_id for b in bundles}
    rules = []
    for r in result.get("hazard_rules") or []:
        refs = [
            {
                "document_id": x.get("document_id"),
                "page_no": x.get("page_no"),
                "section_label": x.get("section_label"),
                "chunk_id": x.get("chunk_id"),
                "quote_summary": x.get("quote_summary") or "",
            }
            for x in (r.get("source_refs") or [])
            if x.get("document_id") in valid_doc_ids
        ]
        rules.append(
            {
                "category": r.get("category") or "general",
                "step_keys": [str(k) for k in (r.get("step_keys") or [])],
                "requirement_text": (r.get("requirement_text") or "").strip(),
                "severity": r.get("severity") or "standard",
                "source_refs": refs,
            }
        )
    return {
        "hazard_rules": rules,
        "missing_coverage": [str(x) for x in (result.get("missing_coverage") or [])],
    }
