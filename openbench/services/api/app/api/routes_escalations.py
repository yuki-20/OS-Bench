"""Escalation REST endpoints (PRD v3 Section 17.5)."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentContext, current_context
from app.db.session import get_db
from app.models.escalation import Escalation
from app.services.escalation import create_escalation, resolve_escalation

router = APIRouter(prefix="/api/escalations", tags=["escalations"])


class EscalationOut(BaseModel):
    id: str
    org_id: str
    run_id: Optional[str] = None
    step_id: Optional[str] = None
    kind: str
    severity: str
    title: str
    description: str
    notify_roles: List[str] = Field(default_factory=list)
    required_action: str
    resolution_state: str
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    source_event_id: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class EscalationCreate(BaseModel):
    kind: str
    title: str
    description: str = ""
    severity: Optional[str] = None
    run_id: Optional[str] = None
    step_id: Optional[str] = None
    notify_roles: Optional[List[str]] = None
    required_action: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class EscalationResolve(BaseModel):
    decision: str = "resolved"  # resolved | dismissed
    notes: str = ""


def _to_out(e: Escalation) -> EscalationOut:
    return EscalationOut(
        id=e.id,
        org_id=e.org_id,
        run_id=e.run_id,
        step_id=e.step_id,
        kind=e.kind,
        severity=e.severity,
        title=e.title,
        description=e.description,
        notify_roles=list(e.notify_roles or []),
        required_action=e.required_action,
        resolution_state=e.resolution_state,
        resolved_by=e.resolved_by,
        resolved_at=e.resolved_at,
        resolution_notes=e.resolution_notes,
        source_event_id=e.source_event_id,
        metadata=dict(e.metadata_json or {}),
        created_at=e.created_at,
    )


@router.get("", response_model=List[EscalationOut])
async def list_escalations(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    state: Optional[str] = None,
    kind: Optional[str] = None,
    run_id: Optional[str] = None,
    limit: int = 200,
) -> List[EscalationOut]:
    stmt = (
        select(Escalation)
        .where(Escalation.org_id == ctx.org_id)
        .order_by(Escalation.created_at.desc())
        .limit(limit)
    )
    if state:
        stmt = stmt.where(Escalation.resolution_state == state)
    if kind:
        stmt = stmt.where(Escalation.kind == kind)
    if run_id:
        stmt = stmt.where(Escalation.run_id == run_id)
    rows = (await session.execute(stmt)).scalars().all()
    return [_to_out(e) for e in rows]


@router.post("", response_model=EscalationOut)
async def create_escalation_endpoint(
    payload: EscalationCreate,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> EscalationOut:
    esc = await create_escalation(
        session,
        org_id=ctx.org_id,
        kind=payload.kind,
        title=payload.title,
        description=payload.description,
        run_id=payload.run_id,
        step_id=payload.step_id,
        severity=payload.severity,
        notify_roles=payload.notify_roles,
        required_action=payload.required_action,
        metadata=payload.metadata,
        actor_id=ctx.user_id,
    )
    await session.commit()
    return _to_out(esc)


@router.post("/{escalation_id}/resolve", response_model=EscalationOut)
async def resolve_endpoint(
    escalation_id: str,
    payload: EscalationResolve,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> EscalationOut:
    ctx.require_min("manager")
    esc = (
        await session.execute(
            select(Escalation).where(
                Escalation.id == escalation_id, Escalation.org_id == ctx.org_id
            )
        )
    ).scalar_one_or_none()
    if esc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Escalation not found")
    await resolve_escalation(
        session,
        escalation=esc,
        decision=payload.decision,
        notes=payload.notes,
        actor_id=ctx.user_id,
    )
    await session.commit()
    return _to_out(esc)
