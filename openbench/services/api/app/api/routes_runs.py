from __future__ import annotations

from datetime import datetime
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentContext, current_context
from app.core.ids import deviation_id, run_id, timer_id
from app.db.session import get_db
from app.models.protocol import Protocol, ProtocolVersion
from app.models.run import (
    Attachment,
    Deviation,
    PhotoAssessment,
    Run,
    RunEvent,
    StepState,
    Timer,
)
from app.schemas.runs import (
    AttachmentOut,
    DeviationAddRequest,
    DeviationOut,
    MeasurementAddRequest,
    NoteAddRequest,
    OverrideRequest,
    RunCreateRequest,
    RunDetail,
    RunEventOut,
    RunOut,
    StepCompleteRequest,
    StepSkipRequest,
    StepStartRequest,
    StepStateOut,
    TimerOut,
    TimerStartRequest,
)
from app.services.audit import record_audit
from app.services.escalation import create_escalation
from app.services.run_engine import (
    append_event,
    can_transition_run,
    evaluate_step_completion,
    get_or_create_step_state,
    get_step,
    list_protocol_steps,
)
from app.services.webhook import fan_out

router = APIRouter(prefix="/api/runs", tags=["runs"])


# --- Run lifecycle ------------------------------------------------------------


@router.post("", response_model=RunOut)
async def create_run(
    payload: RunCreateRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunOut:
    pv = (
        await session.execute(
            select(ProtocolVersion).where(ProtocolVersion.id == payload.protocol_version_id)
        )
    ).scalar_one_or_none()
    if pv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Protocol version not found")
    proto = (await session.execute(select(Protocol).where(Protocol.id == pv.protocol_id))).scalar_one()
    if proto.org_id != ctx.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Protocol version not found")
    if pv.status != "published":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only published versions can be run")
    run = Run(
        id=run_id(),
        org_id=ctx.org_id,
        protocol_version_id=pv.id,
        operator_id=ctx.user_id,
        status="created",
        device_id=payload.device_id,
    )
    session.add(run)
    await session.flush()
    await append_event(
        session,
        run_id=run.id,
        event_type="run_created",
        actor_id=ctx.user_id,
        payload={"protocol_version_id": pv.id, "device_id": payload.device_id},
    )
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="run.create",
        target_type="run",
        target_id=run.id,
        metadata={"protocol_version_id": pv.id},
    )
    await session.commit()
    await fan_out(session, org_id=ctx.org_id, event_type="run_created", payload={"run_id": run.id})
    await session.commit()
    return RunOut.model_validate(run)


@router.get("/{run_id}", response_model=RunDetail)
async def get_run(
    run_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunDetail:
    run, _ = await _get_run(session, run_id, ctx.org_id)
    return await _build_detail(session, run)


@router.get("", response_model=List[RunOut])
async def list_runs(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = None,
) -> List[RunOut]:
    stmt = select(Run).where(Run.org_id == ctx.org_id).order_by(Run.created_at.desc())
    if status_filter:
        stmt = stmt.where(Run.status == status_filter)
    res = await session.execute(stmt)
    return [RunOut.model_validate(r) for r in res.scalars().all()]


@router.post("/{run_id}/preflight", response_model=RunDetail)
async def enter_preflight(
    run_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunDetail:
    """Transition run from `created` -> `preflight` and produce checklist data.

    Preflight is the explicit gate before active execution per PRD 17.2.1: source
    completeness, sync status, required acknowledgements, pending safety notices.
    """
    run, pv = await _get_run(session, run_id, ctx.org_id)
    if run.status not in ("created", "preflight"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot enter preflight from {run.status}")
    if run.status == "created":
        run.status = "preflight"
        await append_event(
            session,
            run_id=run.id,
            event_type="run_preflight_entered",
            actor_id=ctx.user_id,
            payload={"protocol_version_id": pv.id},
        )
        await session.commit()
    return await _build_detail(session, run)


@router.post("/{run_id}/start", response_model=RunOut)
async def start_run(
    run_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunOut:
    run, pv = await _get_run(session, run_id, ctx.org_id)
    if run.status not in ("created", "preflight"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot start from {run.status}")
    steps = await list_protocol_steps(session, pv.id)
    if not steps:
        raise HTTPException(status.HTTP_409_CONFLICT, "Protocol has no steps")
    if run.status == "created":
        # Move briefly through preflight so the timeline records both transitions.
        run.status = "preflight"
        await append_event(
            session,
            run_id=run.id,
            event_type="run_preflight_entered",
            actor_id=ctx.user_id,
            payload={"auto": True},
        )
    run.status = "active"
    run.started_at = datetime.utcnow()
    run.current_step_id = steps[0].id
    await get_or_create_step_state(session, run.id, steps[0].id)
    await append_event(
        session,
        run_id=run.id,
        event_type="run_started",
        actor_id=ctx.user_id,
        payload={"first_step_id": steps[0].id},
    )
    await session.commit()
    await fan_out(session, org_id=ctx.org_id, event_type="run_started", payload={"run_id": run.id})
    await session.commit()
    return RunOut.model_validate(run)


@router.post("/{run_id}/pause", response_model=RunOut)
async def pause_run(
    run_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunOut:
    run, _ = await _get_run(session, run_id, ctx.org_id)
    if not can_transition_run(run.status, "paused"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot pause from {run.status}")
    run.status = "paused"
    await append_event(session, run_id=run.id, event_type="run_paused", actor_id=ctx.user_id)
    await session.commit()
    await fan_out(session, org_id=ctx.org_id, event_type="run_paused", payload={"run_id": run.id})
    await session.commit()
    return RunOut.model_validate(run)


@router.post("/{run_id}/resume", response_model=RunOut)
async def resume_run(
    run_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunOut:
    run, _ = await _get_run(session, run_id, ctx.org_id)
    if not can_transition_run(run.status, "active"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot resume from {run.status}")
    run.status = "active"
    run.block_reason = None
    await append_event(session, run_id=run.id, event_type="run_resumed", actor_id=ctx.user_id)
    await session.commit()
    await fan_out(session, org_id=ctx.org_id, event_type="run_resumed", payload={"run_id": run.id})
    await session.commit()
    return RunOut.model_validate(run)


@router.post("/{run_id}/cancel", response_model=RunOut)
async def cancel_run(
    run_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunOut:
    run, _ = await _get_run(session, run_id, ctx.org_id)
    if not can_transition_run(run.status, "cancelled"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot cancel from {run.status}")
    run.status = "cancelled"
    run.ended_at = datetime.utcnow()
    await append_event(session, run_id=run.id, event_type="run_cancelled", actor_id=ctx.user_id)
    await session.commit()
    await fan_out(session, org_id=ctx.org_id, event_type="run_cancelled", payload={"run_id": run.id})
    await session.commit()
    return RunOut.model_validate(run)


# --- Steps -------------------------------------------------------------------


@router.post("/{run_id}/steps/{step_id}/start", response_model=RunDetail)
async def start_step(
    run_id: str,
    step_id: str,
    payload: StepStartRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunDetail:
    run, pv = await _get_run(session, run_id, ctx.org_id)
    if run.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "Run not active")
    try:
        step = await get_step(session, step_id, protocol_version_id=pv.id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Step not found for this protocol version")
    state = await get_or_create_step_state(session, run.id, step.id)
    if state.status not in ("not_started", "blocked"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot start step from {state.status}")
    state.status = "in_progress"
    state.started_at = datetime.utcnow()
    run.current_step_id = step.id
    await append_event(
        session,
        run_id=run.id,
        event_type="step_started",
        actor_id=ctx.user_id,
        step_id=step.id,
        idempotency_key=payload.idempotency_key,
        local_seq=payload.local_seq,
        client_timestamp=payload.client_timestamp,
        payload={"step_key": step.step_key},
    )
    await session.commit()
    await fan_out(
        session,
        org_id=ctx.org_id,
        event_type="step_started",
        payload={"run_id": run.id, "step_id": step.id},
    )
    await session.commit()
    return await _build_detail(session, run)


@router.post("/{run_id}/steps/{step_id}/complete", response_model=RunDetail)
async def complete_step(
    run_id: str,
    step_id: str,
    payload: StepCompleteRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunDetail:
    run, pv = await _get_run(session, run_id, ctx.org_id)
    # Guard: a run that has not started (or is closed/completed/cancelled) cannot
    # have its steps completed. Without this check, a caller could transition a
    # `created` run straight to `completed` and bypass preflight + start.
    if run.status not in ("active", "blocked", "awaiting_override"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot complete a step while run is {run.status}",
        )
    try:
        step = await get_step(session, step_id, protocol_version_id=pv.id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Step not found for this protocol version")
    state = await get_or_create_step_state(session, run.id, step.id)
    state.confirmations_json = {**(state.confirmations_json or {}), **(payload.confirmations or {})}
    state.measurements_json = {**(state.measurements_json or {}), **(payload.measurements or {})}

    primary_idem = payload.idempotency_key
    derived = lambda suffix: f"{primary_idem}:{suffix}" if primary_idem else None

    ok, reason = await evaluate_step_completion(session, run, step, state)
    if not ok and not payload.override_block:
        state.status = "blocked"
        state.blocked_reason_json = {"reason": reason, "checked_at": datetime.utcnow().isoformat()}
        run.status = "blocked"
        run.block_reason = reason
        await append_event(
            session,
            run_id=run.id,
            event_type="block_triggered",
            actor_id=ctx.user_id,
            step_id=step.id,
            payload={"reason": reason},
            idempotency_key=derived("block"),
            local_seq=payload.local_seq,
            client_timestamp=payload.client_timestamp,
        )
        await session.commit()
        await fan_out(
            session,
            org_id=ctx.org_id,
            event_type="run_blocked",
            payload={"run_id": run.id, "reason": reason, "step_id": step.id},
        )
        await session.commit()
        raise HTTPException(status.HTTP_409_CONFLICT, f"Step blocked: {reason}")

    if not ok and payload.override_block:
        # operator overrode a block — record explicitly
        await append_event(
            session,
            run_id=run.id,
            event_type="override_resolved",
            actor_id=ctx.user_id,
            step_id=step.id,
            payload={"reason": payload.override_reason or "operator_override", "blocker": reason},
            idempotency_key=derived("override"),
        )

    state.status = "completed"
    state.completed_at = datetime.utcnow()
    state.blocked_reason_json = None
    run.block_reason = None

    # Advance run.current_step_id to next non-completed step
    steps = await list_protocol_steps(session, pv.id)
    next_step = None
    seen = False
    for s in steps:
        if seen:
            next_step = s
            break
        if s.id == step.id:
            seen = True
    if next_step is None:
        # All steps complete
        run.status = "completed"
        run.ended_at = datetime.utcnow()
        run.current_step_id = None
        await append_event(
            session,
            run_id=run.id,
            event_type="run_completed",
            actor_id=ctx.user_id,
            payload={"final_step_id": step.id},
            idempotency_key=derived("run_completed"),
        )
    else:
        run.current_step_id = next_step.id
        run.status = "active"
        await get_or_create_step_state(session, run.id, next_step.id)

    await append_event(
        session,
        run_id=run.id,
        event_type="step_completed",
        actor_id=ctx.user_id,
        step_id=step.id,
        idempotency_key=payload.idempotency_key,
        local_seq=payload.local_seq,
        client_timestamp=payload.client_timestamp,
        payload={
            "step_key": step.step_key,
            "confirmations": payload.confirmations or {},
            "measurements": payload.measurements or {},
            "override_block": bool(payload.override_block),
        },
    )
    await session.commit()
    await fan_out(
        session,
        org_id=ctx.org_id,
        event_type="step_completed",
        payload={"run_id": run.id, "step_id": step.id},
    )
    if run.status == "completed":
        await fan_out(
            session, org_id=ctx.org_id, event_type="run_completed", payload={"run_id": run.id}
        )
    await session.commit()
    return await _build_detail(session, run)


@router.post("/{run_id}/steps/{step_id}/skip", response_model=RunDetail)
async def skip_step(
    run_id: str,
    step_id: str,
    payload: StepSkipRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunDetail:
    run, pv = await _get_run(session, run_id, ctx.org_id)
    if run.status not in ("active", "blocked", "awaiting_override"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot skip a step while run is {run.status}",
        )
    try:
        step = await get_step(session, step_id, protocol_version_id=pv.id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Step not found for this protocol version")
    state = await get_or_create_step_state(session, run.id, step.id)
    if not step.is_skippable:
        # convert to override request
        await append_event(
            session,
            run_id=run.id,
            event_type="override_requested",
            actor_id=ctx.user_id,
            step_id=step.id,
            payload={"category": "skip_non_skippable", "reason": payload.reason},
            idempotency_key=payload.idempotency_key,
        )
        run.status = "awaiting_override"
        run.block_reason = "Skip requested for non-skippable step"
        await session.commit()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Step is not skippable; override requested instead"
        )
    state.status = "skipped"
    state.completed_at = datetime.utcnow()
    await append_event(
        session,
        run_id=run.id,
        event_type="step_completed",
        actor_id=ctx.user_id,
        step_id=step.id,
        payload={"skipped": True, "reason": payload.reason},
        idempotency_key=payload.idempotency_key,
        local_seq=payload.local_seq,
        client_timestamp=payload.client_timestamp,
    )

    # Advance to next step or finish
    steps = await list_protocol_steps(session, pv.id)
    next_step = None
    seen = False
    for s in steps:
        if seen:
            next_step = s
            break
        if s.id == step.id:
            seen = True
    if next_step is None:
        run.status = "completed"
        run.ended_at = datetime.utcnow()
        run.current_step_id = None
    else:
        run.current_step_id = next_step.id
    await session.commit()
    return await _build_detail(session, run)


# --- Notes / measurements / deviations / timers / overrides -----------------


@router.post("/{run_id}/notes", response_model=RunEventOut)
async def add_note(
    run_id: str,
    payload: NoteAddRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunEventOut:
    run, _ = await _get_run(session, run_id, ctx.org_id)
    ev = await append_event(
        session,
        run_id=run.id,
        event_type="note_added",
        actor_id=ctx.user_id,
        step_id=payload.step_id or run.current_step_id,
        payload={"text": payload.text},
        idempotency_key=payload.idempotency_key,
        local_seq=payload.local_seq,
        client_timestamp=payload.client_timestamp,
    )
    await session.commit()
    return RunEventOut.model_validate(ev)


@router.post("/{run_id}/measurements", response_model=RunEventOut)
async def add_measurement(
    run_id: str,
    payload: MeasurementAddRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunEventOut:
    run, _ = await _get_run(session, run_id, ctx.org_id)
    state = await get_or_create_step_state(session, run.id, payload.step_id)
    state.measurements_json = {
        **(state.measurements_json or {}),
        payload.key: {"value": payload.value, "units": payload.units},
    }
    ev = await append_event(
        session,
        run_id=run.id,
        event_type="measurement_recorded",
        actor_id=ctx.user_id,
        step_id=payload.step_id,
        payload={"key": payload.key, "value": payload.value, "units": payload.units},
        idempotency_key=payload.idempotency_key,
    )
    await session.commit()
    return RunEventOut.model_validate(ev)


@router.post("/{run_id}/deviations", response_model=DeviationOut)
async def add_deviation(
    run_id: str,
    payload: DeviationAddRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> DeviationOut:
    run, _ = await _get_run(session, run_id, ctx.org_id)

    # Idempotency: if a prior event with this key exists, return the deviation it references.
    if payload.idempotency_key:
        prior = (
            await session.execute(
                select(RunEvent).where(
                    RunEvent.run_id == run.id,
                    RunEvent.idempotency_key == payload.idempotency_key,
                )
            )
        ).scalar_one_or_none()
        if prior is not None:
            prior_id = (prior.payload_json or {}).get("id")
            if prior_id:
                existing = (
                    await session.execute(select(Deviation).where(Deviation.id == prior_id))
                ).scalar_one_or_none()
                if existing is not None:
                    return DeviationOut.model_validate(existing)

    derived = (
        (lambda suffix: f"{payload.idempotency_key}:{suffix}")
        if payload.idempotency_key
        else (lambda suffix: None)
    )

    deviation = Deviation(
        id=deviation_id(),
        run_id=run.id,
        step_id=payload.step_id,
        severity=payload.severity,
        title=payload.title,
        description=payload.description,
        requires_review=payload.requires_review or payload.severity in ("high", "critical"),
        created_by=ctx.user_id,
        attachments_json=list(payload.attachment_ids or []),
    )
    session.add(deviation)
    await session.flush()
    await append_event(
        session,
        run_id=run.id,
        event_type="deviation_added",
        actor_id=ctx.user_id,
        step_id=payload.step_id,
        payload={
            "id": deviation.id,
            "severity": payload.severity,
            "title": payload.title,
            "requires_review": deviation.requires_review,
        },
        idempotency_key=payload.idempotency_key,
    )
    if payload.severity in ("critical",):
        run.status = "blocked"
        run.block_reason = f"Critical deviation: {payload.title}"
        await append_event(
            session,
            run_id=run.id,
            event_type="block_triggered",
            actor_id=ctx.user_id,
            payload={"reason": run.block_reason},
            idempotency_key=derived("block"),
        )
        kind = "exposure_or_incident" if any(
            tok in (payload.title + " " + payload.description).lower()
            for tok in ("spill", "exposure", "fire", "injury", "leak")
        ) else "hazard_condition"
        await create_escalation(
            session,
            org_id=ctx.org_id,
            kind=kind,
            title=f"Critical deviation: {payload.title}"[:300],
            description=payload.description[:500],
            run_id=run.id,
            step_id=payload.step_id,
            actor_id=ctx.user_id,
            metadata={"deviation_id": deviation.id},
        )
    elif payload.severity in ("high",):
        await create_escalation(
            session,
            org_id=ctx.org_id,
            kind="manual",
            title=f"High deviation: {payload.title}"[:300],
            description=payload.description[:500],
            run_id=run.id,
            step_id=payload.step_id,
            severity="high",
            actor_id=ctx.user_id,
            metadata={"deviation_id": deviation.id},
        )
    await session.commit()
    await fan_out(
        session,
        org_id=ctx.org_id,
        event_type="deviation_added",
        payload={"run_id": run.id, "deviation_id": deviation.id, "severity": payload.severity},
    )
    await session.commit()
    return DeviationOut.model_validate(deviation)


@router.post("/{run_id}/timers", response_model=TimerOut)
async def start_timer(
    run_id: str,
    payload: TimerStartRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TimerOut:
    run, _ = await _get_run(session, run_id, ctx.org_id)

    # Idempotency: if a prior timer_started event matches the key, return its timer.
    if payload.idempotency_key:
        prior = (
            await session.execute(
                select(RunEvent).where(
                    RunEvent.run_id == run.id,
                    RunEvent.idempotency_key == payload.idempotency_key,
                )
            )
        ).scalar_one_or_none()
        if prior is not None:
            prior_id = (prior.payload_json or {}).get("timer_id")
            if prior_id:
                existing = (
                    await session.execute(select(Timer).where(Timer.id == prior_id))
                ).scalar_one_or_none()
                if existing is not None:
                    return TimerOut.model_validate(existing)

    timer = Timer(
        id=timer_id(),
        run_id=run.id,
        step_id=payload.step_id or run.current_step_id,
        label=payload.label or "",
        duration_seconds=payload.duration_seconds,
        started_at=datetime.utcnow(),
        status="running",
    )
    session.add(timer)
    await session.flush()
    await append_event(
        session,
        run_id=run.id,
        event_type="timer_started",
        actor_id=ctx.user_id,
        step_id=timer.step_id,
        payload={"timer_id": timer.id, "label": timer.label, "duration_seconds": timer.duration_seconds},
        idempotency_key=payload.idempotency_key,
    )
    await session.commit()
    return TimerOut.model_validate(timer)


@router.post("/{run_id}/timers/{timer_id}/elapsed", response_model=TimerOut)
async def timer_elapsed(
    run_id: str,
    timer_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TimerOut:
    run, _ = await _get_run(session, run_id, ctx.org_id)
    timer = (
        await session.execute(select(Timer).where(Timer.id == timer_id, Timer.run_id == run.id))
    ).scalar_one_or_none()
    if timer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Timer not found")
    timer.status = "elapsed"
    timer.ended_at = datetime.utcnow()
    await append_event(
        session,
        run_id=run.id,
        event_type="timer_elapsed",
        actor_id=ctx.user_id,
        step_id=timer.step_id,
        payload={"timer_id": timer.id},
    )
    await session.commit()
    return TimerOut.model_validate(timer)


@router.post("/{run_id}/override-requests", response_model=RunEventOut)
async def request_override(
    run_id: str,
    payload: OverrideRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RunEventOut:
    run, _ = await _get_run(session, run_id, ctx.org_id)
    ev = await append_event(
        session,
        run_id=run.id,
        event_type="override_requested",
        actor_id=ctx.user_id,
        step_id=payload.step_id,
        payload={"category": payload.category, "reason": payload.reason},
        idempotency_key=payload.idempotency_key,
    )
    run.status = "awaiting_override"
    run.block_reason = f"Override requested ({payload.category}): {payload.reason}"
    kind = "unauthorized_substitution" if "substitut" in payload.category.lower() else "manual"
    await create_escalation(
        session,
        org_id=ctx.org_id,
        kind=kind,
        title=f"Override requested: {payload.category}"[:300],
        description=payload.reason[:500],
        run_id=run.id,
        step_id=payload.step_id,
        actor_id=ctx.user_id,
        source_event_id=ev.id,
    )
    await session.commit()
    await fan_out(
        session,
        org_id=ctx.org_id,
        event_type="override_requested",
        payload={
            "run_id": run.id,
            "category": payload.category,
            "reason": payload.reason,
            "step_id": payload.step_id,
        },
    )
    await session.commit()
    return RunEventOut.model_validate(ev)


@router.post("/{run_id}/override-requests/{event_id}/resolve", response_model=RunOut)
async def resolve_override(
    run_id: str,
    event_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    decision: str = "approved",  # "approved" | "denied"
    notes: str | None = None,
) -> RunOut:
    ctx.require_min("manager")
    run, _ = await _get_run(session, run_id, ctx.org_id)
    res = await session.execute(
        select(RunEvent).where(RunEvent.id == event_id, RunEvent.run_id == run.id)
    )
    event = res.scalar_one_or_none()
    if event is None or event.event_type != "override_requested":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Override request not found")
    await append_event(
        session,
        run_id=run.id,
        event_type="override_resolved",
        actor_id=ctx.user_id,
        step_id=event.step_id,
        payload={
            "decision": decision,
            "notes": notes or "",
            "request_event_id": event.id,
        },
    )
    if decision == "approved":
        run.status = "active"
        run.block_reason = None
    else:
        run.status = "blocked"
        run.block_reason = "Override denied"
    await session.commit()
    return RunOut.model_validate(run)


# --- detail helper -----------------------------------------------------------


async def _get_run(session: AsyncSession, rid: str, org_id: str) -> tuple[Run, ProtocolVersion]:
    run = (await session.execute(select(Run).where(Run.id == rid))).scalar_one_or_none()
    if run is None or run.org_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    pv = (
        await session.execute(select(ProtocolVersion).where(ProtocolVersion.id == run.protocol_version_id))
    ).scalar_one()
    return run, pv


async def _build_detail(session: AsyncSession, run: Run) -> RunDetail:
    states = (
        (await session.execute(select(StepState).where(StepState.run_id == run.id)))
        .scalars()
        .all()
    )
    timers = (
        (await session.execute(select(Timer).where(Timer.run_id == run.id))).scalars().all()
    )
    deviations = (
        (await session.execute(select(Deviation).where(Deviation.run_id == run.id)))
        .scalars()
        .all()
    )
    attachments = (
        (await session.execute(select(Attachment).where(Attachment.run_id == run.id)))
        .scalars()
        .all()
    )
    events = (
        (
            await session.execute(
                select(RunEvent)
                .where(RunEvent.run_id == run.id)
                .order_by(RunEvent.server_timestamp)
            )
        )
        .scalars()
        .all()
    )
    assessments = (
        (await session.execute(select(PhotoAssessment).where(PhotoAssessment.run_id == run.id)))
        .scalars()
        .all()
    )
    return RunDetail(
        run=RunOut.model_validate(run),
        protocol_version_id=run.protocol_version_id,
        step_states=[StepStateOut.model_validate(s) for s in states],
        timers=[TimerOut.model_validate(t) for t in timers],
        deviations=[DeviationOut.model_validate(d) for d in deviations],
        attachments=[AttachmentOut.model_validate(a) for a in attachments],
        events=[RunEventOut.model_validate(e) for e in events],
        photo_assessments=[
            {
                "id": a.id,
                "step_id": a.step_id,
                "attachment_id": a.attachment_id,
                "overall_status": a.overall_status,
                "items": a.items_json,
                "recommended_action": a.recommended_action,
            }
            for a in assessments
        ],
    )
