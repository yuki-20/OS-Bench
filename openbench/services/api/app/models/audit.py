from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import audit_id
from app.db.base import Base, TimestampedMixin
from app.db.types import JSONB


class AuditLog(Base, TimestampedMixin):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_org", "org_id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=audit_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    actor_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False)
    target_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
