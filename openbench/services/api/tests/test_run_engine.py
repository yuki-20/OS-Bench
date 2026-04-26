"""Pure-function tests for the run state machine and request validators."""
from __future__ import annotations

import os

os.environ.setdefault("USE_SQLITE", "true")
os.environ.setdefault("STORAGE_BACKEND", "local")
os.environ.setdefault("ANTHROPIC_API_KEY", "")

import pytest

from app.schemas.runs import TimerStartRequest
from app.services.run_engine import can_transition_run


def test_run_state_transitions_match_handover_and_override_flow() -> None:
    assert can_transition_run("active", "awaiting_override")
    assert can_transition_run("active", "awaiting_handover")
    assert can_transition_run("active", "completed")  # PRD v3 allows direct completion
    assert can_transition_run("awaiting_handover", "completed")
    assert not can_transition_run("completed", "active")
    assert not can_transition_run("closed", "active")


def test_timer_duration_requires_positive_reasonable_value() -> None:
    with pytest.raises(ValueError):
        TimerStartRequest(idempotency_key="timer-bad", duration_seconds=0)
    with pytest.raises(ValueError):
        TimerStartRequest(idempotency_key="timer-huge", duration_seconds=604801)
    assert (
        TimerStartRequest(idempotency_key="timer-good", duration_seconds=60).duration_seconds == 60
    )
