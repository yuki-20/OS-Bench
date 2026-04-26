"""Portable column types — pgvector on Postgres, JSON fallback on SQLite.

Lets the test suite run against SQLite while production uses Postgres + pgvector.
"""
from __future__ import annotations

from typing import Any

from pgvector.sqlalchemy import Vector as _PgVector
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB as _PgJSONB
from sqlalchemy.types import TypeDecorator


JSONB = JSON().with_variant(_PgJSONB(), "postgresql")


class PortableVector(TypeDecorator[list[float] | None]):
    """Use pgvector on Postgres and JSON elsewhere for local development."""

    impl = JSON
    cache_ok = True

    def __init__(self, dimensions: int) -> None:
        super().__init__()
        self.dimensions = dimensions

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(_PgVector(self.dimensions))
        return dialect.type_descriptor(JSON())


def Vector(dimensions: int) -> PortableVector:
    return PortableVector(dimensions)
