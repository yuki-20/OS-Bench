"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-25
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "organizations",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
        sa.Column("data_region", sa.String(40), nullable=False, server_default="local"),
        sa.Column("retention_policy_days", sa.Integer, nullable=False, server_default="365"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("password_hash", sa.String(200), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "memberships",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("org_id", sa.String(40), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(40), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(40), nullable=False, server_default="operator"),
        sa.Column("team_id", sa.String(40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "user_id", name="uq_membership_org_user"),
    )
    op.create_index("ix_membership_org", "memberships", ["org_id"])
    op.create_index("ix_membership_user", "memberships", ["user_id"])

    op.create_table(
        "documents",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("org_id", sa.String(40), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_type", sa.String(40), nullable=False, server_default="unknown"),
        sa.Column("title", sa.String(400), nullable=False, server_default=""),
        sa.Column("declared_version", sa.String(80), nullable=True),
        sa.Column("checksum", sa.String(80), nullable=False, server_default=""),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("page_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("parse_status", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("ocr_status", sa.String(40), nullable=False, server_default="not_required"),
        sa.Column("parse_metadata", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("extracted_text", sa.Text, nullable=False, server_default=""),
        sa.Column("created_by", sa.String(40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_document_org", "documents", ["org_id"])

    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("document_id", sa.String(40), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column("page_no", sa.Integer, nullable=True),
        sa.Column("section_label", sa.String(200), nullable=True),
        sa.Column("chunk_text", sa.Text, nullable=False),
        sa.Column("citation_json", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("embedding", Vector(384), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_chunk_doc", "document_chunks", ["document_id"])

    # FTS index for chunks
    op.execute(
        "CREATE INDEX ix_chunk_text_fts ON document_chunks USING gin (to_tsvector('english', chunk_text))"
    )

    op.create_table(
        "protocols",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("org_id", sa.String(40), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="active"),
        sa.Column("created_by", sa.String(40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_protocol_org", "protocols", ["org_id"])

    op.create_table(
        "protocol_versions",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("protocol_id", sa.String(40), sa.ForeignKey("protocols.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_label", sa.String(40), nullable=False, server_default="v1"),
        sa.Column("status", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("source_doc_ids", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("source_docset_hash", sa.String(80), nullable=True),
        sa.Column("compiler_metadata", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("published_by", sa.String(40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("supersedes_version_id", sa.String(40), sa.ForeignKey("protocol_versions.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_pv_protocol", "protocol_versions", ["protocol_id"])

    op.create_table(
        "protocol_steps",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("protocol_version_id", sa.String(40), sa.ForeignKey("protocol_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_key", sa.String(40), nullable=False),
        sa.Column("order_index", sa.Integer, nullable=False),
        sa.Column("title", sa.String(400), nullable=False),
        sa.Column("instruction", sa.Text, nullable=False, server_default=""),
        sa.Column("is_skippable", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("prerequisites_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("required_ppe_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("controls_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("materials_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("equipment_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("timers_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("visual_checks_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("stop_conditions_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("expected_observations_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("data_capture_schema_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("source_refs_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("confidence_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("reviewer_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_step_version", "protocol_steps", ["protocol_version_id"])

    op.create_table(
        "hazard_rules",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("protocol_version_id", sa.String(40), sa.ForeignKey("protocol_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_id", sa.String(40), sa.ForeignKey("protocol_steps.id"), nullable=True),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("requirement_text", sa.Text, nullable=False),
        sa.Column("severity", sa.String(40), nullable=False, server_default="standard"),
        sa.Column("source_refs_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "runs",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("org_id", sa.String(40), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("protocol_version_id", sa.String(40), sa.ForeignKey("protocol_versions.id"), nullable=False),
        sa.Column("operator_id", sa.String(40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="created"),
        sa.Column("current_step_id", sa.String(40), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("device_id", sa.String(80), nullable=True),
        sa.Column("block_reason", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_run_org", "runs", ["org_id"])
    op.create_index("ix_run_protocol_version", "runs", ["protocol_version_id"])

    op.create_table(
        "run_events",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("run_id", sa.String(40), sa.ForeignKey("runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("step_id", sa.String(40), nullable=True),
        sa.Column("actor_id", sa.String(40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("device_id", sa.String(80), nullable=True),
        sa.Column("local_seq", sa.Integer, nullable=True),
        sa.Column("idempotency_key", sa.String(80), nullable=True),
        sa.Column("payload_json", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("client_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("server_timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("run_id", "idempotency_key", name="uq_run_event_idem"),
    )
    op.create_index("ix_run_event_run", "run_events", ["run_id"])
    op.create_index("ix_run_event_type", "run_events", ["event_type"])

    op.create_table(
        "step_state",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("run_id", sa.String(40), sa.ForeignKey("runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_id", sa.String(40), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="not_started"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("blocked_reason_json", postgresql.JSONB, nullable=True),
        sa.Column("confirmations_json", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("measurements_json", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("run_id", "step_id", name="uq_step_state_run_step"),
    )
    op.create_index("ix_step_state_run", "step_state", ["run_id"])

    op.create_table(
        "timers",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("run_id", sa.String(40), sa.ForeignKey("runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_id", sa.String(40), nullable=True),
        sa.Column("label", sa.String(200), nullable=False, server_default=""),
        sa.Column("duration_seconds", sa.Integer, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(40), nullable=False, server_default="running"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "deviations",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("run_id", sa.String(40), sa.ForeignKey("runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_id", sa.String(40), nullable=True),
        sa.Column("severity", sa.String(40), nullable=False, server_default="minor"),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("resolution_state", sa.String(40), nullable=False, server_default="open"),
        sa.Column("requires_review", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_by", sa.String(40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("attachments_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "attachments",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("run_id", sa.String(40), sa.ForeignKey("runs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("step_id", sa.String(40), nullable=True),
        sa.Column("kind", sa.String(40), nullable=False, server_default="photo"),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False, server_default="image/jpeg"),
        sa.Column("checksum", sa.String(80), nullable=True),
        sa.Column("created_by", sa.String(40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "photo_assessments",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("run_id", sa.String(40), sa.ForeignKey("runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_id", sa.String(40), nullable=False),
        sa.Column("attachment_id", sa.String(40), sa.ForeignKey("attachments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("overall_status", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("items_json", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("recommended_action", sa.Text, nullable=False, server_default=""),
        sa.Column("model_metadata_json", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "handover_reports",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("run_id", sa.String(40), sa.ForeignKey("runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("report_json", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("markdown_body", sa.Text, nullable=False, server_default=""),
        sa.Column("html_body", sa.Text, nullable=False, server_default=""),
        sa.Column("pdf_storage_path", sa.String(500), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("org_id", sa.String(40), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", sa.String(40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(120), nullable=False),
        sa.Column("target_type", sa.String(80), nullable=False),
        sa.Column("target_id", sa.String(40), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_org", "audit_logs", ["org_id"])

    op.create_table(
        "webhook_subscriptions",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("org_id", sa.String(40), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_url", sa.String(500), nullable=False),
        sa.Column("event_types", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", sa.String(40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "webhook_deliveries",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("subscription_id", sa.String(40), sa.ForeignKey("webhook_subscriptions.id"), nullable=False),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("payload", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("status", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_response", sa.Text, nullable=True),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    for tbl in [
        "webhook_deliveries",
        "webhook_subscriptions",
        "audit_logs",
        "handover_reports",
        "photo_assessments",
        "attachments",
        "deviations",
        "timers",
        "step_state",
        "run_events",
        "runs",
        "hazard_rules",
        "protocol_steps",
        "protocol_versions",
        "protocols",
        "document_chunks",
        "documents",
        "memberships",
        "users",
        "organizations",
    ]:
        op.drop_table(tbl)
