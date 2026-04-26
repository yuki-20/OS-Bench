# Architecture

OpenBench OS is a multi-surface platform with one shared backend. This document is the
short reference for engineers; the full normative spec lives in `docs/PRD/`.

## Surfaces

| Surface              | Tech                       | Routes                | Notes |
|----------------------|----------------------------|-----------------------|-------|
| Web Control Console  | Next.js 14 (App Router)    | `/console/...`        | Reviewers, managers, admins |
| Bench Runtime        | Same Next.js app, `/app/*` | `/app/...`            | Operators; offline-aware; PWA installable |
| Bench Desktop        | Tauri 2 wrapping `/app/*`  | n/a                   | Windows-first installer |
| Mobile/Tablet companion | Same `/app/*` responsive | `/app/...`            | Photo capture, alerts, handover review |

## Service layers

```
client (web/desktop/companion)
   │
   ▼
FastAPI gateway (auth, RBAC, signed URLs, command routing)
   │
   ├── Protocol service ── Postgres
   ├── Run orchestrator (state machine) ── Postgres (events table)
   ├── AI workers (Anthropic Claude Opus 4.7)
   │      ├─ Document compiler
   │      ├─ Hazard mapper
   │      ├─ Step Q&A (fast model)
   │      ├─ Vision checkpoint (image + text)
   │      ├─ Report generator
   │      └─ Safety reviewer
   ├── Object storage (S3 / MinIO) ── documents, attachments, PDFs
   ├── Redis ── Celery broker + result backend
   ├── Audit + webhook fan-out
   └── Sync service (idempotent event ingestion)
```

## Data model

Core entities live in `services/api/app/models/`. Highlights:

- **organizations / users / memberships** — multi-tenant, RBAC.
- **documents / document_chunks** — uploaded source files; chunks have FTS + pgvector slots.
- **protocols / protocol_versions / protocol_steps / hazard_rules** — published protocol
  versions are immutable; runs always pin to a specific version.
- **runs / run_events / step_state / timers / deviations / attachments / photo_assessments**
  — append-only event log + denormalized state for fast UI queries.
- **handover_reports** — generated from events, stored as JSON + Markdown + HTML + PDF.
- **audit_logs / webhook_subscriptions / webhook_deliveries** — operational telemetry.

## Run state machine

```
created → preflight → active ⇄ paused
                       │
                       ├── blocked ⇄ awaiting_override
                       │
                       └── completed ↔ closed
                       
                  cancelled (terminal)
```

## Step state machine

```
not_started → in_progress
              ├─ waiting_on_timer
              ├─ waiting_on_checkpoint
              └─ blocked
              ↘ skipped | completed
```

## AI safety boundary

Every operator-facing AI output is run through the Safety Reviewer pass before reaching the
operator (`services/api/app/ai/safety.py`). Free text is restricted to designated fields
in JSON schemas; citations are required for every claim sourced from documents. The visual
verifier uses a strict `confirmed | not_visible | unclear | cannot_verify` taxonomy and
never claims a run is "safe".

## Offline & sync

The bench client journals every operator-visible mutation locally in IndexedDB
(`apps/web/src/lib/offline.ts`). When connectivity exists, the queue is flushed against
`POST /api/sync/events`. Idempotency keys are required, so retries do not duplicate events.
The server uses `(run_id, idempotency_key)` as a unique constraint on `run_events`.

## Tenancy

All entities carry `org_id` (directly or via a parent). The API gateway enforces
`X-Org-Id` against the calling user's memberships and filters every query. Server-side
validation is the source of truth — the UI's role gating is a UX nicety, not a security
boundary.
