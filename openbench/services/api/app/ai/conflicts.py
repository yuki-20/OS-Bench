"""Cross-document conflict resolver (PRD v3 Section 6.2 task #2 / 6.4).

Reads SOP + SDS + manual + policy and surfaces:
  - direct conflicts (SOP says A, SDS/manual says NOT A)
  - missing safety coverage for hazardous steps
  - synthesis cards (SOP says "compatible gloves", SDS says nitrile,
    manual says no wet gloves near panel -> mapped to step control card)
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import call_json
from app.ai.compiler import gather_documents, _format_doc_block
from app.core.config import settings
from app.core.logging import logger


CONFLICT_SYSTEM = """\
You are the OpenBench OS Cross-Document Conflict Resolver.

Given an SOP, SDS, equipment manual, and any policy overlays, identify:

1. CONFLICTS: a claim in one document that contradicts another (different PPE,
   incompatible reagents, mismatched temperatures, etc.)
2. GAPS: a hazardous step in the SOP that lacks SDS or policy coverage.
3. SYNTHESIS CARDS: requirements that combine evidence from multiple sources
   (e.g. SOP says 'compatible gloves', SDS specifies nitrile, manual warns
   against wet gloves near a control panel — produces one combined control card).

Output JSON ONLY in this shape:

{
  "conflicts": [
    {
      "topic": string,
      "summary": string,
      "step_keys": [string],
      "severity": "low" | "standard" | "high" | "critical",
      "sources": [
        {"document_id": string, "page_no": integer|null,
         "section_label": string|null, "quote_summary": string,
         "claim": string}
      ],
      "recommended_action": string
    }
  ],
  "gaps": [
    {
      "step_keys": [string],
      "missing": string,
      "severity": string,
      "recommended_action": string
    }
  ],
  "synthesis_cards": [
    {
      "step_keys": [string],
      "topic": string,
      "combined_requirement": string,
      "sources": [
        {"document_id": string, "page_no": integer|null,
         "section_label": string|null, "quote_summary": string}
      ]
    }
  ]
}

Rules:
- Only use the supplied documents. Never invent claims.
- "critical" severity requires immediate stop / republish.
- Synthesis cards must cite ALL contributing documents.
- If nothing meaningful, return empty arrays (do not pad).
"""


async def resolve_conflicts(
    session: AsyncSession,
    document_ids: Sequence[str],
    step_keys: Sequence[str],
) -> Dict[str, Any]:
    bundles = await gather_documents(session, document_ids)
    if not bundles:
        return {"conflicts": [], "gaps": [], "synthesis_cards": []}
    block = "\n\n".join(_format_doc_block(b, max_chars=10000) for b in bundles)
    valid_doc_ids = {b.document_id for b in bundles}
    user = (
        f"DOCUMENTS:\n{block}\n\n"
        f"PROTOCOL STEP KEYS: {', '.join(step_keys)}\n\n"
        "Produce the conflict map JSON as specified."
    )
    try:
        result = await asyncio.to_thread(
            call_json,
            system=CONFLICT_SYSTEM,
            messages=[{"role": "user", "content": user}],
            model=settings.anthropic_model,
            temperature=0.0,
            max_tokens=64000,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("Conflict resolver failed: {}", e)
        return {"conflicts": [], "gaps": [], "synthesis_cards": [], "error": str(e)[:200]}

    def _clean_sources(items: List[dict[str, Any]] | None) -> List[dict[str, Any]]:
        out: List[dict[str, Any]] = []
        for s in items or []:
            doc_id = s.get("document_id")
            if doc_id in valid_doc_ids:
                out.append(
                    {
                        "document_id": doc_id,
                        "page_no": s.get("page_no"),
                        "section_label": s.get("section_label"),
                        "quote_summary": (s.get("quote_summary") or "")[:400],
                        "claim": (s.get("claim") or "")[:400] if "claim" in s else None,
                    }
                )
        return out

    conflicts = []
    for c in result.get("conflicts") or []:
        sources = _clean_sources(c.get("sources"))
        if len(sources) < 2:
            # A conflict requires at least two sources. Drop spurious entries.
            continue
        conflicts.append(
            {
                "topic": (c.get("topic") or "").strip()[:240],
                "summary": (c.get("summary") or "").strip()[:800],
                "step_keys": [str(k) for k in (c.get("step_keys") or [])],
                "severity": c.get("severity") or "standard",
                "sources": sources,
                "recommended_action": (c.get("recommended_action") or "")[:480],
            }
        )

    gaps = []
    for g in result.get("gaps") or []:
        gaps.append(
            {
                "step_keys": [str(k) for k in (g.get("step_keys") or [])],
                "missing": (g.get("missing") or "")[:480],
                "severity": g.get("severity") or "standard",
                "recommended_action": (g.get("recommended_action") or "")[:480],
            }
        )

    cards = []
    for s in result.get("synthesis_cards") or []:
        sources = _clean_sources(s.get("sources"))
        if not sources:
            continue
        cards.append(
            {
                "step_keys": [str(k) for k in (s.get("step_keys") or [])],
                "topic": (s.get("topic") or "")[:240],
                "combined_requirement": (s.get("combined_requirement") or "")[:600],
                "sources": sources,
            }
        )

    return {"conflicts": conflicts, "gaps": gaps, "synthesis_cards": cards}


__all__ = ["resolve_conflicts"]
