"""Email notification service.

PRD §15.9.1 — channels are in-app, email, webhook. Email + webhook are
implemented; in-app uses SSE (see routes_notifications). When SMTP_HOST is
unset (default in dev), every email call is a logged no-op so the local stack
keeps working without a mail server.

Sends are dispatched in a thread pool so an SMTP timeout never blocks the
request loop.
"""
from __future__ import annotations

import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from typing import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.models.organization import Membership
from app.models.user import User


def _build_message(*, to: Sequence[str], subject: str, body: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_address}>"
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    msg.set_content(body)
    return msg


def _send_blocking(*, to: Sequence[str], subject: str, body: str) -> None:
    if not settings.smtp_host:
        logger.info("[notify] SMTP not configured; skipping email to {}: {}", list(to), subject)
        return
    if not to:
        return
    msg = _build_message(to=to, subject=subject, body=body)
    try:
        if settings.smtp_use_tls:
            ctx = ssl.create_default_context()
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                smtp.ehlo()
                smtp.starttls(context=ctx)
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(msg)
        logger.info("[notify] sent email to {}: {}", list(to), subject)
    except Exception as e:  # noqa: BLE001
        logger.warning("[notify] email send failed to {}: {}", list(to), e)


async def send_email(*, to: Sequence[str], subject: str, body: str) -> None:
    """Fire-and-forget — runs the SMTP call in the default thread pool."""
    await asyncio.to_thread(_send_blocking, to=list(to), subject=subject, body=body)


async def emails_for_roles(
    session: AsyncSession,
    *,
    org_id: str,
    roles: Iterable[str],
) -> list[str]:
    """Resolve the email addresses of every active user holding any of the
    given roles in the organization."""
    role_set = list(set(roles))
    if not role_set:
        return []
    res = await session.execute(
        select(User.email)
        .join(Membership, Membership.user_id == User.id)
        .where(
            Membership.org_id == org_id,
            Membership.role.in_(role_set),
            User.status == "active",
        )
    )
    return [row[0] for row in res.all() if row[0]]


__all__ = ["send_email", "emails_for_roles"]
