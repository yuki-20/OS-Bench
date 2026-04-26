from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import report_id
from app.db.base import Base, TimestampedMixin
from app.db.types import JSONB


class HandoverReport(Base, TimestampedMixin):
    __tablename__ = "handover_reports"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=report_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(40), default="draft", nullable=False)
    # draft | finalized
    report_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    markdown_body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    html_body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    pdf_storage_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
