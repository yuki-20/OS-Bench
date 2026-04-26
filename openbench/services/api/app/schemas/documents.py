from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class DocumentUploadInit(BaseModel):
    filename: str
    mime_type: str = "application/pdf"
    suggested_type: Optional[str] = Field(
        default=None, description="sop | sds | manual | policy | unknown"
    )
    declared_version: Optional[str] = None


class DocumentUploadResponse(BaseModel):
    document_id: str
    upload_url: str
    storage_path: str
    expires_in_seconds: int = 3600


class DocumentFinalizeRequest(BaseModel):
    checksum: Optional[str] = None
    size_bytes: Optional[int] = None


class DocumentOut(ORMModel):
    id: str
    org_id: str
    document_type: str
    title: str
    declared_version: Optional[str] = None
    storage_path: str
    mime_type: str
    page_count: int
    parse_status: str
    parse_metadata: dict[str, Any] = Field(default_factory=dict)


class DocumentChunkOut(ORMModel):
    id: str
    document_id: str
    chunk_index: int
    page_no: Optional[int] = None
    section_label: Optional[str] = None
    chunk_text: str
    citation_json: dict[str, Any] = Field(default_factory=dict)


class DocumentDetail(DocumentOut):
    extracted_text_preview: str = ""
    chunk_count: int = 0
