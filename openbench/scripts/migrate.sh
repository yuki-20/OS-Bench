#!/usr/bin/env bash
# Apply pending Alembic migrations.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec api alembic upgrade head
