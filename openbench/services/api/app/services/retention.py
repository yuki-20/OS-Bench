"""Retention enforcement (PRD §15.8 + §26.3).

Hard-deletes completed/cancelled runs older than the org's
`retention_policy_days`. Open runs are never auto-purged because the operator
or reviewer may still need them. Attachments tied to purged runs are removed
from object storage on a best-effort basis.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.ai_trace import AITrace
from app.models.escalation import Escalation
from app.models.handover import HandoverReport
from app.models.organization import Organization
from app.models.run import Attachment, Run
from app.services import storage


_PURGEABLE_STATUSES = ("completed", "cancelled", "closed")


async def purge_org_retention(session: AsyncSession, org: Organization) -> dict[str, Any]:
    """Delete runs (and their dependents) older than the org's retention window.

    Returns a small summary dict. Attachments are removed from object storage on
    a best-effort basis — failures are logged but never raised since the
    audit-log row in `audit_logs` is the system of record.
    """
    days = int(org.retention_policy_days or 0)
    if days <= 0:
        return {"org_id": org.id, "skipped": True, "reason": "retention_policy_days <= 0"}
    cutoff = datetime.utcnow() - timedelta(days=days)
    res = await session.execute(
        select(Run).where(
            Run.org_id == org.id,
            Run.status.in_(_PURGEABLE_STATUSES),
            Run.ended_at.isnot(None),
            Run.ended_at < cutoff,
        )
    )
    runs = res.scalars().all()
    deleted_attachments = 0
    deleted_storage = 0
    for r in runs:
        # Delete attachment objects from storage first.
        attachments = (
            (await session.execute(select(Attachment).where(Attachment.run_id == r.id)))
            .scalars()
            .all()
        )
        for a in attachments:
            try:
                storage.delete_object(a.storage_path)
                deleted_storage += 1
            except Exception as e:  # noqa: BLE001
                logger.warning("retention: failed to delete object {}: {}", a.storage_path, e)
        deleted_attachments += len(attachments)
        # Delete the handover PDF object too if any.
        rep = (
            await session.execute(select(HandoverReport).where(HandoverReport.run_id == r.id))
        ).scalar_one_or_none()
        if rep and rep.pdf_storage_path:
            try:
                storage.delete_object(rep.pdf_storage_path)
                deleted_storage += 1
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "retention: failed to delete handover pdf {}: {}", rep.pdf_storage_path, e
                )

    # ORM cascade rules already cover attachments / events / step_state / timers
    # / deviations / photo_assessments / handover_reports (`ondelete="CASCADE"`
    # on the FKs). Escalations and AI traces aren't on the run cascade so do
    # them explicitly.
    purged_run_ids = [r.id for r in runs]
    if purged_run_ids:
        for esc in (
            (await session.execute(select(Escalation).where(Escalation.run_id.in_(purged_run_ids))))
            .scalars()
            .all()
        ):
            await session.delete(esc)
        for tr in (
            (await session.execute(select(AITrace).where(AITrace.run_id.in_(purged_run_ids))))
            .scalars()
            .all()
        ):
            await session.delete(tr)
    for r in runs:
        await session.delete(r)
    org.retention_purged_at = datetime.utcnow()
    await session.commit()
    summary = {
        "org_id": org.id,
        "cutoff": cutoff.isoformat(),
        "runs_purged": len(runs),
        "attachments_purged": deleted_attachments,
        "storage_objects_deleted": deleted_storage,
        "completed_at": datetime.utcnow().isoformat(),
    }
    logger.info("retention purge completed: {}", summary)
    return summary


__all__ = ["purge_org_retention"]
