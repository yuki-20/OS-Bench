# OpenBench OS

Protocol execution runtime for physical labs. Compiles approved SOPs / SDSs / equipment manuals into versioned, governed execution graphs and runs them with checkpoints, photo verification, deviation capture, and structured handover reporting.

This repository contains three runnable apps wired together. **The landing page is the front door** — visitors land there first, then click through to the console for sign-in.

| App | Path | Stack | Default port | Purpose |
|---|---|---|---|---|
| **Landing page** (start here) | `UI/app/` | Vite · React 19 · Tailwind · GSAP | `3000` (or `3001` if 3000 is taken) | Public marketing site. `Login` / `Dashboard` links route to the console. |
| **Console** (sign in, run oversight) | `UI/app/openbench/` | Next.js 15 · React 19 · Tailwind · Recharts | `4028` | Org-wide run monitor, deviations, audit, team, settings, API keys. |
| **API** (backend) | `openbench/services/api/` | FastAPI · Postgres+pgvector · Redis · MinIO · Celery | `8000` | Auth, runs, protocols, deviations, SSE, AI pipelines. |

The console talks to the API over `Authorization: Bearer <jwt>` + `X-Org-Id` and subscribes to `/api/notifications/stream` (Server-Sent Events) for live updates — no polling, no hard-coded data.

---

## Quick start

> First time? Install dependencies first — see [`INSTALL.md`](./INSTALL.md).

```bash
# 1. Bring up the backend (Postgres, Redis, MinIO, API, worker)
cd openbench
docker compose up -d

# 2. Start the landing page — this is the entry point
cd ../UI/app
npm run dev          # http://localhost:3000  (open this in your browser)

# 3. Start the console (separate terminal — landing redirects here on Login)
cd UI/app/openbench
npm run dev          # http://localhost:4028
```

**Open http://localhost:3000** (or `:3001` if `3000` is taken — see below). From the landing page, click **Login** or **Dashboard** to be routed to the console at `:4028`.

The API auto-runs Alembic migrations and seeds a demo org on first boot.

**Seeded demo accounts** (password `Bench!Demo1` for all):

| Role | Email |
|---|---|
| Admin | `admin@demo.lab` |
| Reviewer | `reviewer@demo.lab` |
| Operator | `operator@demo.lab` |

Open the console, sign in, and the dashboard / run monitor / deviations / audit log all populate from the live API.

---

## Repo layout

```
.
├── openbench/                    # Backend monorepo
│   ├── services/api/             # FastAPI app, alembic migrations, sample data
│   ├── apps/                     # Other apps (web, bench-desktop) — not required for console flow
│   ├── packages/schemas/         # Shared schema package
│   ├── infra/docker/             # Dockerfiles
│   ├── docker-compose.yml        # Full local stack
│   └── .env                      # Backend env (CORS, DB, secrets, AI keys)
│
└── UI/app/                       # Vite landing page (this directory itself)
    ├── src/                      # React + GSAP marketing site
    ├── tech-spec.md              # Landing page tech notes
    └── openbench/                # Next.js console (nested)
        ├── src/app/              # Next.js routes (console-dashboard, run-monitor, ...)
        ├── src/lib/              # api.ts, auth.tsx, sse.ts — the wiring layer
        └── .env.local            # NEXT_PUBLIC_API_BASE_URL
```

---

## How the wiring works

**`UI/app/openbench/src/lib/api.ts`** — typed fetch client. Adds `Authorization` and `X-Org-Id` headers, retries once on 401 by refreshing the JWT, and exposes typed methods for every endpoint the console calls (login, dashboard, runs, deviations, protocols, admin, audit, settings, exports).

**`UI/app/openbench/src/lib/auth.tsx`** — `AuthProvider` / `useAuth`. Handles login, hydrates user + org + role from `/api/auth/me`, persists tokens to localStorage. Wraps the whole app in `src/app/layout.tsx`.

**`UI/app/openbench/src/lib/sse.ts`** — `useLiveStream` hook. Opens an `EventSource` against `/api/notifications/stream?token=...&org_id=...` (EventSource can't set headers, so the access token rides as a query string). Reports `connected` state plus per-event callbacks. Components throughout the console use it to refresh on `run_started`, `run_state_changed`, `deviation_recorded`, `escalation_raised`, etc.

**`UI/app/openbench/src/components/AuthGate.tsx`** — wraps every page in `AppLayout`. Redirects to `/sign-up-login` when unauthenticated.

Every page in `src/app/*/page.tsx` (`console-dashboard`, `run-monitor`, `run-detail`, `protocols`, `deviation-reports`, `audit-log`, `notifications`, `team`, `settings`) fetches from the API with `useEffect` and refreshes on relevant SSE events. No hard-coded mock data.

---

## Backend endpoint reference (most-used)

| Method | Path | Used by |
|---|---|---|
| `POST` | `/api/auth/login` | Login form |
| `GET` | `/api/auth/me` | AuthProvider hydration |
| `POST` | `/api/auth/refresh` | Auto on 401 |
| `GET` | `/api/dashboard` | Dashboard KPIs |
| `GET` | `/api/dashboard/recent-runs` | Dashboard active runs table |
| `GET` | `/api/runs` | Run monitor |
| `GET` | `/api/runs/{id}` | Run detail (full RunDetail with steps, events, deviations, attachments, photo assessments) |
| `POST` | `/api/runs/{id}/{pause,resume,cancel}` | Run detail header buttons |
| `GET` | `/api/deviations` | Deviation reports + dashboard chart |
| `POST` | `/api/deviations/{id}/resolve` | Deviation panel |
| `GET` | `/api/protocols` + `/api/protocol-versions` | Protocols list |
| `GET` | `/api/admin/users` | Team page |
| `POST` | `/api/admin/users/invite` | Invite member |
| `PATCH` | `/api/admin/memberships/{id}` | Role change |
| `GET` `PATCH` | `/api/admin/settings` | Settings page |
| `GET` | `/api/admin/audit` | Audit log |
| `GET` | `/api/exports/runs.csv` | Run monitor export |
| `GET` | `/api/notifications/stream` | SSE live updates |

Full OpenAPI docs: `http://localhost:8000/docs` while the API is running.

---

## Development tips

- **API container picks up env on create**, not on file change. After editing `openbench/.env`, run `docker compose up -d api` from `openbench/` so the api container is recreated with the new env.
- **CORS** — the console runs on `:4028`, which is in `CORS_ORIGINS`. If you serve the console from a different origin, add it to `openbench/.env` and recreate the api container.
- **Live updates not arriving?** Check the topbar dot — green = SSE connected. If grey, the access token may have expired (refresh the page) or the API isn't reachable.
- **Type-check the console**: `cd UI/app/openbench && npx tsc --noEmit`
- **Production build of the console**: `cd UI/app/openbench && npx next build`
- **Backend tests**: `cd openbench/services/api && pytest`

---

## Known limitations

The protocol *write* flows — `/protocols/new` (upload + compile) and `/protocols/[id]/review` (publish/archive) — still render their original local mocks. Wiring them to `POST /api/documents/upload` → `POST /api/protocol-drafts/compile` → `POST /api/protocol-drafts/{id}/publish` is a follow-up; the *list* page is fully wired.
