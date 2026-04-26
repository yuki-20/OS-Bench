"""Tenant-scoped CSV/JSON export endpoints (PRD §15.10.1 V1 integration contract).

All exports are filtered by the caller's `org_id` and gated to manager+ since
they reveal cross-run / cross-team data. Format is RFC 4180-compatible CSV
(quoted, CRLF) and pretty-printed JSON.
"""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentContext, current_context
from app.db.session import get_db
from app.models.handover import HandoverReport
from app.models.protocol import Protocol, ProtocolVersion
from app.models.run import Deviation, Run
from app.services.audit import record_audit

router = APIRouter(prefix="/api/exports", tags=["exports"])


def _csv_response(rows: list[dict], filename: str) -> StreamingResponse:
    if not rows:
        rows = [{"_": "no rows"}]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()), quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()
    for row in rows:
        writer.writerow({k: ("" if v is None else v) for k, v in row.items()})
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/runs.csv")
async def export_runs_csv(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = None,
) -> StreamingResponse:
    ctx.require_min("manager")
    stmt = select(Run).where(Run.org_id == ctx.org_id).order_by(Run.created_at.desc())
    if status_filter:
        stmt = stmt.where(Run.status == status_filter)
    runs = (await session.execute(stmt)).scalars().all()
    rows = [
        {
            "run_id": r.id,
            "protocol_version_id": r.protocol_version_id,
            "operator_id": r.operator_id,
            "status": r.status,
            "current_step_id": r.current_step_id or "",
            "started_at": r.started_at.isoformat() if r.started_at else "",
            "ended_at": r.ended_at.isoformat() if r.ended_at else "",
            "device_id": r.device_id or "",
            "block_reason": r.block_reason or "",
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in runs
    ]
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="export.runs_csv",
        target_type="export",
        target_id="runs",
        summary=f"Exported {len(rows)} run rows",
    )
    await session.commit()
    return _csv_response(rows, "runs.csv")


@router.get("/deviations.csv")
async def export_deviations_csv(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    state: str | None = None,
) -> StreamingResponse:
    ctx.require_min("manager")
    stmt = (
        select(Deviation, Run)
        .join(Run, Deviation.run_id == Run.id)
        .where(Run.org_id == ctx.org_id)
        .order_by(Deviation.created_at.desc())
    )
    if state:
        stmt = stmt.where(Deviation.resolution_state == state)
    res = await session.execute(stmt)
    rows = [
        {
            "deviation_id": d.id,
            "run_id": d.run_id,
            "step_id": d.step_id or "",
            "severity": d.severity,
            "title": d.title,
            "description": d.description,
            "resolution_state": d.resolution_state,
            "requires_review": d.requires_review,
            "created_by": d.created_by or "",
            "created_at": d.created_at.isoformat() if d.created_at else "",
        }
        for d, _r in res.all()
    ]
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="export.deviations_csv",
        target_type="export",
        target_id="deviations",
        summary=f"Exported {len(rows)} deviation rows",
    )
    await session.commit()
    return _csv_response(rows, "deviations.csv")


@router.get("/handovers.json")
async def export_handovers_json(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = None,
) -> Response:
    ctx.require_min("manager")
    # Only handovers tied to this org's runs.
    stmt = (
        select(HandoverReport, Run)
        .join(Run, HandoverReport.run_id == Run.id)
        .where(Run.org_id == ctx.org_id)
        .order_by(HandoverReport.generated_at.desc())
    )
    if status_filter:
        stmt = stmt.where(HandoverReport.status == status_filter)
    res = await session.execute(stmt)
    payload = []
    for h, r in res.all():
        payload.append(
            {
                "handover_id": h.id,
                "run_id": h.run_id,
                "run_status": r.status,
                "operator_id": r.operator_id,
                "protocol_version_id": r.protocol_version_id,
                "status": h.status,
                "generated_at": h.generated_at.isoformat() if h.generated_at else None,
                "finalized_at": h.finalized_at.isoformat() if h.finalized_at else None,
                "report": h.report_json,
            }
        )
    body = json.dumps({"exported_at": datetime.utcnow().isoformat(), "count": len(payload), "handovers": payload}, indent=2)
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="export.handovers_json",
        target_type="export",
        target_id="handovers",
        summary=f"Exported {len(payload)} handover records",
    )
    await session.commit()
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="handovers.json"'},
    )


@router.get("/protocols.json")
async def export_protocols_json(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = "published",
) -> Response:
    ctx.require_min("manager")
    stmt = (
        select(ProtocolVersion, Protocol)
        .join(Protocol, ProtocolVersion.protocol_id == Protocol.id)
        .where(Protocol.org_id == ctx.org_id)
        .order_by(ProtocolVersion.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(ProtocolVersion.status == status_filter)
    res = await session.execute(stmt)
    out = []
    for pv, proto in res.all():
        out.append(
            {
                "protocol_id": proto.id,
                "name": proto.name,
                "version_id": pv.id,
                "version_label": pv.version_label,
                "status": pv.status,
                "summary": pv.summary,
                "source_doc_ids": pv.source_doc_ids,
                "compiler_metadata": pv.compiler_metadata,
                "published_at": pv.published_at.isoformat() if pv.published_at else None,
                "supersedes_version_id": pv.supersedes_version_id,
            }
        )
    return Response(
        content=json.dumps({"count": len(out), "protocols": out}, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="protocols.json"'},
    )
