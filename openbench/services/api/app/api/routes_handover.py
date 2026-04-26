from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.report import generate_report, render_markdown
from app.api.deps import CurrentContext, current_context
from app.core.logging import logger
from app.db.session import get_db
from app.models.handover import HandoverReport
from app.models.run import Run
from app.schemas.runs import HandoverOut
from app.services import storage
from app.services.audit import record_audit
from app.services.pdf import markdown_to_html, render_pdf
from app.services.run_engine import append_event
from app.services.webhook import fan_out

router = APIRouter(prefix="/api/runs", tags=["handover"])


@router.post("/{run_id}/handover/generate", response_model=HandoverOut)
async def generate_handover(
    run_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> HandoverOut:
    run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
    if run is None or run.org_id != ctx.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    # Operators can only see / regenerate their own runs.
    if ctx.role == "operator" and run.operator_id != ctx.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    existing = (
        await session.execute(select(HandoverReport).where(HandoverReport.run_id == run_id))
    ).scalar_one_or_none()
    # If already finalized, don't regenerate — finalization is the audit-of-record.
    if existing is not None and existing.status == "finalized":
        return HandoverOut(
            id=existing.id,
            run_id=existing.run_id,
            status=existing.status,
            report_json=existing.report_json,
            markdown_body=existing.markdown_body,
            html_body=existing.html_body,
            pdf_url=storage.presigned_get_url(existing.pdf_storage_path)
            if existing.pdf_storage_path
            else None,
            generated_at=existing.generated_at,
            finalized_at=existing.finalized_at,
        )
    try:
        report_json = await generate_report(session, run_id)
    except Exception as e:  # noqa: BLE001
        logger.exception("Handover generation failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Report generation failed: {e}") from e

    md_body = render_markdown(report_json)
    html_body = markdown_to_html(md_body)

    if existing is None:
        existing = HandoverReport(run_id=run_id)
        session.add(existing)
    existing.report_json = report_json
    existing.markdown_body = md_body
    existing.html_body = html_body
    existing.generated_at = datetime.utcnow()
    existing.status = existing.status if existing.status == "finalized" else "draft"
    await session.flush()

    await append_event(
        session,
        run_id=run.id,
        event_type="handover_generated",
        actor_id=ctx.user_id,
        payload={"report_id": existing.id},
    )
    await session.commit()
    await fan_out(
        session,
        org_id=ctx.org_id,
        event_type="handover_generated",
        payload={"run_id": run.id, "report_id": existing.id},
    )
    await session.commit()

    return HandoverOut(
        id=existing.id,
        run_id=existing.run_id,
        status=existing.status,
        report_json=existing.report_json,
        markdown_body=existing.markdown_body,
        html_body=existing.html_body,
        pdf_url=None,
        generated_at=existing.generated_at,
        finalized_at=existing.finalized_at,
    )


@router.get("/{run_id}/handover", response_model=HandoverOut)
async def get_handover(
    run_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> HandoverOut:
    run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
    if run is None or run.org_id != ctx.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    if ctx.role == "operator" and run.operator_id != ctx.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    rep = (
        await session.execute(select(HandoverReport).where(HandoverReport.run_id == run_id))
    ).scalar_one_or_none()
    if rep is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not generated yet")
    pdf_url = None
    if rep.pdf_storage_path:
        pdf_url = storage.presigned_get_url(rep.pdf_storage_path)
    return HandoverOut(
        id=rep.id,
        run_id=rep.run_id,
        status=rep.status,
        report_json=rep.report_json,
        markdown_body=rep.markdown_body,
        html_body=rep.html_body,
        pdf_url=pdf_url,
        generated_at=rep.generated_at,
        finalized_at=rep.finalized_at,
    )


@router.post("/{run_id}/handover/finalize", response_model=HandoverOut)
async def finalize_handover(
    run_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> HandoverOut:
    run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
    if run is None or run.org_id != ctx.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    if ctx.role == "operator" and run.operator_id != ctx.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    rep = (
        await session.execute(select(HandoverReport).where(HandoverReport.run_id == run_id))
    ).scalar_one_or_none()
    if rep is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Generate the report first")
    if run.status not in ("awaiting_handover", "completed", "paused"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Finalize handover after the run is ready for handover or paused for shift handoff",
        )
    pdf_bytes = render_pdf(rep.markdown_body or "")
    key = f"orgs/{ctx.org_id}/runs/{run_id}/handover/{rep.id}.pdf"
    storage.put_bytes(key, pdf_bytes, "application/pdf")
    rep.pdf_storage_path = key
    rep.status = "finalized"
    rep.finalized_at = datetime.utcnow()
    completed_now = False
    if run.status == "awaiting_handover":
        run.status = "completed"
        run.ended_at = datetime.utcnow()
        completed_now = True
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="handover.finalize",
        target_type="handover",
        target_id=rep.id,
        summary=f"Finalized handover for {run_id}",
    )
    if completed_now:
        await append_event(
            session,
            run_id=run.id,
            event_type="run_completed",
            actor_id=ctx.user_id,
            payload={"report_id": rep.id},
        )
    await append_event(
        session,
        run_id=run.id,
        event_type="handover_finalized",
        actor_id=ctx.user_id,
        payload={"report_id": rep.id},
    )
    await session.commit()
    if completed_now:
        await fan_out(session, org_id=ctx.org_id, event_type="run_completed", payload={"run_id": run.id})
    await fan_out(
        session,
        org_id=ctx.org_id,
        event_type="handover_finalized",
        payload={"run_id": run.id, "report_id": rep.id},
    )
    await session.commit()
    return HandoverOut(
        id=rep.id,
        run_id=rep.run_id,
        status=rep.status,
        report_json=rep.report_json,
        markdown_body=rep.markdown_body,
        html_body=rep.html_body,
        pdf_url=storage.presigned_get_url(rep.pdf_storage_path),
        generated_at=rep.generated_at,
        finalized_at=rep.finalized_at,
    )


@router.get("/{run_id}/handover/pdf")
async def download_pdf(
    run_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
    if run is None or run.org_id != ctx.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    if ctx.role == "operator" and run.operator_id != ctx.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    rep = (
        await session.execute(select(HandoverReport).where(HandoverReport.run_id == run_id))
    ).scalar_one_or_none()
    if rep is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not generated yet")
    if rep.pdf_storage_path:
        pdf = storage.get_bytes(rep.pdf_storage_path)
    else:
        pdf = render_pdf(rep.markdown_body or "")
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="handover.export_pdf",
        target_type="handover",
        target_id=rep.id,
        summary=f"Downloaded handover PDF for {run_id}",
    )
    await session.commit()
    return Response(pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="handover-{run_id}.pdf"'
    })
