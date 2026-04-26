from __future__ import annotations

from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentContext, current_context
from app.db.session import get_db
from app.models.run import Deviation, Run
from app.schemas.runs import DeviationOut

router = APIRouter(prefix="/api/deviations", tags=["deviations"])


class DeviationResolveRequest(BaseModel):
    resolution_state: str  # "resolved" | "open" | "review"
    note: Optional[str] = None


@router.get("", response_model=List[DeviationOut])
async def list_deviations(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    state: Optional[str] = None,
) -> List[DeviationOut]:
    stmt = (
        select(Deviation)
        .join(Run, Deviation.run_id == Run.id)
        .where(Run.org_id == ctx.org_id)
        .order_by(desc(Deviation.created_at))
    )
    if state:
        stmt = stmt.where(Deviation.resolution_state == state)
    res = await session.execute(stmt)
    return [DeviationOut.model_validate(d) for d in res.scalars().all()]


@router.post("/{deviation_id}/resolve", response_model=DeviationOut)
async def resolve(
    deviation_id: str,
    payload: DeviationResolveRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> DeviationOut:
    ctx.require_min("manager")
    res = await session.execute(
        select(Deviation, Run).join(Run, Deviation.run_id == Run.id).where(Deviation.id == deviation_id)
    )
    row = res.first()
    if row is None or row[1].org_id != ctx.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Deviation not found")
    dev: Deviation = row[0]
    dev.resolution_state = payload.resolution_state
    if payload.note:
        dev.description = (dev.description or "") + f"\n\nResolution note: {payload.note}"
    await session.commit()
    return DeviationOut.model_validate(dev)
