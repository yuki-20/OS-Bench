"""Document retrieval — pgvector cosine + Postgres FTS + lexical fallback.

Strategy (in order of preference):
  1. If chunks have embeddings populated, do a pgvector cosine search.
  2. Otherwise (or if no rows match), fall back to Postgres FTS via ts_rank.
  3. On non-Postgres engines (SQLite local-dev) or empty FTS results, fall
     back to a rapidfuzz token-set lexical scan.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Sequence

from rapidfuzz import fuzz
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.document import DocumentChunk
from app.services.embedding import embed_text


@dataclass
class RetrievedChunk:
    chunk_id: str
    document_id: str
    page_no: Optional[int]
    section_label: Optional[str]
    chunk_text: str
    score: float


async def search_chunks(
    session: AsyncSession,
    query: str,
    *,
    document_ids: Optional[Sequence[str]] = None,
    limit: int = 8,
) -> List[RetrievedChunk]:
    if not query.strip():
        return []
    # Try semantic vector search first if we're on Postgres.
    if session.bind is not None and session.bind.dialect.name == "postgresql":
        try:
            vector_hits = await _vector_search(
                session, query, document_ids=document_ids, limit=limit
            )
            if vector_hits:
                return vector_hits
        except Exception as e:  # noqa: BLE001
            logger.warning("vector search failed, falling back to FTS: {}", e)
    # On non-Postgres engines (SQLite local dev), skip the ts_rank query — it
    # would error out because to_tsvector isn't available.
    if session.bind is not None and session.bind.dialect.name != "postgresql":
        return await _lexical_search(session, query, document_ids=document_ids, limit=limit)
    sql = """
        SELECT id, document_id, page_no, section_label, chunk_text,
               ts_rank(to_tsvector('english', chunk_text), plainto_tsquery('english', :q)) AS rank
        FROM document_chunks
        WHERE to_tsvector('english', chunk_text) @@ plainto_tsquery('english', :q)
    """
    params = {"q": query}
    if document_ids:
        sql += " AND document_id = ANY(:doc_ids)"
        params["doc_ids"] = list(document_ids)
    sql += " ORDER BY rank DESC LIMIT :lim"
    params["lim"] = limit * 3
    result = await session.execute(text(sql), params)
    rows = result.fetchall()

    if not rows and document_ids:
        return await _lexical_search(session, query, document_ids=document_ids, limit=limit)

    out: List[RetrievedChunk] = []
    for r in rows[:limit]:
        out.append(
            RetrievedChunk(
                chunk_id=r.id,
                document_id=r.document_id,
                page_no=r.page_no,
                section_label=r.section_label,
                chunk_text=r.chunk_text,
                score=float(r.rank),
            )
        )
    return out


async def _vector_search(
    session: AsyncSession,
    query: str,
    *,
    document_ids: Optional[Sequence[str]] = None,
    limit: int = 8,
) -> List[RetrievedChunk]:
    """Cosine-similarity search using pgvector. Returns [] if no chunks have
    embeddings yet (so the caller can fall back to FTS)."""
    qvec = embed_text(query)
    # Build a postgres array literal once. pgvector accepts the `::vector` cast.
    vec_literal = "[" + ",".join(f"{v:.6f}" for v in qvec) + "]"
    sql = """
        SELECT id, document_id, page_no, section_label, chunk_text,
               1.0 - (embedding <=> CAST(:qvec AS vector)) AS score
        FROM document_chunks
        WHERE embedding IS NOT NULL
    """
    params: dict = {"qvec": vec_literal, "lim": limit}
    if document_ids:
        sql += " AND document_id = ANY(:doc_ids)"
        params["doc_ids"] = list(document_ids)
    sql += " ORDER BY embedding <=> CAST(:qvec AS vector) ASC LIMIT :lim"
    rows = (await session.execute(text(sql), params)).fetchall()
    out: List[RetrievedChunk] = []
    for r in rows:
        # r.score may be a Decimal — coerce.
        out.append(
            RetrievedChunk(
                chunk_id=r.id,
                document_id=r.document_id,
                page_no=r.page_no,
                section_label=r.section_label,
                chunk_text=r.chunk_text,
                score=float(r.score) if r.score is not None else 0.0,
            )
        )
    return out


async def _lexical_search(
    session: AsyncSession,
    query: str,
    *,
    document_ids: Optional[Sequence[str]] = None,
    limit: int = 8,
) -> List[RetrievedChunk]:
    stmt = select(DocumentChunk)
    if document_ids:
        stmt = stmt.where(DocumentChunk.document_id.in_(list(document_ids)))
    chunks = (await session.execute(stmt)).scalars().all()
    scored = []
    for c in chunks:
        s = fuzz.token_set_ratio(query, c.chunk_text) / 100.0
        scored.append((s, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        RetrievedChunk(
            chunk_id=c.id,
            document_id=c.document_id,
            page_no=c.page_no,
            section_label=c.section_label,
            chunk_text=c.chunk_text,
            score=float(s),
        )
        for s, c in scored[:limit]
    ]


def render_context(chunks: List[RetrievedChunk]) -> str:
    parts: List[str] = []
    for c in chunks:
        header = f"[chunk={c.chunk_id} doc={c.document_id} page={c.page_no or '-'} section={c.section_label or '-'}]"
        parts.append(f"{header}\n{c.chunk_text}")
    return "\n\n".join(parts)
