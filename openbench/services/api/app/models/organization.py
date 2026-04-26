from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.ids import membership_id, org_id
from app.db.base import Base, TimestampedMixin


class Organization(Base, TimestampedMixin):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=org_id)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    data_region: Mapped[str] = mapped_column(String(40), nullable=False, default="local")
    retention_policy_days: Mapped[int] = mapped_column(default=365, nullable=False)
    retention_purged_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Per-org Anthropic key. When set, AI calls for this org use it instead of
    # the global ANTHROPIC_API_KEY env var. Stored plaintext — never returned
    # raw from the API; only a masked preview is exposed.
    anthropic_api_key: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    memberships: Mapped[list["Membership"]] = relationship(back_populates="organization")


class Membership(Base, TimestampedMixin):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("org_id", "user_id", name="uq_membership_org_user"),
        Index("ix_membership_org", "org_id"),
        Index("ix_membership_user", "user_id"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=membership_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(40), nullable=False, default="operator")
    team_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)

    organization: Mapped[Organization] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship(back_populates="memberships")  # type: ignore[name-defined]
