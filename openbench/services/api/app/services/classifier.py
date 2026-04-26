"""Lightweight rule-based document classifier (sop / sds / manual / policy)."""
from __future__ import annotations

import re

SOP_HINTS = re.compile(
    r"\b(standard\s+operating\s+procedure|sop|protocol|procedure|step\s*\d+|materials?|reagents?)\b",
    re.I,
)
SDS_HINTS = re.compile(
    r"\b(safety\s+data\s+sheet|sds|msds|hazard\s+identification|first[-\s]?aid measures|"
    r"section\s+1\s*[:\-]?\s*identification|exposure controls|personal protection|toxicological)\b",
    re.I,
)
MANUAL_HINTS = re.compile(
    r"\b(operator\s+manual|user\s+manual|equipment\s+manual|installation|maintenance|calibration|"
    r"troubleshoot|model\s+number|warranty)\b",
    re.I,
)
POLICY_HINTS = re.compile(
    r"\b(chemical\s+hygiene|safety\s+policy|standard\s+practice|institutional|laboratory\s+safety\s+manual)\b",
    re.I,
)


def classify_text(text: str) -> str:
    sample = text[:8000].lower()
    sds = len(SDS_HINTS.findall(sample))
    sop = len(SOP_HINTS.findall(sample))
    man = len(MANUAL_HINTS.findall(sample))
    pol = len(POLICY_HINTS.findall(sample))
    scores = {"sds": sds, "sop": sop, "manual": man, "policy": pol}
    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return "unknown"
    return best


def detect_title(text: str) -> str:
    head = text.strip().splitlines()[:30]
    for line in head:
        line = line.strip()
        if 5 <= len(line) <= 140 and re.search(r"[A-Za-z]", line):
            return line
    return ""
