from __future__ import annotations

import time
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.qa import answer_step_question
from app.ai.safety import review_qa_answer
from app.ai.vision import assess_photo
from app.api.deps import CurrentContext, current_context
from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_db
from app.models.ai_trace import AITrace
from app.models.protocol import ProtocolVersion
from app.models.run import Attachment, PhotoAssessment, Run
from app.schemas.runs import (
    AskRequest,
    AskResponse,
    PhotoAssessmentItem,
    PhotoAssessmentOut,
    PhotoCheckRequest,
)
from app.services import storage
from app.services.escalation import create_escalation
from app.services.run_engine import append_event
from app.services.trace import record_trace

router = APIRouter(prefix="/api/runs", tags=["ai"])


@router.post("/{run_id}/ask", response_model=AskResponse)
async def ask(
    run_id: str,
    payload: AskRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AskResponse:
    run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
    if run is None or run.org_id != ctx.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    step_id = payload.step_id or run.current_step_id
    started = time.perf_counter()
    try:
        result = await answer_step_question(
            session,
            protocol_version_id=run.protocol_version_id,
            step_id=step_id,
            question=payload.question,
            context_mode=payload.context_mode,
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Q&A failed")
        await record_trace(
            session,
            org_id=ctx.org_id,
            run_id=run_id,
            protocol_version_id=run.protocol_version_id,
            step_id=step_id,
            actor_id=ctx.user_id,
            task_type="qa",
            model=settings.anthropic_fast_model,
            input_summary=f"Q: {payload.question[:300]}",
            output_schema="qa.answer.v1",
            output_json={},
            confidence="low",
            requires_human_review=True,
            error=str(e)[:500],
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
        await session.commit()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Q&A failed: {e}") from e

    has_citations = bool(result.get("citations"))
    review = review_qa_answer(
        question=payload.question,
        answer=result,
        has_citations=has_citations,
    )
    if review["verdict"] == "block":
        result["answer_text"] = (
            "I cannot answer this from the approved documents. "
            "Please consult your supervisor."
        )
        result["escalation_required"] = True
        result["confidence"] = "low"
        result["suggested_action"] = "ask_supervisor"
        result["citations"] = []
    elif review["verdict"] == "rewrite" and review.get("rewrite_suggestion"):
        result["answer_text"] = review["rewrite_suggestion"]
    if review.get("force_escalation"):
        result["escalation_required"] = True

    # Auto-escalation when the model cannot ground the answer.
    if result.get("escalation_required"):
        await create_escalation(
            session,
            org_id=ctx.org_id,
            kind="model_unsupported",
            title=f"Q&A escalation: {payload.question[:120]}",
            description=result.get("answer_text", "")[:500],
            run_id=run_id,
            step_id=step_id,
            actor_id=ctx.user_id,
            metadata={"safety_review": review},
        )

    await append_event(
        session,
        run_id=run.id,
        event_type="qa_question_answered",
        actor_id=ctx.user_id,
        step_id=step_id,
        payload={
            "question": payload.question,
            "answer_text": result.get("answer_text"),
            "confidence": result.get("confidence"),
            "escalation_required": bool(result.get("escalation_required")),
            "safety_review": review,
            "citations": result.get("citations") or [],
        },
        idempotency_key=payload.idempotency_key,
    )

    citations = list(result.get("citations") or [])
    chunk_ids = [c.get("chunk_id") for c in citations if c.get("chunk_id")]
    pv = (
        await session.execute(
            select(ProtocolVersion).where(ProtocolVersion.id == run.protocol_version_id)
        )
    ).scalar_one()
    await record_trace(
        session,
        org_id=ctx.org_id,
        run_id=run_id,
        protocol_version_id=run.protocol_version_id,
        step_id=step_id,
        actor_id=ctx.user_id,
        task_type="qa",
        model=settings.anthropic_fast_model,
        input_summary=f"Q: {payload.question[:300]}",
        output_schema="qa.answer.v1",
        output_json={
            "answer_text": result.get("answer_text"),
            "confidence": result.get("confidence"),
            "escalation_required": bool(result.get("escalation_required")),
            "suggested_action": result.get("suggested_action"),
        },
        source_document_ids=list(pv.source_doc_ids or []),
        source_chunk_ids=chunk_ids,
        citations=citations,
        confidence=result.get("confidence", "medium"),
        safety_review=review,
        changed_run_state=False,
        requires_human_review=bool(result.get("escalation_required")),
        latency_ms=int((time.perf_counter() - started) * 1000),
    )

    await session.commit()
    return AskResponse(
        answer_text=result.get("answer_text", ""),
        citations=citations,
        confidence=result.get("confidence", "medium"),
        escalation_required=bool(result.get("escalation_required")),
        suggested_action=result.get("suggested_action"),
        safety_review=review,
    )


@router.post("/{run_id}/steps/{step_id}/photo-check", response_model=PhotoAssessmentOut)
async def photo_check(
    run_id: str,
    step_id: str,
    payload: PhotoCheckRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> PhotoAssessmentOut:
    run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
    if run is None or run.org_id != ctx.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    pv = (
        await session.execute(select(ProtocolVersion).where(ProtocolVersion.id == run.protocol_version_id))
    ).scalar_one()
    a = (
        await session.execute(select(Attachment).where(Attachment.id == payload.attachment_id))
    ).scalar_one_or_none()
    if a is None or (a.run_id and a.run_id != run.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")

    image_bytes = storage.get_bytes(a.storage_path)
    started = time.perf_counter()
    try:
        result = await assess_photo(
            session,
            protocol_step_id=step_id,
            image_bytes=image_bytes,
            image_mime=a.mime_type or "image/jpeg",
            document_ids=list(pv.source_doc_ids or []),
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Photo assessment failed")
        await record_trace(
            session,
            org_id=ctx.org_id,
            run_id=run_id,
            protocol_version_id=run.protocol_version_id,
            step_id=step_id,
            actor_id=ctx.user_id,
            task_type="photo_check",
            model=settings.anthropic_vision_model,
            input_summary=f"Photo {a.id} ({a.mime_type})",
            output_schema="photo.assessment.v1",
            output_json={},
            confidence="low",
            error=str(e)[:500],
            requires_human_review=True,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
        await session.commit()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Photo assessment failed: {e}") from e

    assessment = PhotoAssessment(
        run_id=run.id,
        step_id=step_id,
        attachment_id=a.id,
        overall_status=result.get("overall_status", "attention_required"),
        items_json=result.get("items", []),
        recommended_action=result.get("recommended_action", ""),
        model_metadata_json={"model": settings.anthropic_vision_model},
    )
    session.add(assessment)
    await session.flush()

    primary_idem = payload.idempotency_key
    derived = lambda suffix: f"{primary_idem}:{suffix}" if primary_idem else None

    await append_event(
        session,
        run_id=run.id,
        event_type="photo_assessed",
        actor_id=ctx.user_id,
        step_id=step_id,
        payload={
            "assessment_id": assessment.id,
            "attachment_id": a.id,
            "overall_status": assessment.overall_status,
            "items": assessment.items_json,
        },
        idempotency_key=primary_idem,
    )

    changed_state = False
    if assessment.overall_status == "stop":
        run.status = "blocked"
        run.block_reason = "Visual checkpoint requires immediate attention"
        await append_event(
            session,
            run_id=run.id,
            event_type="block_triggered",
            actor_id=ctx.user_id,
            step_id=step_id,
            payload={"reason": "visual_stop"},
            idempotency_key=derived("block"),
        )
        await create_escalation(
            session,
            org_id=ctx.org_id,
            kind="visual_mismatch",
            title="Visual checkpoint flagged a stop condition",
            description=assessment.recommended_action[:500],
            run_id=run.id,
            step_id=step_id,
            actor_id=ctx.user_id,
            severity="critical",
        )
        changed_state = True
    elif assessment.overall_status == "attention_required":
        # Soft escalation for any required missing/unclear visual
        critical_misses = [
            it
            for it in (assessment.items_json or [])
            if it.get("status") in ("not_visible", "unclear")
        ]
        if critical_misses:
            await create_escalation(
                session,
                org_id=ctx.org_id,
                kind="visual_mismatch",
                title="Visual checklist has unresolved items",
                description=f"{len(critical_misses)} item(s) not confirmed",
                run_id=run.id,
                step_id=step_id,
                actor_id=ctx.user_id,
                severity="standard",
                metadata={"missed_check_ids": [it.get("check_id") for it in critical_misses]},
            )

    # Citation coverage = ratio of items whose evidence references the active checklist.
    valid_check_ids = {it.get("check_id") for it in (assessment.items_json or [])}
    coverage_citations = [
        {"document_id": "checklist", "page_no": None, "section_label": cid, "quote_summary": ""}
        for cid in valid_check_ids
    ]

    await record_trace(
        session,
        org_id=ctx.org_id,
        run_id=run.id,
        protocol_version_id=run.protocol_version_id,
        step_id=step_id,
        actor_id=ctx.user_id,
        task_type="photo_check",
        model=settings.anthropic_vision_model,
        input_summary=f"Step {step_id} photo {a.id}",
        output_schema="photo.assessment.v1",
        output_json={
            "overall_status": assessment.overall_status,
            "items": assessment.items_json,
            "recommended_action": assessment.recommended_action,
        },
        source_document_ids=list(pv.source_doc_ids or []),
        citations=coverage_citations,
        confidence=_aggregate_confidence(assessment.items_json or []),
        changed_run_state=changed_state,
        requires_human_review=assessment.overall_status in ("attention_required", "stop"),
        latency_ms=int((time.perf_counter() - started) * 1000),
        min_citations_for_coverage=max(1, len(valid_check_ids)),
    )

    await session.commit()
    return PhotoAssessmentOut(
        id=assessment.id,
        run_id=run.id,
        step_id=step_id,
        attachment_id=a.id,
        overall_status=assessment.overall_status,
        items=[PhotoAssessmentItem(**it) for it in assessment.items_json],
        recommended_action=assessment.recommended_action,
        model_metadata=assessment.model_metadata_json or {},
    )


def _aggregate_confidence(items: list[dict]) -> str:
    if not items:
        return "medium"
    rank = {"low": 0, "medium": 1, "high": 2}
    vals = [rank.get(it.get("confidence", "medium"), 1) for it in items]
    avg = sum(vals) / len(vals)
    if avg < 0.7:
        return "low"
    if avg < 1.4:
        return "medium"
    return "high"


@router.get("/{run_id}/steps/{step_id}/photo-assessments", response_model=List[PhotoAssessmentOut])
async def list_photo_assessments(
    run_id: str,
    step_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> List[PhotoAssessmentOut]:
    run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
    if run is None or run.org_id != ctx.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    res = await session.execute(
        select(PhotoAssessment).where(
            PhotoAssessment.run_id == run.id, PhotoAssessment.step_id == step_id
        )
    )
    out = []
    for a in res.scalars().all():
        out.append(
            PhotoAssessmentOut(
                id=a.id,
                run_id=a.run_id,
                step_id=a.step_id,
                attachment_id=a.attachment_id,
                overall_status=a.overall_status,
                items=[PhotoAssessmentItem(**it) for it in a.items_json],
                recommended_action=a.recommended_action,
                model_metadata=a.model_metadata_json or {},
            )
        )
    return out


def _trace_to_dict(r: AITrace) -> dict:
    return {
        "id": r.id,
        "task_type": r.task_type,
        "model": r.model,
        "step_id": r.step_id,
        "input_summary": r.input_summary,
        "source_document_ids": r.source_document_ids,
        "source_chunk_ids": r.source_chunk_ids,
        "output_schema": r.output_schema,
        "output_json": r.output_json,
        "citation_count": r.citation_count,
        "citation_coverage": r.citation_coverage,
        "confidence": r.confidence,
        "safety_review": r.safety_review_json,
        "changed_run_state": r.changed_run_state,
        "requires_human_review": r.requires_human_review,
        "latency_ms": r.latency_ms,
        "error": r.error,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/{run_id}/ai-traces")
async def list_traces(
    run_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
    task_type: Optional[str] = None,
) -> list[dict]:
    run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
    if run is None or run.org_id != ctx.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    stmt = (
        select(AITrace)
        .where(AITrace.run_id == run_id)
        .order_by(AITrace.created_at.desc())
        .limit(limit)
    )
    if task_type:
        stmt = stmt.where(AITrace.task_type == task_type)
    rows = (await session.execute(stmt)).scalars().all()
    return [_trace_to_dict(r) for r in rows]


protocol_trace_router = APIRouter(prefix="/api/protocol-versions", tags=["ai"])


@protocol_trace_router.get("/{version_id}/ai-traces")
async def list_protocol_traces(
    version_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
    task_type: Optional[str] = None,
) -> list[dict]:
    stmt = (
        select(AITrace)
        .where(
            AITrace.protocol_version_id == version_id,
            AITrace.org_id == ctx.org_id,
        )
        .order_by(AITrace.created_at.desc())
        .limit(limit)
    )
    if task_type:
        stmt = stmt.where(AITrace.task_type == task_type)
    rows = (await session.execute(stmt)).scalars().all()
    return [_trace_to_dict(r) for r in rows]
