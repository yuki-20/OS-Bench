from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.ids import (
    assessment_id,
    att_id,
    deviation_id,
    event_id,
    run_id,
    step_state_id,
    timer_id,
)
from app.db.base import Base, TimestampedMixin
from app.db.types import JSONB


class Run(Base, TimestampedMixin):
    __tablename__ = "runs"
    __table_args__ = (Index("ix_run_org", "org_id"), Index("ix_run_protocol_version", "protocol_version_id"))

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=run_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    protocol_version_id: Mapped[str] = mapped_column(ForeignKey("protocol_versions.id"))
    operator_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(40), default="created", nullable=False)
    # created | preflight | active | paused | blocked | awaiting_override | awaiting_handover | completed | cancelled | closed
    current_step_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    device_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    block_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    events: Mapped[list["RunEvent"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="RunEvent.server_timestamp"
    )
    step_states: Mapped[list["StepState"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )
    timers: Mapped[list["Timer"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    deviations: Mapped[list["Deviation"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )
    attachments: Mapped[list["Attachment"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )
    photo_assessments: Mapped[list["PhotoAssessment"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class RunEvent(Base):
    __tablename__ = "run_events"
    __table_args__ = (
        UniqueConstraint("run_id", "idempotency_key", name="uq_run_event_idem"),
        Index("ix_run_event_run", "run_id"),
        Index("ix_run_event_type", "event_type"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=event_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"))
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    step_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    actor_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    device_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    local_seq: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    client_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    server_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.utcnow(), nullable=False
    )

    run: Mapped[Run] = relationship(back_populates="events")


class StepState(Base, TimestampedMixin):
    __tablename__ = "step_state"
    __table_args__ = (
        UniqueConstraint("run_id", "step_id", name="uq_step_state_run_step"),
        Index("ix_step_state_run", "run_id"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=step_state_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"))
    step_id: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="not_started", nullable=False)
    # not_started | in_progress | waiting_on_timer | waiting_on_checkpoint | blocked | completed | skipped
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    blocked_reason_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    confirmations_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    measurements_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    run: Mapped[Run] = relationship(back_populates="step_states")


class Timer(Base, TimestampedMixin):
    __tablename__ = "timers"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=timer_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"))
    step_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    label: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="running", nullable=False)

    run: Mapped[Run] = relationship(back_populates="timers")


class Deviation(Base, TimestampedMixin):
    __tablename__ = "deviations"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=deviation_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"))
    step_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    severity: Mapped[str] = mapped_column(String(40), default="minor", nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    resolution_state: Mapped[str] = mapped_column(String(40), default="open", nullable=False)
    requires_review: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    attachments_json: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    run: Mapped[Run] = relationship(back_populates="deviations")


class Attachment(Base, TimestampedMixin):
    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=att_id)
    run_id: Mapped[Optional[str]] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), nullable=True)
    step_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    kind: Mapped[str] = mapped_column(String(40), default="photo", nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), default="image/jpeg", nullable=False)
    checksum: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)

    run: Mapped[Optional[Run]] = relationship(back_populates="attachments")


class PhotoAssessment(Base, TimestampedMixin):
    __tablename__ = "photo_assessments"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=assessment_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"))
    step_id: Mapped[str] = mapped_column(String(40), nullable=False)
    attachment_id: Mapped[str] = mapped_column(ForeignKey("attachments.id", ondelete="CASCADE"))
    overall_status: Mapped[str] = mapped_column(String(40), default="pending", nullable=False)
    items_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    recommended_action: Mapped[str] = mapped_column(Text, default="", nullable=False)
    model_metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    run: Mapped[Run] = relationship(back_populates="photo_assessments")
