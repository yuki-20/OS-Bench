"""Smoke test that boots the FastAPI app against SQLite + local storage.

Validates that the SQLite/local-FS dev path actually starts up, so a developer
without Docker can still run the suite."""
from __future__ import annotations

import os

os.environ.setdefault("USE_SQLITE", "true")
os.environ.setdefault("STORAGE_BACKEND", "local")
os.environ.setdefault("SQLITE_PATH", ".local/test-openbench.sqlite3")
os.environ.setdefault("ANTHROPIC_API_KEY", "")

from fastapi.testclient import TestClient

from app.main import app


def test_health_lifespan() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["app_name"]
