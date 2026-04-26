from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class Page(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int = 1
    page_size: int = 50


class CitationRef(BaseModel):
    document_id: str
    page_no: Optional[int] = None
    section_label: Optional[str] = None
    chunk_id: Optional[str] = None
    quote_summary: Optional[str] = None


class VisualCheck(BaseModel):
    check_id: str
    claim: str
    required: bool = True
    rationale: Optional[str] = None


class TimerSpec(BaseModel):
    label: str
    duration_seconds: int
    auto_start: bool = False


class StepDataField(BaseModel):
    key: str
    label: str
    kind: str = Field(default="text", description="text | number | boolean | choice")
    units: Optional[str] = None
    options: Optional[list[str]] = None
    required: bool = False


class IDOnly(BaseModel):
    id: str


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
    payload: Optional[dict[str, Any]] = None


class HealthResponse(BaseModel):
    status: str = "ok"
    app_name: str
    app_env: str
    timestamp: datetime
