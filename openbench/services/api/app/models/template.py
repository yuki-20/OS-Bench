from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import short_id
from app.db.base import Base, TimestampedMixin
from app.db.types import JSONB


def template_id() -> str:
    return short_id("tmpl")


class RunTemplate(Base, TimestampedMixin):
    """A saved starting configuration for a run.

    Operators with the right protocol assignment pick a template instead of a
    raw protocol version when they want a known device, default measurements,
    or custom metadata.
    """

    __tablename__ = "run_templates"
    __table_args__ = (Index("ix_run_template_org", "org_id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=template_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    protocol_version_id: Mapped[str] = mapped_column(
        ForeignKey("protocol_versions.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_device_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    default_metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
