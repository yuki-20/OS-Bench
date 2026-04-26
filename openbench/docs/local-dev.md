# Local development

The recommended path is `docker compose up --build` (see top-level README). This page covers
running the surfaces directly for faster iteration.

## API + workers

Requires Python 3.11+, Postgres 16 with pgvector, Redis 7, and an S3-compatible bucket.

```bash
cd services/api
python -m venv .venv
source .venv/bin/activate            # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
export $(grep -v '^#' ../../.env | xargs)   # bash; on Windows use $env:VAR=...
alembic upgrade head
python -m app.scripts.seed
uvicorn app.main:app --reload
```

In another terminal:

```bash
celery -A app.workers.celery_app:celery worker --loglevel=info
```

## Web (Next.js)

```bash
pnpm install
pnpm --filter @openbench/web dev
# Console: http://localhost:3000/console
# Bench:   http://localhost:3000/app
```

## Tauri desktop shell

See `apps/bench-desktop/README.md`. The shell loads the running web app at
`http://localhost:3000/app` by default.

## Useful commands

- Reset DB:                    `docker compose exec api alembic downgrade base && docker compose exec api alembic upgrade head`
- Re-seed demo:                `bash scripts/seed-demo.sh`
- Tail API logs:               `docker compose logs -f api`
- Open psql:                   `docker compose exec db psql -U openbench -d openbench`
- MinIO mc CLI inside compose: `docker compose run --rm minio-init`
