from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.ids import hazard_id, proto_id, step_id, version_id
from app.db.base import Base, TimestampedMixin
from app.db.types import JSONB


class Protocol(Base, TimestampedMixin):
    __tablename__ = "protocols"
    __table_args__ = (Index("ix_protocol_org", "org_id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=proto_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)

    versions: Mapped[list["ProtocolVersion"]] = relationship(
        back_populates="protocol", cascade="all, delete-orphan"
    )


class ProtocolVersion(Base, TimestampedMixin):
    __tablename__ = "protocol_versions"
    __table_args__ = (Index("ix_pv_protocol", "protocol_id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=version_id)
    protocol_id: Mapped[str] = mapped_column(ForeignKey("protocols.id", ondelete="CASCADE"))
    version_label: Mapped[str] = mapped_column(String(40), default="v1", nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="draft", nullable=False)
    # draft | in_review | published | archived
    source_doc_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    source_docset_hash: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    compiler_metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    published_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    supersedes_version_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("protocol_versions.id"), nullable=True
    )

    protocol: Mapped[Protocol] = relationship(back_populates="versions")
    steps: Mapped[list["ProtocolStep"]] = relationship(
        back_populates="version", cascade="all, delete-orphan", order_by="ProtocolStep.order_index"
    )
    hazard_rules: Mapped[list["HazardRule"]] = relationship(
        back_populates="version", cascade="all, delete-orphan"
    )


class ProtocolStep(Base, TimestampedMixin):
    __tablename__ = "protocol_steps"
    __table_args__ = (Index("ix_step_version", "protocol_version_id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=step_id)
    protocol_version_id: Mapped[str] = mapped_column(
        ForeignKey("protocol_versions.id", ondelete="CASCADE")
    )
    step_key: Mapped[str] = mapped_column(String(40), nullable=False)  # S1, S2, ...
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(400), nullable=False)
    instruction: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_skippable: Mapped[bool] = mapped_column(default=False, nullable=False)
    prerequisites_json: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    required_ppe_json: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    controls_json: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    materials_json: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    equipment_json: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    timers_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    visual_checks_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    stop_conditions_json: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    expected_observations_json: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    data_capture_schema_json: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, nullable=False
    )
    source_refs_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reviewer_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    version: Mapped[ProtocolVersion] = relationship(back_populates="steps")


class HazardRule(Base, TimestampedMixin):
    __tablename__ = "hazard_rules"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=hazard_id)
    protocol_version_id: Mapped[str] = mapped_column(
        ForeignKey("protocol_versions.id", ondelete="CASCADE")
    )
    step_id: Mapped[Optional[str]] = mapped_column(ForeignKey("protocol_steps.id"), nullable=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    requirement_text: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(40), default="standard", nullable=False)
    source_refs_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)

    version: Mapped[ProtocolVersion] = relationship(back_populates="hazard_rules")
