"""Visual checkpoint engine."""
from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import call_json, with_image
from app.ai.prompts import VISION_SYSTEM
from app.core.config import settings
from app.models.protocol import ProtocolStep
from app.services.retrieval import render_context, search_chunks


async def assess_photo(
    session: AsyncSession,
    *,
    protocol_step_id: str,
    image_bytes: bytes,
    image_mime: str,
    document_ids: List[str],
) -> Dict[str, Any]:
    step = (
        await session.execute(select(ProtocolStep).where(ProtocolStep.id == protocol_step_id))
    ).scalar_one()
    visual_checks = step.visual_checks_json or []
    if not visual_checks:
        return {
            "overall_status": "ok",
            "items": [],
            "recommended_action": "No visual checklist for this step.",
        }
    # Retrieve a small support context that explains why each check matters.
    query = " ".join(v.get("claim", "") for v in visual_checks)
    chunks = await search_chunks(session, query, document_ids=document_ids, limit=4)
    context = render_context(chunks)

    checklist_text = "\n".join(
        f"- {v.get('check_id')}: {v.get('claim')} "
        f"(required={v.get('required', True)})  rationale: {v.get('rationale','')}"
        for v in visual_checks
    )
    prompt = (
        f"STEP {step.step_key}: {step.title}\n"
        f"INSTRUCTION: {step.instruction}\n\n"
        f"VISUAL CHECKLIST:\n{checklist_text}\n\n"
        f"SUPPORTING SOURCE SNIPPETS:\n{context}\n\n"
        "Assess the supplied photo strictly per the system contract. JSON ONLY."
    )
    messages = with_image(text_prompt=prompt, image_bytes=image_bytes, image_mime=image_mime)
    result = await asyncio.to_thread(
        call_json,
        system=VISION_SYSTEM,
        messages=messages,
        model=settings.anthropic_vision_model,
        temperature=0.0,
        max_tokens=64000,
    )

    valid_ids = {v.get("check_id") for v in visual_checks}
    items = []
    for it in result.get("items") or []:
        if it.get("check_id") in valid_ids:
            items.append(
                {
                    "check_id": it["check_id"],
                    "status": it.get("status") or "cannot_verify",
                    "evidence": it.get("evidence") or "",
                    "confidence": it.get("confidence") or "medium",
                }
            )
    if not items:
        # If model failed to align ids, build "cannot_verify" responses
        items = [
            {
                "check_id": v.get("check_id"),
                "status": "cannot_verify",
                "evidence": "Model did not return a clear assessment for this item.",
                "confidence": "low",
            }
            for v in visual_checks
        ]
    overall = result.get("overall_status") or "attention_required"
    if overall not in ("ok", "attention_required", "stop"):
        overall = "attention_required"
    # Re-derive overall if a critical 'not_visible' is present
    crit = {v.get("check_id") for v in visual_checks if v.get("required", True)}
    if any(it["status"] in ("not_visible", "unclear") and it["check_id"] in crit for it in items) and overall == "ok":
        overall = "attention_required"
    return {
        "overall_status": overall,
        "items": items,
        "recommended_action": (result.get("recommended_action") or "")[:480],
    }
