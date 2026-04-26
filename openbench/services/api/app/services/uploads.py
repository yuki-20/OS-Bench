"""Upload validation helpers — MIME guarding, magic-byte checks, size limits."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

DOCUMENT_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
}
IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ATTACHMENT_MIME_TYPES = DOCUMENT_MIME_TYPES | IMAGE_MIME_TYPES

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def safe_filename(filename: str | None, *, fallback: str = "upload") -> str:
    raw = Path(filename or fallback).name.strip().replace("\\", "_").replace("/", "_")
    cleaned = _SAFE_NAME_RE.sub("_", raw).strip("._")
    return (cleaned or fallback)[:120]


def infer_mime_type(mime_type: str | None, filename: str | None = None) -> str:
    mt = (mime_type or "").split(";", 1)[0].strip().lower()
    if mt and mt != "application/octet-stream":
        return mt
    suffix = Path(filename or "").suffix.lower()
    if suffix == ".pdf":
        return "application/pdf"
    if suffix == ".docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if suffix == ".md":
        return "text/markdown"
    if suffix == ".txt":
        return "text/plain"
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".png":
        return "image/png"
    if suffix == ".webp":
        return "image/webp"
    return mt or "application/octet-stream"


async def read_upload_limited(file: UploadFile, *, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"Upload exceeds {max_bytes} bytes",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def ensure_allowed_mime(mime_type: str, allowed: Iterable[str]) -> str:
    mt = (mime_type or "application/octet-stream").split(";", 1)[0].strip().lower()
    if mt not in set(allowed):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported upload type: {mt}",
        )
    return mt


def validate_document_bytes(raw: bytes, mime_type: str) -> None:
    mt = ensure_allowed_mime(mime_type, DOCUMENT_MIME_TYPES)
    if mt == "application/pdf" and not raw.startswith(b"%PDF-"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "PDF upload failed file signature validation")
    if mt.endswith("wordprocessingml.document") and not raw.startswith(b"PK\x03\x04"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "DOCX upload failed file signature validation")
    if mt in {"text/plain", "text/markdown"} and b"\x00" in raw[:1024]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Plain-text upload appears to be binary")


def validate_attachment_bytes(raw: bytes, mime_type: str, *, kind: str = "attachment") -> None:
    mt = ensure_allowed_mime(mime_type, ATTACHMENT_MIME_TYPES)
    if kind == "photo" and mt not in IMAGE_MIME_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Photo uploads must be JPEG, PNG, or WebP")
    if mt == "image/jpeg" and not raw.startswith(b"\xff\xd8\xff"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "JPEG upload failed file signature validation")
    if mt == "image/png" and not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "PNG upload failed file signature validation")
    if mt == "image/webp" and not (raw.startswith(b"RIFF") and raw[8:12] == b"WEBP"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "WebP upload failed file signature validation")
    if mt in DOCUMENT_MIME_TYPES:
        validate_document_bytes(raw, mt)


def ensure_document_object_size(size: int | None) -> None:
    if size is not None and size > settings.max_document_upload_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Document exceeds {settings.max_document_upload_bytes} bytes",
        )
