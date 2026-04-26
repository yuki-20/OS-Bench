"""Security guards: HTML sanitisation, SSRF block, magic-byte upload validation,
schema enum constraints. These run without a DB or external services."""
from __future__ import annotations

import os

# These tests don't touch the DB, but importing app.* requires settings.
os.environ.setdefault("USE_SQLITE", "true")
os.environ.setdefault("STORAGE_BACKEND", "local")
os.environ.setdefault("ANTHROPIC_API_KEY", "")

import pytest
from fastapi import HTTPException

from app.schemas.admin import InviteRequest, WebhookCreate
from app.schemas.runs import DeviationAddRequest
from app.services.pdf import markdown_to_html
from app.services.uploads import validate_attachment_bytes, validate_document_bytes
from app.services.webhook import validate_webhook_target_url


def test_handover_markdown_html_is_sanitized() -> None:
    html = markdown_to_html(
        "# Report\n"
        "<script>alert(1)</script>\n"
        "[bad](javascript:alert(1))\n"
        "<img src=x onerror=alert(1)>"
    )

    assert "<script" not in html.lower()
    assert "javascript:" not in html.lower()
    assert "onerror" not in html.lower()
    assert "<h1>Report</h1>" in html


def test_webhook_target_blocks_private_networks() -> None:
    with pytest.raises(ValueError):
        validate_webhook_target_url("https://127.0.0.1/hook")
    with pytest.raises(ValueError):
        validate_webhook_target_url("http://93.184.216.34/hook")

    assert validate_webhook_target_url("https://93.184.216.34/hook") == "https://93.184.216.34/hook"


def test_upload_magic_byte_validation() -> None:
    validate_document_bytes(b"%PDF-1.4\n", "application/pdf")
    with pytest.raises(HTTPException):
        validate_document_bytes(b"not a pdf", "application/pdf")

    validate_attachment_bytes(b"\xff\xd8\xff\xe0", "image/jpeg", kind="photo")
    with pytest.raises(HTTPException):
        validate_attachment_bytes(b"%PDF-1.4\n", "application/pdf", kind="photo")


def test_request_enums_reject_unexpected_values() -> None:
    with pytest.raises(ValueError):
        InviteRequest(email="a@example.com", display_name="A", role="owner", initial_password="Password1")
    with pytest.raises(ValueError):
        WebhookCreate(target_url="https://93.184.216.34/hook", event_types=["unknown_event"])
    with pytest.raises(ValueError):
        DeviationAddRequest(
            idempotency_key="dev-test",
            severity="severe",
            title="T",
            description="D",
        )
    assert DeviationAddRequest(
        idempotency_key="dev-test-ok",
        severity="high",
        title="T",
        description="D",
    ).severity == "high"
