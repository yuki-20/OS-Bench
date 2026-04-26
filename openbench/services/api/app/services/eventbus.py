"""Tiny in-process pub/sub for live notifications.

Used by routes_notifications to push escalation_raised / run_state_changed /
override_requested events to subscribed SSE clients. Backed by per-org
asyncio.Queue's; if no subscribers exist the publish is a no-op.

This is deliberately not Redis-backed: a multi-worker production deployment
should swap in Redis pub/sub by replacing `_subscribers` with a Redis client.
"""
from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

# org_id -> set of subscriber queues
_subscribers: dict[str, set[asyncio.Queue]] = {}


async def publish(org_id: str, event_type: str, payload: dict[str, Any]) -> None:
    qs = list(_subscribers.get(org_id, set()))
    if not qs:
        return
    msg = json.dumps({"event_type": event_type, "payload": payload})
    for q in qs:
        # Don't await on full queues — drop the message rather than block other publishers.
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            pass


@asynccontextmanager
async def subscribe(org_id: str) -> AsyncIterator[asyncio.Queue]:
    """Async context manager that registers a queue for an org and cleans up
    when the consumer disconnects."""
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    bucket = _subscribers.setdefault(org_id, set())
    bucket.add(q)
    try:
        yield q
    finally:
        bucket.discard(q)
        if not bucket:
            _subscribers.pop(org_id, None)


__all__ = ["publish", "subscribe"]
