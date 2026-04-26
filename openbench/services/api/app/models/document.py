from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.ids import chunk_id, doc_id
from app.db.base import Base, TimestampedMixin
from app.db.types import JSONB, Vector


class Document(Base, TimestampedMixin):
    __tablename__ = "documents"
    __table_args__ = (Index("ix_document_org", "org_id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=doc_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    document_type: Mapped[str] = mapped_column(String(40), default="unknown", nullable=False)
    title: Mapped[str] = mapped_column(String(400), default="", nullable=False)
    declared_version: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    checksum: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    parse_status: Mapped[str] = mapped_column(String(40), default="pending", nullable=False)
    ocr_status: Mapped[str] = mapped_column(String(40), default="not_required", nullable=False)
    parse_metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)

    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class DocumentChunk(Base, TimestampedMixin):
    __tablename__ = "document_chunks"
    __table_args__ = (Index("ix_chunk_doc", "document_id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=chunk_id)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    page_no: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    section_label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    citation_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    embedding: Mapped[Optional[list[float]]] = mapped_column(Vector(384), nullable=True)

    document: Mapped[Document] = relationship(back_populates="chunks")
