"""Sync endpoints for the bench desktop client's offline event journal."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentContext, current_context
from app.db.session import get_db
from app.models.run import Run, RunEvent
from app.services.run_engine import append_event

router = APIRouter(prefix="/api/sync", tags=["sync"])


class QueuedEvent(BaseModel):
    run_id: str
    event_type: str
    step_id: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str
    local_seq: Optional[int] = None
    client_timestamp: Optional[datetime] = None


class SyncRequest(BaseModel):
    device_id: Optional[str] = None
    events: List[QueuedEvent]


class SyncResultItem(BaseModel):
    idempotency_key: str
    status: str
    server_event_id: Optional[str] = None
    error: Optional[str] = None


class SyncResponse(BaseModel):
    accepted: int
    rejected: int
    items: List[SyncResultItem]


@router.post("/events", response_model=SyncResponse)
async def push_events(
    payload: SyncRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SyncResponse:
    items: list[SyncResultItem] = []
    accepted = 0
    rejected = 0
    for ev in payload.events:
        run = (await session.execute(select(Run).where(Run.id == ev.run_id))).scalar_one_or_none()
        if run is None or run.org_id != ctx.org_id:
            items.append(
                SyncResultItem(idempotency_key=ev.idempotency_key, status="rejected", error="run_not_found")
            )
            rejected += 1
            continue
        existing = (
            await session.execute(
                select(RunEvent).where(
                    RunEvent.run_id == run.id, RunEvent.idempotency_key == ev.idempotency_key
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            items.append(
                SyncResultItem(
                    idempotency_key=ev.idempotency_key, status="duplicate", server_event_id=existing.id
                )
            )
            accepted += 1
            continue
        try:
            new_ev = await append_event(
                session,
                run_id=run.id,
                event_type=ev.event_type,
                actor_id=ctx.user_id,
                step_id=ev.step_id,
                payload=ev.payload,
                idempotency_key=ev.idempotency_key,
                local_seq=ev.local_seq,
                client_timestamp=ev.client_timestamp,
                device_id=payload.device_id,
            )
            items.append(
                SyncResultItem(
                    idempotency_key=ev.idempotency_key, status="accepted", server_event_id=new_ev.id
                )
            )
            accepted += 1
        except Exception as e:  # noqa: BLE001
            items.append(
                SyncResultItem(
                    idempotency_key=ev.idempotency_key, status="rejected", error=str(e)[:300]
                )
            )
            rejected += 1
    await session.commit()
    return SyncResponse(accepted=accepted, rejected=rejected, items=items)
