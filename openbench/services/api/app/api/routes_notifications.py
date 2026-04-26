"""Server-Sent Events stream for live in-app notifications.

A connected client receives:
  - escalation_raised events (auto-fired by the escalation service)
  - run_state_changed events (placeholder; published by callers)

Browsers' EventSource implementation does not let us send custom headers, so
auth must travel as a query string token. We accept `?token=...` and validate
it the same way the bearer-auth dependency does.
"""
from __future__ import annotations

import asyncio
import json
from typing import Annotated, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentContext
from app.core.security import decode_token
from app.db.session import get_db
from app.models.organization import Membership, Organization
from app.models.user import User
from app.services.eventbus import subscribe

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


async def _ctx_from_query_token(
    session: AsyncSession,
    token: str,
    org_id: str | None,
) -> CurrentContext:
    try:
        claims = decode_token(token)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    if claims.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    user = (
        await session.execute(select(User).where(User.id == claims.get("sub")))
    ).scalar_one_or_none()
    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    memberships = (
        await session.execute(select(Membership).where(Membership.user_id == user.id))
    ).scalars().all()
    if not memberships:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No org memberships")
    membership = next((m for m in memberships if m.org_id == org_id), None) if org_id else None
    if membership is None and org_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this org")
    if membership is None:
        membership = memberships[0]
    org = (
        await session.execute(select(Organization).where(Organization.id == membership.org_id))
    ).scalar_one()
    return CurrentContext(user=user, membership=membership, organization=org)


@router.get("/stream")
async def stream(
    session: Annotated[AsyncSession, Depends(get_db)],
    token: str = Query(..., description="Access token (query string for EventSource)"),
    org_id: str | None = Query(default=None),
) -> StreamingResponse:
    ctx = await _ctx_from_query_token(session, token, org_id)
    target_org = ctx.org_id

    async def event_stream() -> AsyncIterator[bytes]:
        # Initial "ready" frame so the client knows the stream is live.
        yield b"event: ready\ndata: {}\n\n"
        async with subscribe(target_org) as q:
            try:
                while True:
                    try:
                        msg = await asyncio.wait_for(q.get(), timeout=20.0)
                        # Decode once so we can pull the event_type for the SSE frame name.
                        try:
                            obj = json.loads(msg)
                            ev = obj.get("event_type", "message")
                            data = json.dumps(obj.get("payload", {}))
                        except Exception:
                            ev = "message"
                            data = msg
                        yield f"event: {ev}\ndata: {data}\n\n".encode("utf-8")
                    except asyncio.TimeoutError:
                        # Heartbeat to keep proxies from idling-out the connection.
                        yield b": ping\n\n"
            except asyncio.CancelledError:
                return

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
