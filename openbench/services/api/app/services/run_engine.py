"""Run engine — deterministic state machine for runs and steps."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.protocol import ProtocolStep
from app.models.run import Deviation, PhotoAssessment, Run, RunEvent, StepState, Timer

# Permitted run state transitions
RUN_TRANSITIONS = {
    "created": {"preflight", "cancelled"},
    "preflight": {"active", "cancelled"},
    "active": {"paused", "blocked", "completed", "awaiting_override", "awaiting_handover", "cancelled"},
    "paused": {"active", "cancelled"},
    "blocked": {"active", "awaiting_override", "cancelled"},
    "awaiting_override": {"active", "blocked", "cancelled"},
    "awaiting_handover": {"completed", "cancelled", "closed"},
    "completed": {"closed"},
    "cancelled": {"closed"},
    "closed": set(),
}

STEP_TRANSITIONS = {
    "not_started": {"in_progress", "skipped"},
    "in_progress": {"waiting_on_timer", "waiting_on_checkpoint", "blocked", "completed", "skipped"},
    "waiting_on_timer": {"in_progress", "completed", "blocked"},
    "waiting_on_checkpoint": {"in_progress", "completed", "blocked"},
    "blocked": {"in_progress", "skipped"},
    "completed": set(),
    "skipped": set(),
}


def can_transition_run(current: str, target: str) -> bool:
    return target in RUN_TRANSITIONS.get(current, set())


def can_transition_step(current: str, target: str) -> bool:
    return target in STEP_TRANSITIONS.get(current, set())


async def get_step(
    session: AsyncSession,
    step_id: str,
    protocol_version_id: str | None = None,
) -> ProtocolStep:
    """Fetch a step by id, optionally constrained to a protocol version.

    Passing the version id prevents cross-version step lookups — a defence
    against a caller mistakenly resolving a step from a stale or different
    protocol version.
    """
    stmt = select(ProtocolStep).where(ProtocolStep.id == step_id)
    if protocol_version_id is not None:
        stmt = stmt.where(ProtocolStep.protocol_version_id == protocol_version_id)
    s = (await session.execute(stmt)).scalar_one_or_none()
    if s is None:
        raise ValueError("Step not found for this protocol version")
    return s


async def get_or_create_step_state(session: AsyncSession, run_id: str, step_id: str) -> StepState:
    res = await session.execute(
        select(StepState).where(StepState.run_id == run_id, StepState.step_id == step_id)
    )
    state = res.scalar_one_or_none()
    if state is None:
        state = StepState(run_id=run_id, step_id=step_id, status="not_started")
        session.add(state)
        await session.flush()
    return state


async def append_event(
    session: AsyncSession,
    *,
    run_id: str,
    event_type: str,
    actor_id: Optional[str],
    step_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
    local_seq: Optional[int] = None,
    client_timestamp: Optional[datetime] = None,
    device_id: Optional[str] = None,
) -> RunEvent:
    if idempotency_key:
        existing = await session.execute(
            select(RunEvent).where(
                RunEvent.run_id == run_id, RunEvent.idempotency_key == idempotency_key
            )
        )
        prior = existing.scalar_one_or_none()
        if prior is not None:
            return prior
    event = RunEvent(
        run_id=run_id,
        event_type=event_type,
        actor_id=actor_id,
        step_id=step_id,
        payload_json=payload or {},
        idempotency_key=idempotency_key,
        local_seq=local_seq,
        client_timestamp=client_timestamp,
        device_id=device_id,
    )
    session.add(event)
    await session.flush()
    return event


async def evaluate_step_completion(
    session: AsyncSession, run: Run, step: ProtocolStep, state: StepState
) -> Tuple[bool, Optional[str]]:
    """Check whether a step is allowed to be completed.

    Returns (ok, reason)."""
    # Prereqs
    for prereq_key in step.prerequisites_json or []:
        # find step with matching step_key
        res = await session.execute(
            select(ProtocolStep).where(
                ProtocolStep.protocol_version_id == step.protocol_version_id,
                ProtocolStep.step_key == prereq_key,
            )
        )
        ps = res.scalar_one_or_none()
        if ps is None:
            continue
        ss = await get_or_create_step_state(session, run.id, ps.id)
        if ss.status not in ("completed", "skipped"):
            return False, f"Prerequisite step {prereq_key} not satisfied"
    # Required visual checks
    required_visual = [v for v in (step.visual_checks_json or []) if v.get("required", True)]
    if required_visual:
        # any photo assessment for this run+step that confirmed at least one critical?
        res = await session.execute(
            select(PhotoAssessment).where(
                PhotoAssessment.run_id == run.id, PhotoAssessment.step_id == step.id
            )
        )
        assessments = res.scalars().all()
        if not assessments:
            return False, "Photo checkpoint required but no assessment exists"
        confirmed_ids: set[str] = set()
        for a in assessments:
            for it in a.items_json or []:
                if it.get("status") == "confirmed":
                    confirmed_ids.add(it.get("check_id"))
        for v in required_visual:
            if v.get("check_id") not in confirmed_ids:
                return False, f"Required visual check {v.get('check_id')} not confirmed"
    # Required timers — a step with declared timers cannot complete until each
    # one has elapsed (or been explicitly overridden).
    for timer_spec in step.timers_json or []:
        label = str(timer_spec.get("label") or "")
        duration = int(timer_spec.get("duration_seconds") or 0)
        if duration <= 0:
            continue
        stmt = select(Timer).where(
            Timer.run_id == run.id,
            Timer.step_id == step.id,
            Timer.duration_seconds == duration,
            Timer.status.in_(["elapsed", "completed", "overridden"]),
        )
        if label:
            stmt = stmt.where(Timer.label == label)
        timer_done = (await session.execute(stmt)).scalars().first()
        if timer_done is None:
            return False, f"Required timer '{label or duration}' has not elapsed"
    # Required data fields
    for field in step.data_capture_schema_json or []:
        if field.get("required") and field.get("key") not in (state.measurements_json or {}) and field.get("key") not in (state.confirmations_json or {}):
            return False, f"Required field '{field.get('key')}' not captured"
    # Stop conditions: if any active deviation marked critical for this step exists
    res = await session.execute(
        select(Deviation).where(
            Deviation.run_id == run.id,
            Deviation.step_id == step.id,
            Deviation.severity.in_(["critical", "high"]),
            Deviation.resolution_state == "open",
        )
    )
    if res.scalars().first() is not None:
        return False, "Critical deviation open on this step"
    return True, None


async def list_protocol_steps(session: AsyncSession, version_id: str) -> List[ProtocolStep]:
    res = await session.execute(
        select(ProtocolStep)
        .where(ProtocolStep.protocol_version_id == version_id)
        .order_by(ProtocolStep.order_index)
    )
    return list(res.scalars().all())
