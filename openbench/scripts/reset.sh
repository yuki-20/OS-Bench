#!/usr/bin/env bash
# Tear down all OpenBench services and volumes (DESTRUCTIVE).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down -v
echo "Removed containers and volumes."
