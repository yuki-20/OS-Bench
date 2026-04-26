# OpenBench OS

> The AI runtime for safer lab execution.

OpenBench OS compiles approved lab documentation (SOPs, SDSs, equipment manuals) into a versioned, runnable execution graph, then runs that graph with explicit state, citations, photo verification, deviation capture, and structured handover reporting.

This repository is the full V1 product platform described in `docs/PRD/`:

- **Bench Runtime Client** — installable desktop application for operators (Tauri 2 shell wrapping the shared web UI). Windows-first.
- **Web Control Console** — browser app for protocol upload, review, publishing, run oversight, admin, and reporting.
- **Tablet/Mobile Companion** — same web UI, responsive, installable as PWA.
- **Cloud Backend + AI Services** — FastAPI gateway, Celery workers, Postgres + pgvector, Redis, S3-compatible storage, Anthropic Claude Opus 4.7 pipelines.

## Repository layout

```
openbench/
├── apps/
│   ├── web/                 Next.js (App Router) — Control Console + Bench Runtime + Companion
│   └── bench-desktop/       Tauri 2 shell wrapping the bench-runtime URL
├── packages/
│   └── schemas/             Shared Zod / TypeScript schemas mirroring backend Pydantic models
├── services/
│   └── api/                 FastAPI gateway, Celery workers, domain services, and AI pipelines
├── infra/docker/            Dockerfiles
├── docker-compose.yml       Postgres+pgvector, Redis, MinIO, API, worker, web
├── sample-data/             Demo SOP, SDS, manual, bench photo
├── scripts/                 dev / seed / build helpers
└── docs/                    Product, architecture, runbooks
```

## Quick start (Docker)

Prereqs: Docker Desktop, an Anthropic API key.

```bash
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=...

docker compose up --build
```

Then:

- Web Control Console: http://localhost:3000/console
- Bench Runtime UI:    http://localhost:3000/app
- API:                 http://localhost:8000  (docs at /docs)
- MinIO console:       http://localhost:9001  (minio / minio12345)

The first time the API container starts it:

- runs Alembic migrations,
- seeds a demo organization (`demo-lab`) with admin/reviewer/operator users (`{admin,reviewer,operator}@demo.lab`, password `Bench!Demo1`), and
- renders the sample SOP/SDS/manual into PDFs and uploads them as `Document` rows so you can compile a draft immediately without uploading anything.

Re-running `docker compose up` is safe — the seed is idempotent.

## Quick start (local dev without Docker)

If you have Python 3.11+ and pnpm available, see `docs/local-dev.md`.

## Building the desktop client

```bash
# Real (placeholder-branded) icons are already committed under
# apps/bench-desktop/src-tauri/icons/. To regenerate or rebrand:
node scripts/gen-icons.js                # or  bash scripts/gen-icons.sh

cd apps/bench-desktop
pnpm install
pnpm tauri build
```

Produces a signed `.msi` installer for Windows in `apps/bench-desktop/src-tauri/target/release/bundle/`.

## Running the demo flow

1. Sign in to the Console at `/console` as `reviewer@demo.lab` (password `Bench!Demo1`).
2. Open **Protocols → New** — three sample documents are already in the table (auto-seeded).
3. Tick all three, click **Compile draft**. Wait 30–90 s for the AI compile to finish.
4. Review the draft, optionally edit fields inline, click **Publish version**.
5. Sign out, sign in as `operator@demo.lab`, open `/app`.
6. Start a run from the published version. Ask a question ("What PPE applies here?"), upload a bench photo at the photo checkpoint, log a deviation, and finalize the handover report.
7. Back in the Console, open **Runs → (run id)** and download the handover PDF.

See `docs/demo-script.md` for the full narrated walkthrough.

## Documentation

- `docs/PRD/` — original product requirements (PRD v1 + Full App Spec v2).
- `docs/architecture.md` — service boundaries, data model, sync model.
- `docs/api.md` — full REST API reference.
- `docs/ai-pipelines.md` — prompt contracts, schemas, safety reviewer rules.
- `docs/runbooks/` — operational notes.

## Safety boundary

OpenBench OS is decision support, not authority. It interprets approved documentation, surfaces uncertainty, and escalates. It does not invent procedures, certify safety, or replace local emergency processes.
