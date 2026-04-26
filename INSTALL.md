# Installation

This guide walks you from a clean machine to a running OpenBench OS stack: backend API + console + landing page.

> Already have everything installed? Jump to [Run it](#run-it).

---

## 1. Prerequisites

Install these once. Versions listed are what the project is developed and verified against — newer should also work.

### Required for everyone

| Tool | Version | Why | Install |
|---|---|---|---|
| **Git** | any recent | Clone, version control | https://git-scm.com/downloads |
| **Node.js** | **20 LTS** or newer | Both UI apps | https://nodejs.org/ — pick the LTS installer |
| **npm** | comes with Node | Package manager | bundled with Node |
| **Docker Desktop** | latest | Runs the API + Postgres + Redis + MinIO + Celery worker as one stack | https://www.docker.com/products/docker-desktop/ |
| **Docker Compose** | v2 (built into Docker Desktop) | Orchestration | bundled with Docker Desktop |

After installing, verify:

```bash
git --version
node --version          # should print v20.x or higher
npm --version
docker --version
docker compose version
```

### Optional — only if you want to run the API outside Docker

| Tool | Version | Why |
|---|---|---|
| **Python** | **3.11** or newer | The FastAPI app |
| **Postgres + pgvector** | 16 | Database (Docker provides this for you otherwise) |
| **Redis** | 7 | Celery broker + result backend |
| **MinIO** (or S3-compatible) | latest | Object storage for documents + attachments |

For 99% of cases you do **not** need any of these — `docker compose up -d` handles them all. Skip ahead.

### Optional — AI features

The protocol compiler, photo verification, and Q&A features call **Anthropic Claude**. The repo ships with a placeholder `ANTHROPIC_API_KEY` in `openbench/.env`. To use your own:

1. Get a key at https://console.anthropic.com/
2. Edit `openbench/.env` and set `ANTHROPIC_API_KEY=sk-ant-...` (or paste it later in the console's **API Keys** page)
3. Recreate the api container: `cd openbench && docker compose up -d api`

The console runs fine without a working key — only AI-driven features (compile draft from documents, photo assessment, ask AI in run) will fail.

---

## 2. Install JavaScript dependencies

Two `npm install` runs cover both UI apps.

### Console (Next.js)

```bash
cd UI/app/openbench
npm install
```

Installs Next.js 15, React 19, Recharts, Tailwind, Sonner, Lucide icons, react-hook-form. Takes 1–2 minutes the first time.

### Landing page (Vite)

```bash
cd UI/app          # NOT UI/app/openbench
npm install
```

Installs Vite 7, React 19, Tailwind, GSAP, Radix UI primitives, shadcn components.

> **Tip:** the landing page directory and the console directory each have their own `package.json` and `node_modules`. They're independent installs.

---

## 3. Configure environment

The repo only ships `.env.example` templates — no real secrets. Copy them into the actual env files before first boot.

### Backend (`openbench/.env`)

```bash
cp openbench/.env.example openbench/.env
```

The defaults in the template are fine for local development. Things you'll want to change:

| Variable | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude key — required for AI features. Optional at boot since you can also paste it from the console's **API Keys** page after sign-in. |
| `JWT_SECRET` | JWT signing secret. **Change for production** (`openssl rand -hex 32`). |
| `CORS_ORIGINS` | Comma-separated allowed origins. Add any additional origins here. |
| `SEED_PASSWORD` | Password for the three demo accounts (default `Bench!Demo1`). |

After editing, recreate the api container so it picks up the new env:

```bash
cd openbench
docker compose up -d api
```

### Console (`UI/app/openbench/.env.local`)

```bash
cp UI/app/openbench/.env.local.example UI/app/openbench/.env.local
```

The defaults point the console at `http://localhost:8000`. Change `NEXT_PUBLIC_API_BASE_URL` only if you're running the API somewhere else.

### Landing page

No env required.

---

## 4. Run it

### Start the backend

```bash
cd openbench
docker compose up -d
```

This pulls images (~2 GB first time) and starts:
- `db` — Postgres 16 + pgvector on `:5432`
- `redis` — on `:6379`
- `minio` — S3-compatible object store on `:9000` (console on `:9001`)
- `api` — FastAPI on `:8000`
- `worker` — Celery worker
- `web` — original openbench-monorepo marketing site on `:3000` (you can ignore this; the new landing page is what we use)

On first boot the API runs Alembic migrations and seeds a demo organization with three users. This takes ~30 seconds. Watch progress:

```bash
docker compose logs -f api
```

When you see `Uvicorn running on http://0.0.0.0:8000`, it's ready.

Verify:

```bash
curl http://localhost:8000/health
# {"status":"ok","app_name":"OpenBench OS",...}
```

### Start the landing page (open this first)

The landing page is the front door. Start it before the console.

> The bundled `openbench/web` Docker container also occupies port 3000. Either stop it (`docker compose stop web` from `openbench/`) or run the landing page on a different port (shown below).

```bash
cd UI/app
npm run dev                          # uses port 3000 by default
# or, if 3000 is taken:
npx vite --port 3001
```

**Open http://localhost:3000** (or `:3001`) — this is what users see first. The `Login` / `Dashboard` links on the landing page route to the console.

### Start the console (separate terminal)

```bash
cd UI/app/openbench
npm run dev
```

Runs at http://localhost:4028. The landing page redirects here when you click `Login` — sign in with `admin@demo.lab` / `Bench!Demo1`.

---

## 5. Common issues

| Symptom | Fix |
|---|---|
| `Disallowed CORS origin` in browser console | Add the origin to `CORS_ORIGINS` in `openbench/.env`, then `docker compose up -d api` |
| Console login: "Invalid email or password" | Make sure the API booted (check `docker compose logs api`). Demo password is `Bench!Demo1`, case-sensitive. |
| Topbar shows `Offline` instead of `Live` | SSE didn't connect. Most often: API not running, token expired (re-login), or browser blocking EventSource. Hard-refresh with the API up. |
| `Port 3000 is already in use` (landing page) | Stop the openbench-web container (`cd openbench && docker compose stop web`) or run on `:3001` |
| `Port 4028 already in use` (console) | Find the stale `node` process and kill it, or pass `npx next dev -p 4029` |
| `npm install` errors about `node-gyp` / `python` | You're on Node < 20 or missing build tools. Upgrade Node to 20+. |
| Docker says `permission denied` on Linux | Add yourself to the `docker` group: `sudo usermod -aG docker $USER`, then log out and back in |
| `alembic upgrade head` fails on api boot | The `db` container probably isn't healthy yet. `docker compose down -v && docker compose up -d` to start fresh. |

---

## 6. Verifying everything works

```bash
# API
curl http://localhost:8000/health

# Login + dashboard (replace TOKEN with the access_token from login)
curl -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.lab","password":"Bench!Demo1"}'

curl -H "Authorization: Bearer <TOKEN>" http://localhost:8000/api/dashboard

# Console
curl -o /dev/null -w "%{http_code}\n" http://localhost:4028/sign-up-login   # 200

# Landing page
curl -o /dev/null -w "%{http_code}\n" http://localhost:3000                  # 200
```

If all four return data / 200, you're good.

---

## 7. Stopping everything

```bash
# Stop console / landing dev servers: Ctrl-C in their terminals

# Stop backend
cd openbench
docker compose down

# Stop AND wipe database / minio data:
docker compose down -v
```

`down -v` removes the volumes — next `up -d` will reseed the demo org from scratch.
