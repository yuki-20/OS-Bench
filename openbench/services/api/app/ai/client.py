"""Thin wrapper around the Anthropic SDK with JSON-mode helpers."""
from __future__ import annotations

import json
import re
from contextvars import ContextVar
from typing import Any, Dict, List, Optional

from anthropic import Anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging import logger

# Per-request override for the Anthropic key. Populated by the auth dependency
# from the org's stored key. Empty/None falls back to settings.anthropic_api_key.
_request_anthropic_key: ContextVar[Optional[str]] = ContextVar(
    "request_anthropic_key", default=None
)

# Cache Anthropic clients keyed by api_key so we don't construct a new HTTP
# client per call. Bounded implicitly by the number of distinct org keys.
_clients_by_key: Dict[str, Anthropic] = {}


def set_request_anthropic_key(key: Optional[str]) -> None:
    """Set the Anthropic key for the current request context.

    Called by the auth dependency once we know which org the caller belongs to.
    Pass None or an empty string to clear and fall back to the env-configured
    key.
    """
    _request_anthropic_key.set(key or None)


def _resolve_key() -> str:
    override = _request_anthropic_key.get()
    if override:
        return override
    return settings.anthropic_api_key or ""


def get_client() -> Anthropic:
    key = _resolve_key()
    if not key:
        # Fail loudly with a clear message instead of letting the SDK 401.
        raise RuntimeError(
            "No Anthropic API key configured. Set one in the API Keys page or "
            "ANTHROPIC_API_KEY env var."
        )
    cached = _clients_by_key.get(key)
    if cached is None:
        cached = Anthropic(api_key=key)
        _clients_by_key[key] = cached
    return cached


def _extract_json(s: str) -> Optional[Dict[str, Any]]:
    s = s.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", s, re.S | re.I)
    if fence:
        s = fence.group(1).strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    # Attempt to locate first balanced JSON object
    start = s.find("{")
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(s)):
        c = s[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                cand = s[start : i + 1]
                try:
                    return json.loads(cand)
                except Exception:
                    return None
    return None


# Models that no longer accept the legacy `temperature` parameter (Claude 4.x+
# uses deterministic sampling internally). Anthropic returns a 400 if we pass
# it, so we filter the kwarg out before the SDK call.
_NO_TEMPERATURE_PREFIXES = ("claude-opus-4", "claude-sonnet-4", "claude-haiku-4")


def _supports_temperature(model: str) -> bool:
    return not any(model.startswith(p) for p in _NO_TEMPERATURE_PREFIXES)


def _beta_headers() -> Dict[str, str]:
    """Build the optional `anthropic-beta` header. Empty config → no header."""
    raw = (settings.anthropic_beta or "").strip()
    if not raw:
        return {}
    flags = ",".join(f.strip() for f in raw.split(",") if f.strip())
    return {"anthropic-beta": flags} if flags else {}


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def call_text(
    *,
    system: str,
    messages: List[Dict[str, Any]],
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: float = 0.2,
) -> str:
    client = get_client()
    resolved_model = model or settings.anthropic_model
    kwargs: Dict[str, Any] = {
        "model": resolved_model,
        "system": system,
        "messages": messages,
        "max_tokens": max_tokens or settings.anthropic_max_tokens,
    }
    if _supports_temperature(resolved_model):
        kwargs["temperature"] = temperature
    extra = _beta_headers()
    if extra:
        kwargs["extra_headers"] = extra
    resp = client.messages.create(**kwargs)
    out: List[str] = []
    for block in resp.content:
        if getattr(block, "type", None) == "text":
            out.append(block.text)
    return "".join(out)


def call_json(
    *,
    system: str,
    messages: List[Dict[str, Any]],
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: float = 0.2,
) -> Dict[str, Any]:
    text = call_text(
        system=system,
        messages=messages,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    parsed = _extract_json(text)
    if parsed is None:
        logger.warning("JSON extraction failed; raw output: {}", text[:500])
        raise ValueError("Model did not return parseable JSON")
    return parsed


def with_image(
    *,
    text_prompt: str,
    image_bytes: bytes,
    image_mime: str = "image/jpeg",
) -> List[Dict[str, Any]]:
    import base64

    encoded = base64.standard_b64encode(image_bytes).decode("utf-8")
    return [
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": image_mime or "image/jpeg",
                        "data": encoded,
                    },
                },
                {"type": "text", "text": text_prompt},
            ],
        }
    ]
