"""AI Trace recording service.

PRD v3 Section 6.3: every important AI output gets an operational trace
(task type, model used, sources, schema, citation coverage, confidence,
safety result, whether output changed run state, whether human review required).
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Iterable, Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_trace import AITrace


def _coverage(citations: Optional[Iterable[Any]], min_required: int = 1) -> float:
    if not citations:
        return 0.0
    seen = sum(1 for c in citations if (c or {}).get("document_id"))
    if seen == 0:
        return 0.0
    return min(1.0, seen / max(min_required, 1))


async def record_trace(
    session: AsyncSession,
    *,
    org_id: str,
    task_type: str,
    model: str,
    output_json: dict[str, Any],
    output_schema: str,
    run_id: Optional[str] = None,
    protocol_version_id: Optional[str] = None,
    step_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    input_summary: str = "",
    source_document_ids: Optional[Sequence[str]] = None,
    source_chunk_ids: Optional[Sequence[str]] = None,
    citations: Optional[Iterable[dict[str, Any]]] = None,
    confidence: str = "medium",
    safety_review: Optional[dict[str, Any]] = None,
    changed_run_state: bool = False,
    requires_human_review: bool = False,
    latency_ms: int = 0,
    token_input: int = 0,
    token_output: int = 0,
    error: Optional[str] = None,
    min_citations_for_coverage: int = 1,
) -> AITrace:
    """Persist a single AI Trace row. Always commits via the caller's transaction."""
    citation_list = list(citations or [])
    coverage = _coverage(citation_list, min_required=min_citations_for_coverage)
    trace = AITrace(
        org_id=org_id,
        run_id=run_id,
        protocol_version_id=protocol_version_id,
        step_id=step_id,
        task_type=task_type,
        model=model,
        input_summary=(input_summary or "")[:1500],
        source_document_ids=list(source_document_ids or []),
        source_chunk_ids=list(source_chunk_ids or []),
        output_schema=output_schema,
        output_json=_safe_json(output_json),
        citation_count=len(citation_list),
        citation_coverage=coverage,
        confidence=confidence or "medium",
        safety_review_json=safety_review or {},
        changed_run_state=changed_run_state,
        requires_human_review=requires_human_review,
        latency_ms=latency_ms,
        token_input=token_input,
        token_output=token_output,
        error=error,
        actor_id=actor_id,
    )
    session.add(trace)
    await session.flush()
    return trace


def _safe_json(value: Any) -> dict[str, Any]:
    """Coerce a value into a JSON-serialisable dict, capping size."""
    try:
        s = json.dumps(value, default=str)
    except Exception:
        s = json.dumps({"_unserializable": str(value)[:500]})
    if len(s) > 200_000:
        s = s[:200_000]
    try:
        return json.loads(s)
    except Exception:
        return {"_truncated": True}


__all__ = ["record_trace"]
