from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import (
    CitationRef,
    ORMModel,
    StepDataField,
    TimerSpec,
    VisualCheck,
)


class ProtocolStepOut(ORMModel):
    id: str
    step_key: str
    order_index: int
    title: str
    instruction: str = ""
    is_skippable: bool = False
    prerequisites_json: List[str] = Field(default_factory=list)
    required_ppe_json: List[str] = Field(default_factory=list)
    controls_json: List[str] = Field(default_factory=list)
    materials_json: List[str] = Field(default_factory=list)
    equipment_json: List[str] = Field(default_factory=list)
    timers_json: List[TimerSpec] = Field(default_factory=list)
    visual_checks_json: List[VisualCheck] = Field(default_factory=list)
    stop_conditions_json: List[str] = Field(default_factory=list)
    expected_observations_json: List[str] = Field(default_factory=list)
    data_capture_schema_json: List[StepDataField] = Field(default_factory=list)
    source_refs_json: List[CitationRef] = Field(default_factory=list)
    confidence_score: float = 0.0
    reviewer_notes: Optional[str] = None


class HazardRuleOut(ORMModel):
    id: str
    step_id: Optional[str] = None
    category: str
    requirement_text: str
    severity: str
    source_refs_json: List[CitationRef] = Field(default_factory=list)


class ProtocolVersionOut(ORMModel):
    id: str
    protocol_id: str
    version_label: str
    status: str
    source_doc_ids: List[str] = Field(default_factory=list)
    summary: Optional[str] = None
    published_at: Optional[datetime] = None
    published_by: Optional[str] = None
    supersedes_version_id: Optional[str] = None


class ProtocolVersionDetail(ProtocolVersionOut):
    name: str
    steps: List[ProtocolStepOut] = Field(default_factory=list)
    hazard_rules: List[HazardRuleOut] = Field(default_factory=list)
    compiler_metadata: dict[str, Any] = Field(default_factory=dict)


class ProtocolOut(ORMModel):
    id: str
    org_id: str
    name: str
    status: str
    versions: List[ProtocolVersionOut] = Field(default_factory=list)


# Compile / draft management ---------------------------------------------------


class DraftCompileRequest(BaseModel):
    name: Optional[str] = None
    document_ids: List[str]


class DraftPatchStepRequest(BaseModel):
    title: Optional[str] = None
    instruction: Optional[str] = None
    is_skippable: Optional[bool] = None
    prerequisites_json: Optional[List[str]] = None
    required_ppe_json: Optional[List[str]] = None
    controls_json: Optional[List[str]] = None
    materials_json: Optional[List[str]] = None
    equipment_json: Optional[List[str]] = None
    timers_json: Optional[List[TimerSpec]] = None
    visual_checks_json: Optional[List[VisualCheck]] = None
    stop_conditions_json: Optional[List[str]] = None
    expected_observations_json: Optional[List[str]] = None
    data_capture_schema_json: Optional[List[StepDataField]] = None
    reviewer_notes: Optional[str] = None


class DraftPatchRequest(BaseModel):
    name: Optional[str] = None
    summary: Optional[str] = None
    add_step: Optional[ProtocolStepOut] = None
    remove_step_id: Optional[str] = None
    patch_step_id: Optional[str] = None
    patch_step: Optional[DraftPatchStepRequest] = None


class PublishResponse(BaseModel):
    protocol_version_id: str
    version_label: str
    status: str
