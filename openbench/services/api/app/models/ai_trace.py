from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import short_id
from app.db.base import Base
from app.db.types import JSONB


def trace_id() -> str:
    return short_id("trc")


class AITrace(Base):
    __tablename__ = "ai_traces"
    __table_args__ = (
        Index("ix_ai_trace_org", "org_id"),
        Index("ix_ai_trace_run", "run_id"),
        Index("ix_ai_trace_task", "task_type"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=trace_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    run_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("runs.id", ondelete="CASCADE"), nullable=True
    )
    protocol_version_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("protocol_versions.id"), nullable=True
    )
    step_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    task_type: Mapped[str] = mapped_column(String(60), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    input_summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    source_document_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    source_chunk_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    output_schema: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    output_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    citation_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    citation_coverage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    safety_review_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    changed_run_state: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_human_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    token_input: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    token_output: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actor_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.utcnow(), nullable=False
    )
