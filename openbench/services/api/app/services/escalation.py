"""Escalation engine — PRD v3 Section 17.5.

Escalations are first-class records routed to specific roles.
Triggers (PRD 17.5):
  - source conflicts
  - missing required source coverage
  - unresolved critical visual mismatch
  - user request for unapproved substitution (Q&A escalation)
  - hazard condition met
  - user-reported exposure/spill/fire/injury/malfunction
  - model unable to source-answer a critical instruction
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.escalation import Escalation
from app.services.eventbus import publish as bus_publish
from app.services.notify import emails_for_roles, send_email
from app.services.run_engine import append_event


# kind -> (default severity, notify_roles, default required_action)
ESCALATION_DEFAULTS: dict[str, tuple[str, list[str], str]] = {
    "source_conflict": (
        "high",
        ["reviewer", "safety_lead"],
        "Reviewer must reconcile conflicting documents and republish.",
    ),
    "missing_source": (
        "high",
        ["reviewer"],
        "Reviewer must provide a source citation or remove the unsupported step.",
    ),
    "visual_mismatch": (
        "high",
        ["safety_lead", "manager"],
        "Operator should re-photograph or correct the bench setup before proceeding.",
    ),
    "unauthorized_substitution": (
        "high",
        ["safety_lead", "reviewer"],
        "Substitution is not authorised by the published protocol. Get approval or stop.",
    ),
    "hazard_condition": (
        "critical",
        ["safety_lead", "manager"],
        "Apply hazard-response procedure and notify safety lead immediately.",
    ),
    "exposure_or_incident": (
        "critical",
        ["safety_lead", "manager", "admin"],
        "Stop the run and follow your lab's emergency procedure now.",
    ),
    "model_unsupported": (
        "standard",
        ["reviewer"],
        "AI cannot ground this answer in approved documents. Operator should consult supervisor.",
    ),
    "manual": (
        "standard",
        ["manager"],
        "Manager review requested by operator.",
    ),
}


async def create_escalation(
    session: AsyncSession,
    *,
    org_id: str,
    kind: str,
    title: str,
    description: str = "",
    run_id: Optional[str] = None,
    step_id: Optional[str] = None,
    severity: Optional[str] = None,
    notify_roles: Optional[list[str]] = None,
    required_action: Optional[str] = None,
    source_event_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    actor_id: Optional[str] = None,
) -> Escalation:
    defaults = ESCALATION_DEFAULTS.get(kind, ("standard", ["manager"], "Review and resolve."))
    sev = severity or defaults[0]
    roles = notify_roles or list(defaults[1])
    action = required_action or defaults[2]
    esc = Escalation(
        org_id=org_id,
        run_id=run_id,
        step_id=step_id,
        kind=kind,
        severity=sev,
        title=title[:300],
        description=description,
        notify_roles=roles,
        required_action=action,
        source_event_id=source_event_id,
        metadata_json=metadata or {},
    )
    session.add(esc)
    await session.flush()
    if run_id:
        await append_event(
            session,
            run_id=run_id,
            event_type="escalation_raised",
            actor_id=actor_id,
            step_id=step_id,
            payload={
                "escalation_id": esc.id,
                "kind": kind,
                "severity": sev,
                "notify_roles": roles,
                "required_action": action,
            },
        )
    # In-process SSE push so any connected console / bench client gets a live
    # notification. No-ops if nobody is subscribed.
    try:
        await bus_publish(
            org_id,
            "escalation_raised",
            {
                "escalation_id": esc.id,
                "kind": kind,
                "severity": sev,
                "title": title,
                "run_id": run_id,
                "step_id": step_id,
                "notify_roles": roles,
                "required_action": action,
            },
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("escalation eventbus publish failed: {}", e)
    # Best-effort email fan-out to the notify_roles for this org. Failures are
    # logged and do not affect the calling transaction.
    try:
        recipients = await emails_for_roles(session, org_id=org_id, roles=roles)
        if recipients:
            subject = f"[OpenBench] {sev.upper()} — {title[:120]}"
            body = (
                f"An escalation was raised in OpenBench OS.\n\n"
                f"Kind: {kind}\n"
                f"Severity: {sev}\n"
                f"Title: {title}\n"
                f"Description: {description or '(none)'}\n"
                f"Required action: {action}\n"
                f"Run: {run_id or '(none — protocol-scoped)'}\n"
                f"Step: {step_id or '(none)'}\n"
                f"Escalation id: {esc.id}\n"
            )
            await send_email(to=recipients, subject=subject, body=body)
    except Exception as e:  # noqa: BLE001
        logger.warning("escalation email fan-out failed: {}", e)
    return esc


async def resolve_escalation(
    session: AsyncSession,
    *,
    escalation: Escalation,
    decision: str,
    notes: str = "",
    actor_id: Optional[str] = None,
) -> Escalation:
    if escalation.resolution_state in ("resolved", "dismissed"):
        return escalation
    escalation.resolution_state = "resolved" if decision == "resolved" else "dismissed"
    escalation.resolved_by = actor_id
    escalation.resolved_at = datetime.utcnow()
    escalation.resolution_notes = notes
    if escalation.run_id:
        await append_event(
            session,
            run_id=escalation.run_id,
            event_type="escalation_resolved",
            actor_id=actor_id,
            step_id=escalation.step_id,
            payload={
                "escalation_id": escalation.id,
                "decision": escalation.resolution_state,
                "notes": notes,
            },
        )
    return escalation


__all__ = ["create_escalation", "resolve_escalation", "ESCALATION_DEFAULTS"]
