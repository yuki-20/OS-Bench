"""run_templates + retention_purged_at column

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-26
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "run_templates",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("org_id", sa.String(40), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("protocol_version_id", sa.String(40), sa.ForeignKey("protocol_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("default_device_id", sa.String(80), nullable=True),
        sa.Column("default_metadata", postgresql.JSONB().with_variant(sa.JSON(), "sqlite"), nullable=False, server_default="{}"),
        sa.Column("created_by", sa.String(40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_run_template_org", "run_templates", ["org_id"])

    # Bookkeeping for retention purges so reviewers can see when last-run was.
    op.add_column(
        "organizations",
        sa.Column("retention_purged_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("organizations", "retention_purged_at")
    op.drop_index("ix_run_template_org", table_name="run_templates")
    op.drop_table("run_templates")
