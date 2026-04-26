from __future__ import annotations

from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.common import CitationRef, ORMModel

DeviationSeverity = Literal["minor", "moderate", "major", "high", "critical"]


class RunCreateRequest(BaseModel):
    protocol_version_id: str
    device_id: Optional[str] = None


class RunOut(ORMModel):
    id: str
    org_id: str
    protocol_version_id: str
    operator_id: str
    status: str
    current_step_id: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    device_id: Optional[str] = None
    block_reason: Optional[str] = None


class StepStateOut(ORMModel):
    id: str
    run_id: str
    step_id: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    blocked_reason_json: Optional[dict[str, Any]] = None
    confirmations_json: dict[str, Any] = Field(default_factory=dict)
    measurements_json: dict[str, Any] = Field(default_factory=dict)


class RunEventOut(ORMModel):
    id: str
    run_id: str
    event_type: str
    step_id: Optional[str] = None
    actor_id: Optional[str] = None
    payload_json: dict[str, Any] = Field(default_factory=dict)
    server_timestamp: datetime


class TimerOut(ORMModel):
    id: str
    run_id: str
    step_id: Optional[str] = None
    label: str
    duration_seconds: int
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    status: str


class DeviationOut(ORMModel):
    id: str
    run_id: str
    step_id: Optional[str] = None
    severity: str
    title: str
    description: str = ""
    resolution_state: str
    requires_review: bool = False
    attachments_json: List[str] = Field(default_factory=list)
    created_at: datetime


class AttachmentOut(ORMModel):
    id: str
    run_id: Optional[str] = None
    step_id: Optional[str] = None
    kind: str
    storage_path: str
    mime_type: str
    created_at: datetime


class RunDetail(BaseModel):
    run: RunOut
    protocol_version_id: str
    step_states: List[StepStateOut] = Field(default_factory=list)
    timers: List[TimerOut] = Field(default_factory=list)
    deviations: List[DeviationOut] = Field(default_factory=list)
    attachments: List[AttachmentOut] = Field(default_factory=list)
    events: List[RunEventOut] = Field(default_factory=list)
    photo_assessments: List[dict[str, Any]] = Field(default_factory=list)


# Step actions ----------------------------------------------------------------


class IdempotentRequest(BaseModel):
    idempotency_key: Optional[str] = None
    local_seq: Optional[int] = None
    client_timestamp: Optional[datetime] = None


class StepStartRequest(IdempotentRequest):
    pass


class StepCompleteRequest(IdempotentRequest):
    confirmations: dict[str, Any] = Field(default_factory=dict)
    measurements: dict[str, Any] = Field(default_factory=dict)
    override_block: bool = False
    override_reason: Optional[str] = None


class StepSkipRequest(IdempotentRequest):
    reason: str


class NoteAddRequest(IdempotentRequest):
    step_id: Optional[str] = None
    text: str


class MeasurementAddRequest(IdempotentRequest):
    step_id: str
    key: str
    value: Any
    units: Optional[str] = None


class DeviationAddRequest(IdempotentRequest):
    step_id: Optional[str] = None
    severity: DeviationSeverity = "minor"
    title: str = Field(min_length=1, max_length=160)
    description: str = ""
    requires_review: bool = False
    attachment_ids: List[str] = Field(default_factory=list)


class TimerStartRequest(IdempotentRequest):
    step_id: Optional[str] = None
    label: str = Field(default="", max_length=160)
    # Anything outside (0, 1 week] is rejected — defends against accidental 0
    # or runaway timers that the run engine would never satisfy.
    duration_seconds: int = Field(default=60, gt=0, le=604800)


class OverrideRequest(IdempotentRequest):
    step_id: str
    category: str
    reason: str


# AI endpoints ----------------------------------------------------------------


class AskRequest(BaseModel):
    question: str
    context_mode: str = Field(default="current_step_only")  # current_step_only | full_protocol | step
    step_id: Optional[str] = None
    # Optional — if a network retry sends the same key, the event row
    # de-duplicates at the run_engine.append_event layer.
    idempotency_key: Optional[str] = None


class Citation(BaseModel):
    document_id: str
    page_no: Optional[int] = None
    section_label: Optional[str] = None
    chunk_id: Optional[str] = None
    quote_summary: Optional[str] = None


class AskResponse(BaseModel):
    answer_text: str
    citations: List[Citation] = Field(default_factory=list)
    confidence: str = "medium"  # low | medium | high
    escalation_required: bool = False
    suggested_action: Optional[str] = None
    safety_review: dict[str, Any] = Field(default_factory=dict)


class PhotoCheckRequest(BaseModel):
    attachment_id: str
    idempotency_key: Optional[str] = None


class PhotoAssessmentItem(BaseModel):
    check_id: str
    status: str  # confirmed | not_visible | unclear | cannot_verify
    evidence: str = ""
    confidence: str = "medium"


class PhotoAssessmentOut(BaseModel):
    id: str
    run_id: str
    step_id: str
    attachment_id: str
    overall_status: str
    items: List[PhotoAssessmentItem]
    recommended_action: str = ""
    model_metadata: dict[str, Any] = Field(default_factory=dict)


# Handover --------------------------------------------------------------------


class HandoverOut(BaseModel):
    id: str
    run_id: str
    status: str
    report_json: dict[str, Any]
    markdown_body: str
    html_body: str
    pdf_url: Optional[str] = None
    generated_at: Optional[datetime] = None
    finalized_at: Optional[datetime] = None
