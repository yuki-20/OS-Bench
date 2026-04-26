from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import short_id
from app.db.base import Base, TimestampedMixin
from app.db.types import JSONB


def escalation_id() -> str:
    return short_id("esc")


def eval_run_id() -> str:
    return short_id("ev")


class Escalation(Base, TimestampedMixin):
    __tablename__ = "escalations"
    __table_args__ = (
        Index("ix_escalation_org", "org_id"),
        Index("ix_escalation_run", "run_id"),
        Index("ix_escalation_state", "resolution_state"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=escalation_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    run_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("runs.id", ondelete="CASCADE"), nullable=True
    )
    step_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    kind: Mapped[str] = mapped_column(String(60), nullable=False)
    severity: Mapped[str] = mapped_column(String(40), default="standard", nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    notify_roles: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    required_action: Mapped[str] = mapped_column(Text, default="", nullable=False)
    resolution_state: Mapped[str] = mapped_column(String(40), default="open", nullable=False)
    resolved_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_event_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"
    __table_args__ = (Index("ix_eval_org", "org_id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=eval_run_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="pending", nullable=False)
    total_cases: Mapped[int] = mapped_column(default=0, nullable=False)
    passed: Mapped[int] = mapped_column(default=0, nullable=False)
    failed: Mapped[int] = mapped_column(default=0, nullable=False)
    score: Mapped[float] = mapped_column(default=0.0, nullable=False)
    target: Mapped[float] = mapped_column(default=0.0, nullable=False)
    results_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.utcnow(), nullable=False
    )
