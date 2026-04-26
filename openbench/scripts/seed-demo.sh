#!/usr/bin/env bash
# Re-run the seed in a running API container.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec api python -m app.scripts.seed
