from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import short_id
from app.db.base import Base, TimestampedMixin
from app.db.types import JSONB


def _wh_id() -> str:
    return short_id("wh")


def _whd_id() -> str:
    return short_id("whd")


class WebhookSubscription(Base, TimestampedMixin):
    __tablename__ = "webhook_subscriptions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=_wh_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    target_url: Mapped[str] = mapped_column(String(500), nullable=False)
    event_types: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)


class WebhookDelivery(Base, TimestampedMixin):
    __tablename__ = "webhook_deliveries"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=_whd_id)
    subscription_id: Mapped[str] = mapped_column(ForeignKey("webhook_subscriptions.id"))
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="pending", nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
