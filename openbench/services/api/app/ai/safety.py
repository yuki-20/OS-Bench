"""Safety reviewer pass: audit AI outputs for unsupported claims, missing citations, etc."""
from __future__ import annotations

import json
from typing import Any, Dict

from app.ai.client import call_json
from app.ai.prompts import SAFETY_REVIEWER_SYSTEM
from app.core.config import settings
from app.core.logging import logger


def review_qa_answer(
    *,
    question: str,
    answer: Dict[str, Any],
    has_citations: bool,
) -> Dict[str, Any]:
    """Lightweight reviewer; returns a verdict dict that callers attach to responses."""
    # Cheap heuristic pre-checks first (avoids paying for an LLM call when obviously fine).
    issues: list[str] = []
    forbidden = [
        "you are safe",
        "this is safe",
        "i certify",
        "this run is safe",
        "trust me",
    ]
    text = (answer.get("answer_text") or "").lower()
    for f in forbidden:
        if f in text:
            issues.append(f"Disallowed phrasing: '{f}'")
    if not has_citations and not answer.get("escalation_required"):
        issues.append("Answer is not flagged for escalation but provides no citation.")

    if not issues:
        return {"verdict": "pass", "issues": [], "rewrite_suggestion": None, "force_escalation": False}

    # Run the LLM reviewer for a final judgement.
    payload = {"question": question, "answer": answer}
    try:
        result = call_json(
            system=SAFETY_REVIEWER_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": "Audit this AI output for unsupported claims, missing citations, "
                    "overconfidence, and impermissible protocol invention.\n\n"
                    + json.dumps(payload, indent=2)[:8000],
                }
            ],
            model=settings.anthropic_fast_model,
            temperature=0.0,
            max_tokens=64000,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("Safety reviewer LLM failed, defaulting to pass-with-issues: {}", e)
        return {"verdict": "pass", "issues": issues, "rewrite_suggestion": None, "force_escalation": False}

    return {
        "verdict": result.get("verdict") or "pass",
        "issues": list(result.get("issues") or []) + issues,
        "rewrite_suggestion": result.get("rewrite_suggestion"),
        "force_escalation": bool(result.get("force_escalation")),
    }
