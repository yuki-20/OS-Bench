from __future__ import annotations

from datetime import datetime, timedelta
from typing import Annotated, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentContext, current_context
from app.db.session import get_db
from app.models.protocol import Protocol, ProtocolVersion
from app.models.run import Deviation, Run

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class DashboardStats(BaseModel):
    active_runs: int
    blocked_runs: int
    pending_handovers: int
    completed_runs_7d: int
    deviations_open: int
    drafts_in_review: int


class RecentRun(BaseModel):
    id: str
    status: str
    operator_id: str
    protocol_version_id: str
    started_at: datetime | None
    ended_at: datetime | None


@router.get("", response_model=DashboardStats)
async def stats(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> DashboardStats:
    week_ago = datetime.utcnow() - timedelta(days=7)
    active = (await session.execute(
        select(func.count()).select_from(Run).where(Run.org_id == ctx.org_id, Run.status == "active")
    )).scalar_one()
    blocked = (await session.execute(
        select(func.count()).select_from(Run).where(Run.org_id == ctx.org_id, Run.status.in_(["blocked", "awaiting_override"]))
    )).scalar_one()
    pending = (await session.execute(
        select(func.count()).select_from(Run).where(
            Run.org_id == ctx.org_id, Run.status == "completed", Run.ended_at >= week_ago
        )
    )).scalar_one()
    completed_7d = (await session.execute(
        select(func.count()).select_from(Run).where(
            Run.org_id == ctx.org_id, Run.ended_at >= week_ago
        )
    )).scalar_one()
    deviations_open = (await session.execute(
        select(func.count()).select_from(Deviation)
        .join(Run, Deviation.run_id == Run.id)
        .where(Run.org_id == ctx.org_id, Deviation.resolution_state == "open")
    )).scalar_one()
    drafts = (await session.execute(
        select(func.count()).select_from(ProtocolVersion)
        .join(Protocol, ProtocolVersion.protocol_id == Protocol.id)
        .where(Protocol.org_id == ctx.org_id, ProtocolVersion.status.in_(["draft", "in_review"]))
    )).scalar_one()
    return DashboardStats(
        active_runs=int(active or 0),
        blocked_runs=int(blocked or 0),
        pending_handovers=int(pending or 0),
        completed_runs_7d=int(completed_7d or 0),
        deviations_open=int(deviations_open or 0),
        drafts_in_review=int(drafts or 0),
    )


@router.get("/recent-runs", response_model=List[RecentRun])
async def recent_runs(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 12,
) -> List[RecentRun]:
    res = await session.execute(
        select(Run).where(Run.org_id == ctx.org_id).order_by(desc(Run.created_at)).limit(limit)
    )
    return [
        RecentRun(
            id=r.id,
            status=r.status,
            operator_id=r.operator_id,
            protocol_version_id=r.protocol_version_id,
            started_at=r.started_at,
            ended_at=r.ended_at,
        )
        for r in res.scalars().all()
    ]
