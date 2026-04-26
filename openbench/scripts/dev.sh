#!/usr/bin/env bash
# Bring the dev stack up with logs.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Edit it to set ANTHROPIC_API_KEY before continuing."
fi
docker compose up --build
