"""Webhook fan-out helper."""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import socket
from typing import Any, Dict
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.models.webhook import WebhookDelivery, WebhookSubscription
from app.services.eventbus import publish as bus_publish


def validate_webhook_target_url(target_url: str) -> str:
    """Reject http://, credentials, and private/loopback/link-local addresses.

    Defense against SSRF / receiver pivot. Resolves the hostname and checks every
    returned address — preventing DNS rebinding to RFC1918 ranges.
    """
    parsed = urlparse(target_url)
    if parsed.scheme != "https":
        raise ValueError("Webhook target URL must use https")
    if not parsed.hostname:
        raise ValueError("Webhook target URL must include a hostname")
    if parsed.username or parsed.password:
        raise ValueError("Webhook target URL must not include credentials")
    host = parsed.hostname.strip().lower()
    try:
        ip_addresses = [ipaddress.ip_address(host)]
    except ValueError:
        try:
            infos = socket.getaddrinfo(host, parsed.port or 443, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise ValueError("Webhook target hostname could not be resolved") from exc
        ip_addresses = [ipaddress.ip_address(info[4][0]) for info in infos]
    for ip in ip_addresses:
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise ValueError("Webhook target URL resolves to a blocked network")
    return target_url


def _sign(payload: bytes) -> str:
    return hmac.new(settings.webhook_signing_secret.encode(), payload, hashlib.sha256).hexdigest()


async def fan_out(session: AsyncSession, *, org_id: str, event_type: str, payload: Dict[str, Any]) -> None:
    # In-process broadcast first — drives the SSE stream that the dashboard
    # subscribes to. Always runs, even when no external webhooks are configured.
    try:
        await bus_publish(org_id, event_type, payload)
    except Exception as exc:  # noqa: BLE001
        logger.warning("eventbus publish failed for {}: {}", event_type, exc)

    res = await session.execute(
        select(WebhookSubscription).where(
            WebhookSubscription.org_id == org_id,
            WebhookSubscription.active.is_(True),
        )
    )
    subs = res.scalars().all()
    if not subs:
        return
    body = {"event_type": event_type, "payload": payload}
    raw = json.dumps(body).encode()
    sig = _sign(raw)
    async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
        for s in subs:
            if s.event_types and event_type not in s.event_types:
                continue
            delivery = WebhookDelivery(
                subscription_id=s.id,
                event_type=event_type,
                payload=body,
                status="pending",
                attempts=1,
            )
            session.add(delivery)
            await session.flush()
            try:
                validate_webhook_target_url(s.target_url)
                resp = await client.post(
                    s.target_url,
                    content=raw,
                    headers={
                        "Content-Type": "application/json",
                        "X-OpenBench-Signature": sig,
                        "X-OpenBench-Event": event_type,
                    },
                )
                delivery.status = "delivered" if resp.status_code < 300 else "failed"
                delivery.last_response = resp.text[:2000]
            except Exception as e:  # noqa: BLE001
                delivery.status = "failed"
                delivery.last_response = str(e)[:2000]
                logger.warning("Webhook delivery failed for {}: {}", s.target_url, e)
