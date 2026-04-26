"""Deterministic 384-d embedding (hashing-trick).

This is intentionally a placeholder for a real embedding model. It tokenises
the input on whitespace and word-character boundaries, then hashes each token
into one of 384 buckets and accumulates a tf-idf-ish weight. The output is
L2-normalised so pgvector cosine queries behave sensibly.

Why ship this instead of a real model right now:
  * no extra dependency (sentence-transformers ~ 80MB and slow cold start)
  * deterministic, so test fixtures are reproducible
  * still gives nontrivial recall on document chunks vs. lexical-only

Replace with `sentence-transformers/all-MiniLM-L6-v2` (also 384-d) when you're
willing to ship the model weights — `embed_text` is the only seam to swap.
"""
from __future__ import annotations

import hashlib
import math
import re

DIM = 384
_TOKEN_RE = re.compile(r"[A-Za-z0-9]{2,}")


def _bucket(token: str) -> tuple[int, float]:
    """Hash a token into a (bucket, sign) pair. Two hashes for less collision."""
    h1 = hashlib.blake2b(token.encode("utf-8"), digest_size=4).digest()
    h2 = hashlib.blake2b(token.encode("utf-8"), digest_size=4, salt=b"sign").digest()
    bucket = int.from_bytes(h1, "big") % DIM
    sign = 1.0 if (h2[0] & 1) else -1.0
    return bucket, sign


def embed_text(text: str) -> list[float]:
    """Return a 384-d unit-norm vector for `text`. Empty input returns zeros."""
    vec = [0.0] * DIM
    if not text:
        return vec
    tokens = [t.lower() for t in _TOKEN_RE.findall(text)][:4096]
    if not tokens:
        return vec
    # Inverse-token-frequency-ish weighting: rare tokens count more.
    counts: dict[str, int] = {}
    for t in tokens:
        counts[t] = counts.get(t, 0) + 1
    n = len(tokens)
    for t, c in counts.items():
        tf = c / n
        idf = math.log(1.0 + DIM / (1 + len(t)))  # cheap, deterministic, dependence on token length
        weight = tf * idf
        bucket, sign = _bucket(t)
        vec[bucket] += sign * weight
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


__all__ = ["embed_text", "DIM"]
