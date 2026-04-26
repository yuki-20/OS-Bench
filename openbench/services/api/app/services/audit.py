"""Audit log helper."""
from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


async def record_audit(
    session: AsyncSession,
    *,
    org_id: str,
    actor_id: Optional[str],
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    summary: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    entry = AuditLog(
        org_id=org_id,
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        summary=summary,
        metadata_json=metadata or {},
    )
    session.add(entry)
    await session.flush()
