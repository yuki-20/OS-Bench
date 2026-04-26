"""ai trace + evaluation harness + escalations

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-26
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_traces",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("org_id", sa.String(40), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("run_id", sa.String(40), sa.ForeignKey("runs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("protocol_version_id", sa.String(40), sa.ForeignKey("protocol_versions.id"), nullable=True),
        sa.Column("step_id", sa.String(40), nullable=True),
        sa.Column("task_type", sa.String(60), nullable=False),
        # protocol_compile | hazard_map | conflict_resolve | qa | photo_check | safety_review | report
        sa.Column("model", sa.String(80), nullable=False),
        sa.Column("input_summary", sa.Text, nullable=False, server_default=""),
        sa.Column("source_document_ids", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("source_chunk_ids", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("output_schema", sa.String(80), nullable=False, server_default=""),
        sa.Column("output_json", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("citation_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("citation_coverage", sa.Float, nullable=False, server_default="0"),
        sa.Column("confidence", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("safety_review_json", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("changed_run_state", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("requires_human_review", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("latency_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column("token_input", sa.Integer, nullable=False, server_default="0"),
        sa.Column("token_output", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("actor_id", sa.String(40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ai_trace_org", "ai_traces", ["org_id"])
    op.create_index("ix_ai_trace_run", "ai_traces", ["run_id"])
    op.create_index("ix_ai_trace_task", "ai_traces", ["task_type"])

    op.create_table(
        "escalations",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("org_id", sa.String(40), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("run_id", sa.String(40), sa.ForeignKey("runs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("step_id", sa.String(40), nullable=True),
        sa.Column("kind", sa.String(60), nullable=False),
        # source_conflict | missing_source | visual_mismatch | unauthorized_substitution
        # | hazard_condition | exposure | model_unsupported | manual
        sa.Column("severity", sa.String(40), nullable=False, server_default="standard"),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("notify_roles", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("required_action", sa.Text, nullable=False, server_default=""),
        sa.Column("resolution_state", sa.String(40), nullable=False, server_default="open"),
        sa.Column("resolved_by", sa.String(40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_notes", sa.Text, nullable=True),
        sa.Column("source_event_id", sa.String(40), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_escalation_org", "escalations", ["org_id"])
    op.create_index("ix_escalation_run", "escalations", ["run_id"])
    op.create_index("ix_escalation_state", "escalations", ["resolution_state"])

    op.create_table(
        "evaluation_runs",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("org_id", sa.String(40), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        # protocol_extraction | vision_check | safety_redteam | citation_coverage
        sa.Column("status", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("total_cases", sa.Integer, nullable=False, server_default="0"),
        sa.Column("passed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("failed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("score", sa.Float, nullable=False, server_default="0"),
        sa.Column("target", sa.Float, nullable=False, server_default="0"),
        sa.Column("results_json", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_eval_org", "evaluation_runs", ["org_id"])


def downgrade() -> None:
    op.drop_table("evaluation_runs")
    op.drop_table("escalations")
    op.drop_table("ai_traces")
