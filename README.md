<div align="center">

<!-- Logo / Hero Banner -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/banner-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/banner-light.svg">
  <img alt="OpenBench OS" src="docs/assets/banner-light.svg" width="720">
</picture>

<br/>

# 🧬 OpenBench OS

### *The Protocol Runtime Platform for Physical Labs*

**Compile approved SOPs, SDSs, and equipment manuals into governed execution graphs — then run them with checkpoints, photo verification, voice assistance, deviation capture, and event-sourced handover reports.**

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20First-0078D4?style=for-the-badge&logo=windows)](https://github.com/yuki-20/OS-Bench)
[![AI](https://img.shields.io/badge/Powered%20by-Opus%204.7-7C3AED?style=for-the-badge)](https://www.anthropic.com)
[![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20FastAPI%20%7C%20Tauri%202-06B6D4?style=for-the-badge)](https://github.com/yuki-20/OS-Bench)
[![PRD](https://img.shields.io/badge/PRD-v3.0-orange?style=for-the-badge)](docs/product/)

<br/>

[**Getting Started**](#-getting-started) · [**Architecture**](#-architecture) · [**Product Surfaces**](#-product-surfaces) · [**AI System**](#-ai-system) · [**API Reference**](#-api-reference) · [**Contributing**](#-contributing)

---

</div>

<br/>

## 🔬 The Problem

Labs have **approved documents** — SOPs, SDSs, equipment manuals, chemical hygiene plans. But at the moment of execution, operators are still flipping through PDFs, interpreting dense safety sheets from memory, and reconstructing what happened in shift handovers **after** the work is done.

> **Approved documents exist. The executable runtime usually does not.**
>
> **OpenBench OS creates that runtime.**

<br/>

## ✨ What OpenBench OS Does

OpenBench OS **compiles** approved lab documents into **versioned execution graphs**, then **runs** those graphs through:

| Capability | Description |
|:---|:---|
| 📋 **Protocol Compilation** | Transforms SOPs + SDSs + manuals into structured, reviewable execution graphs |
| 🔒 **Immutable Versioning** | Published protocols are frozen — every run binds to an exact version |
| ⚙️ **Explicit Run Engine** | Step-by-step execution with state machines, blockers, timers, and confirmations |
| 📸 **Photo Verification** | Vision-based checkpoint verification against step-specific checklists |
| ⚠️ **Deviation Capture** | Log deviations in real-time, not after the fact |
| 📊 **Event-Sourced Handover** | Reports generated from actual recorded events, not chat memory |
| 🔍 **Source Citations** | Every safety-relevant claim maps to source evidence |
| 🤖 **AI Trace Panel** | Full operational traceability for every AI output |

<br/>

## 🚫 What This Is NOT

| ❌ Not This | ✅ But This |
|:---|:---|
| Chat with SOPs | A protocol **runtime** with governed state |
| Generic AI wrapper | Schema-validated AI pipelines with citations |
| ELN replacement | An **execution layer** that complements ELNs |
| Lab automation platform | A **document intelligence + run engine** platform |
| Autonomous experiment designer | A **guided execution** system for approved procedures |

<br/>

---

## 🏗️ Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph CLIENT["🖥️ Client Layer"]
        direction LR
        BRC["🧪 Bench Runtime Client<br/><i>Tauri 2 + Next.js</i><br/><small>Windows-first desktop</small>"]
        WCC["🌐 Web Control Console<br/><i>Next.js App Router</i><br/><small>Browser-based admin</small>"]
        MOB["📱 Mobile Companion<br/><i>Responsive PWA</i><br/><small>Tablet / phone</small>"]
    end

    subgraph GATEWAY["🔐 Gateway Layer"]
        API["FastAPI Gateway<br/><small>Auth · Validation · Routing · Signed URLs</small>"]
    end

    subgraph CORE["⚙️ Core Services"]
        direction LR
        PS["📋 Protocol<br/>Service"]
        RO["🔄 Run<br/>Orchestrator"]
        RS["📊 Report<br/>Service"]
        NS["🔔 Notification<br/>Service"]
    end

    subgraph AI["🤖 AI & Worker Pool"]
        direction LR
        DOC["📄 Document<br/>Parser"]
        COMP["🧠 Protocol<br/>Compiler"]
        QA["💬 Step<br/>Q&A"]
        VIS["📸 Vision<br/>Checkpoint"]
        REP["📑 Report<br/>Generator"]
        SAFE["🛡️ Safety<br/>Critic"]
    end

    subgraph DATA["💾 Persistence Layer"]
        direction LR
        PG["🐘 PostgreSQL<br/>+ pgvector"]
        RD["🔴 Redis<br/>Queue + Cache"]
        S3["☁️ Object Storage<br/>S3-compatible"]
        SQ["📦 SQLite<br/>Local Cache"]
    end

    BRC --> API
    WCC --> API
    MOB --> API
    BRC -.->|"offline cache"| SQ

    API --> PS
    API --> RO
    API --> RS
    API --> NS

    PS --> AI
    RO --> AI
    RS --> AI

    COMP --> SAFE
    QA --> SAFE
    VIS --> SAFE

    PS --> PG
    RO --> PG
    RS --> PG
    RS --> S3
    DOC --> S3
    AI --> RD

    style CLIENT fill:#1a1a2e,stroke:#7C3AED,stroke-width:2px,color:#fff
    style GATEWAY fill:#16213e,stroke:#06B6D4,stroke-width:2px,color:#fff
    style CORE fill:#0f3460,stroke:#3B82F6,stroke-width:2px,color:#fff
    style AI fill:#1a0a2e,stroke:#A855F7,stroke-width:2px,color:#fff
    style DATA fill:#1e1e1e,stroke:#10B981,stroke-width:2px,color:#fff
```

<br/>

### Protocol Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft: Upload Documents
    Draft --> InReview: Submit for Review
    InReview --> Draft: Reviewer Requests Changes
    InReview --> Published: Reviewer Approves & Publishes
    Published --> Archived: Admin Archives
    Published --> [*]: Immutable — Runs Bind Here

    state Draft {
        [*] --> Parsing: Document Upload
        Parsing --> Compiling: Parse Complete
        Compiling --> Editing: Graph Generated
        Editing --> Ready: Review Ready
    }

    note right of Published
        ⚠️ Published versions are IMMUTABLE
        New uploads create new version candidates
        Runs always bind to exact published version
    end note
```

<br/>

### Run Engine State Machine

```mermaid
stateDiagram-v2
    [*] --> Created: Create from Published Protocol
    Created --> Preflight: Initialize
    Preflight --> Active: All Checks Pass
    Active --> Paused: Operator Pauses
    Paused --> Active: Operator Resumes
    Active --> Blocked: Critical Unresolved Condition
    Blocked --> Active: Condition Resolved
    Blocked --> AwaitingOverride: Override Requested
    AwaitingOverride --> Active: Override Approved
    AwaitingOverride --> Blocked: Override Denied
    Active --> Completed: All Steps Done + Handover Finalized
    Active --> Cancelled: Operator/Admin Cancels
    Completed --> Closed: Post-processing Complete
    Cancelled --> Closed: Investigation Complete
```

<br/>

### Step Lifecycle

```mermaid
stateDiagram-v2
    [*] --> NotStarted
    NotStarted --> InProgress: Start Step
    InProgress --> WaitingOnTimer: Timer Required
    InProgress --> WaitingOnCheckpoint: Photo Check Required
    WaitingOnTimer --> InProgress: Timer Elapsed
    WaitingOnCheckpoint --> InProgress: Checkpoint Resolved
    InProgress --> Blocked: Critical Condition Unresolved
    Blocked --> InProgress: Resolved
    InProgress --> Completed: All Requirements Met
    InProgress --> Skipped: Skippable + Reason Provided

    note right of Completed
        ✅ Completion requires:
        • Prerequisites satisfied
        • Confirmations recorded
        • Timers satisfied or overridden
        • Visual checks confirmed or overridden
        • No active critical stop conditions
    end note
```

<br/>

---

## 🖥️ Product Surfaces

### Surface Overview

```mermaid
graph LR
    subgraph OPERATOR["🧪 Operator"]
        B["Bench Runtime Client"]
        M["Mobile Companion"]
    end

    subgraph REVIEWER["📋 Reviewer / Manager"]
        W["Web Control Console"]
    end

    subgraph BACKEND["☁️ Backend"]
        S["Cloud + AI Services"]
    end

    B -->|"execute runs,<br/>photos, voice"| S
    M -->|"quick capture,<br/>alerts, handover"| S
    W -->|"upload, review,<br/>publish, audit"| S

    style OPERATOR fill:#1a1a2e,stroke:#7C3AED,stroke-width:2px,color:#fff
    style REVIEWER fill:#0f3460,stroke:#3B82F6,stroke-width:2px,color:#fff
    style BACKEND fill:#1e1e1e,stroke:#10B981,stroke-width:2px,color:#fff
```

<br/>

### 🧪 Surface A — Bench Runtime Client

> **Windows-first installable desktop application** for operators at the bench.

- **Tech:** Tauri 2 shell wrapping shared Next.js/React UI
- **Offline:** Encrypted SQLite local cache, event journaling, retry/sync
- **Key Screens:** Home → Protocol Library → Preflight → Live Run → Photo Check → Deviation → Handover Preview → Sync Status

```
/app/home
/app/protocols
/app/protocols/{protocolVersionId}
/app/runs
/app/runs/{runId}
/app/runs/{runId}/checkpoint/{stepId}
/app/runs/{runId}/deviation
/app/runs/{runId}/handover
/app/sync
/app/settings
```

### 🌐 Surface B — Web Control Console

> **Browser-based admin/reviewer surface** for protocol management, run oversight, and audit.

- **Users:** Reviewers, Lab Managers, EHS/Safety Leads, Org Admins
- **Key Screens:** Dashboard → Upload Workspace → Protocol Draft Review → Published Version View → Run Detail → Deviation Queue → Team Admin → Settings

```
/console/dashboard
/console/protocols
/console/protocols/new
/console/protocols/{draftId}/review
/console/protocols/{versionId}
/console/runs
/console/runs/{runId}
/console/deviations
/console/reports
/console/team
/console/settings
/console/audit
```

### 📱 Surface C — Tablet / Mobile Companion

> **Responsive PWA** for photo capture, step review, alerts, and handover consumption.

### ☁️ Surface D — Cloud + AI Services

> **Backend platform** powering document ingestion, protocol compilation, run orchestration, photo verification, reporting, and audit.

<br/>

---

## 🤖 AI System

### Opus 4.7 Pipeline Architecture

```mermaid
graph TD
    subgraph INPUTS["📥 Inputs"]
        SOP["📄 SOPs"]
        SDS["⚠️ SDSs"]
        MAN["📘 Equipment Manuals"]
        POL["📜 Lab Policies"]
        IMG["📸 Bench Photos"]
        QST["❓ Operator Questions"]
        EVT["📊 Run Events"]
    end

    subgraph PIPELINES["🧠 AI Pipelines — Opus 4.7"]
        A["Pipeline A<br/>Document Understanding<br/><small>Classify · Parse · Chunk · Index</small>"]
        B["Pipeline B<br/>Protocol Compilation<br/><small>Steps · Hazards · PPE · Checks</small>"]
        C["Pipeline C<br/>Step Q&A<br/><small>Citations · Confidence · Escalation</small>"]
        D["Pipeline D<br/>Vision Checkpoint<br/><small>Checklist Assessment · Evidence</small>"]
        E["Pipeline E<br/>Report Generation<br/><small>Handover · Summary · PDF</small>"]
    end

    subgraph SAFETY["🛡️ Safety Layer"]
        SC["Safety Critic<br/><small>Unsupported claims · Missing citations<br/>Overconfidence · Escalation triggers</small>"]
    end

    subgraph OUTPUTS["📤 Schema-Validated JSON Outputs"]
        PG["Protocol Graph"]
        HM["Hazard Map"]
        ANS["Cited Answers"]
        PA["Photo Assessment"]
        HR["Handover Report"]
    end

    SOP & SDS & MAN & POL --> A
    A --> B
    QST --> C
    IMG --> D
    EVT --> E

    B --> SC
    C --> SC
    D --> SC

    SC --> PG & HM
    SC --> ANS
    SC --> PA
    E --> HR

    style INPUTS fill:#1a1a2e,stroke:#6366F1,stroke-width:2px,color:#fff
    style PIPELINES fill:#1a0a2e,stroke:#A855F7,stroke-width:2px,color:#fff
    style SAFETY fill:#2a0a0e,stroke:#EF4444,stroke-width:2px,color:#fff
    style OUTPUTS fill:#0a2a1e,stroke:#10B981,stroke-width:2px,color:#fff
```

<br/>

### AI Trace Panel

Every AI output includes an operational trace — not chain-of-thought, but auditable metadata:

| Field | Description |
|:---|:---|
| `task_type` | compilation, step_qa, photo_check, safety_critic, report |
| `model` | The model used (e.g., Opus 4.7) |
| `source_documents` | Documents and chunks consumed |
| `protocol_version` | Bound protocol version ID |
| `current_step` | Active step context |
| `output_schema` | Schema name validated against |
| `citation_coverage` | Percentage of claims with source backing |
| `confidence_flags` | Per-item confidence and uncertainty |
| `safety_critic_result` | Pass / flagged / escalated |
| `state_mutation` | Whether the output changed run state |
| `human_review_required` | Whether human approval is needed |

<br/>

### Cross-Document Reasoning Example

> 🧠 **Why this matters:** Opus 4.7 doesn't just retrieve — it **synthesizes** across documents.

```
📄 SOP says:        "Wear compatible gloves"
⚠️ SDS specifies:   "Nitrile gloves required"
📘 Manual warns:    "No wet gloves near control panel"

    ↓ OpenBench maps all three into Step 4's control card
    ↓ Each source is cited independently
    ↓ Operator sees unified, actionable guidance
```

<br/>

---

## 🔄 Event-Sourced Architecture

### Why Events Matter

OpenBench OS uses **append-only event capture** as its source of truth:

```mermaid
graph LR
    subgraph EVENTS["📊 Event Stream (Append-Only)"]
        E1["run_created"]
        E2["run_started"]
        E3["step_started"]
        E4["timer_started"]
        E5["note_added"]
        E6["photo_uploaded"]
        E7["photo_assessed"]
        E8["block_triggered"]
        E9["deviation_added"]
        E10["override_requested"]
        E11["override_resolved"]
        E12["step_completed"]
        E13["run_completed"]
        E14["handover_generated"]
    end

    subgraph DERIVED["📑 Derived Outputs"]
        R["Handover Report"]
        A["Audit Trail"]
        AN["Analytics"]
        T["Timeline View"]
    end

    E1 & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9 & E10 & E11 & E12 & E13 & E14 --> R & A & AN & T

    style EVENTS fill:#1a1a2e,stroke:#7C3AED,stroke-width:2px,color:#fff
    style DERIVED fill:#0a2a1e,stroke:#10B981,stroke-width:2px,color:#fff
```

Each event includes: `event_id` · `run_id` · `event_type` · `actor_id` · `device_id` · `step_id` · `timestamp` · `payload_json` · `local_seq` · `idempotency_key` · `server_timestamp`

<br/>

---

## 📡 API Reference

### Core Endpoints

<details>
<summary><b>🔐 Authentication</b></summary>

| Method | Path | Purpose |
|:---|:---|:---|
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/refresh` | Refresh session token |
| `POST` | `/api/auth/logout` | Revoke session |
| `GET` | `/api/auth/me` | Current user + memberships |

</details>

<details>
<summary><b>📄 Documents & Protocols</b></summary>

| Method | Path | Purpose |
|:---|:---|:---|
| `POST` | `/api/documents/upload` | Upload document, get signed URL |
| `POST` | `/api/documents/{id}/finalize` | Trigger parsing |
| `GET` | `/api/documents/{id}` | Document metadata |
| `GET` | `/api/documents/{id}/chunks` | Chunks & citations |
| `POST` | `/api/protocol-drafts/compile` | Compile draft from documents |
| `GET` | `/api/protocol-drafts/{id}` | Fetch compiled draft |
| `PATCH` | `/api/protocol-drafts/{id}` | Edit draft during review |
| `POST` | `/api/protocol-drafts/{id}/publish` | Publish immutable version |
| `GET` | `/api/protocol-versions/{id}` | Fetch published version |
| `POST` | `/api/protocol-versions/{id}/archive` | Archive version |

</details>

<details>
<summary><b>🔄 Runs</b></summary>

| Method | Path | Purpose |
|:---|:---|:---|
| `POST` | `/api/runs` | Create run from protocol version |
| `GET` | `/api/runs/{id}` | Run state & summary |
| `POST` | `/api/runs/{id}/start` | Transition to active |
| `POST` | `/api/runs/{id}/pause` | Pause run |
| `POST` | `/api/runs/{id}/resume` | Resume run |
| `POST` | `/api/runs/{id}/steps/{stepId}/start` | Start step |
| `POST` | `/api/runs/{id}/steps/{stepId}/complete` | Complete step (validates rules) |
| `POST` | `/api/runs/{id}/steps/{stepId}/skip` | Skip if permitted |
| `POST` | `/api/runs/{id}/notes` | Add note |
| `POST` | `/api/runs/{id}/measurements` | Add measurement |
| `POST` | `/api/runs/{id}/deviations` | Add deviation |
| `POST` | `/api/runs/{id}/timers` | Start timer |
| `POST` | `/api/runs/{id}/override-requests` | Request override |

</details>

<details>
<summary><b>🤖 AI & Checkpoints</b></summary>

| Method | Path | Purpose |
|:---|:---|:---|
| `POST` | `/api/runs/{id}/ask` | Step-scoped Q&A |
| `POST` | `/api/runs/{id}/steps/{stepId}/photo-check` | Photo checkpoint assessment |
| `GET` | `/api/runs/{id}/steps/{stepId}/photo-assessments` | List assessments |

</details>

<details>
<summary><b>📊 Reports & Audit</b></summary>

| Method | Path | Purpose |
|:---|:---|:---|
| `POST` | `/api/runs/{id}/handover/generate` | Generate handover report |
| `GET` | `/api/runs/{id}/handover` | Fetch current report |
| `POST` | `/api/runs/{id}/handover/finalize` | Finalize handover |
| `GET` | `/api/runs/{id}/handover/pdf` | Download PDF |
| `GET` | `/api/admin/audit` | Query audit records |

</details>

<br/>

---

## 🗄️ Data Model

### Entity Relationship Diagram

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ MEMBERSHIPS : has
    ORGANIZATIONS ||--o{ DOCUMENTS : owns
    ORGANIZATIONS ||--o{ PROTOCOLS : owns
    ORGANIZATIONS ||--o{ RUNS : contains
    ORGANIZATIONS ||--o{ AUDIT_LOGS : tracks

    USERS ||--o{ MEMBERSHIPS : belongs_to
    USERS ||--o{ RUNS : operates

    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : contains

    PROTOCOLS ||--o{ PROTOCOL_VERSIONS : versions
    PROTOCOL_VERSIONS ||--o{ PROTOCOL_STEPS : defines
    PROTOCOL_VERSIONS ||--o{ HAZARD_RULES : maps
    PROTOCOL_VERSIONS ||--o{ RUNS : binds

    RUNS ||--o{ RUN_EVENTS : appends
    RUNS ||--o{ STEP_STATE : tracks
    RUNS ||--o{ TIMERS : manages
    RUNS ||--o{ DEVIATIONS : captures
    RUNS ||--o{ ATTACHMENTS : stores
    RUNS ||--o{ PHOTO_ASSESSMENTS : verifies
    RUNS ||--|| HANDOVER_REPORTS : generates

    PROTOCOL_STEPS ||--o{ HAZARD_RULES : has
    PROTOCOL_STEPS ||--o{ STEP_STATE : references

    ATTACHMENTS ||--o{ PHOTO_ASSESSMENTS : assessed_in

    ORGANIZATIONS {
        uuid id PK
        string name
        string slug
        string data_region
        int retention_policy_days
    }

    USERS {
        uuid id PK
        string email
        string display_name
        string status
    }

    PROTOCOL_VERSIONS {
        uuid id PK
        uuid protocol_id FK
        string version_label
        string status
        string source_docset_hash
        uuid published_by
    }

    RUNS {
        uuid id PK
        uuid protocol_version_id FK
        uuid operator_id FK
        string status
        uuid current_step_id
        string device_id
    }

    RUN_EVENTS {
        uuid id PK
        uuid run_id FK
        string event_type
        uuid actor_id
        string idempotency_key
        jsonb payload_json
    }
```

<br/>

---

## 👥 Roles & Permissions

```mermaid
graph TB
    subgraph ROLES["Role Hierarchy"]
        OP["🧪 Operator"]
        RV["📋 Reviewer"]
        MG["👔 Manager"]
        SL["🛡️ Safety Lead"]
        AD["⚙️ Org Admin"]
    end

    subgraph PERMISSIONS["Permissions"]
        direction LR
        P1["Start/Execute Runs"]
        P2["Upload Photos & Notes"]
        P3["Request Overrides"]
        P4["Review/Edit Drafts"]
        P5["Publish Protocols"]
        P6["Approve Overrides"]
        P7["Assign Protocols"]
        P8["Export Reports"]
        P9["Manage Safety Overlays"]
        P10["Configure Escalations"]
        P11["Manage Users & Settings"]
        P12["Org Audit Access"]
    end

    OP --> P1 & P2 & P3
    RV --> P4 & P5 & P6
    MG --> P6 & P7 & P8
    SL --> P9 & P10
    AD --> P11 & P12

    style ROLES fill:#1a1a2e,stroke:#7C3AED,stroke-width:2px,color:#fff
    style PERMISSIONS fill:#0f3460,stroke:#3B82F6,stroke-width:2px,color:#fff
```

| Permission | Operator | Reviewer | Manager | Safety Lead | Org Admin |
|:---|:---:|:---:|:---:|:---:|:---:|
| Start run | ✅ | — | — | — | — |
| Upload photo / add note | ✅ | — | — | — | — |
| Request override | ✅ | — | — | — | — |
| Edit draft protocol | — | ✅ | — | — | — |
| Publish protocol | — | ✅ | — | — | — |
| Review flagged runs | — | ✅ | — | — | — |
| Approve overrides | — | ✅ | ✅ | — | — |
| Assign protocols | — | — | ✅ | — | — |
| View team runs | — | — | ✅ | — | — |
| Export reports | — | — | ✅ | — | — |
| Manage safety overlays | — | — | — | ✅ | — |
| Review escalations | — | — | — | ✅ | — |
| Manage users & settings | — | — | — | — | ✅ |
| Org-wide audit access | — | — | — | — | ✅ |

<br/>

---

## 🗂️ Repository Structure

```
openbench/
├── apps/
│   ├── console-web/          # Next.js control console (reviewer/admin)
│   └── bench-desktop/        # Tauri 2 shell (operator runtime)
├── packages/
│   ├── ui/                   # Shared React component library
│   ├── schemas/              # Shared Zod / JSON schemas
│   └── client-core/          # Sync client, storage abstractions
├── services/
│   ├── api/                  # FastAPI gateway + domain services
│   └── workers/              # Background jobs & AI pipelines
├── infra/
│   ├── docker/               # Container definitions
│   ├── k8s/                  # Kubernetes manifests
│   ├── migrations/           # Alembic database migrations
│   └── scripts/              # Dev/deploy scripts
└── docs/
    ├── product/              # PRD, specs, decision records
    ├── architecture/         # Architecture docs & diagrams
    └── runbooks/             # Operational runbooks
```

<br/>

---

## ⚡ Tech Stack

| Layer | Technology | Rationale |
|:---|:---|:---|
| **Shared Frontend** | Next.js App Router + React + TypeScript | Shared component model across web + desktop |
| **Styling** | Tailwind CSS + shadcn/ui | Rapid, consistent UI development |
| **State** | TanStack Query + Zustand | Server-state sync + local UI state |
| **Validation** | Zod | Shared schema validation client ↔ server |
| **Desktop Shell** | Tauri 2 | Lightweight native wrapper, encrypted SQLite cache |
| **Backend API** | FastAPI + Pydantic | Typed Python APIs, JSON-schema contracts |
| **ORM** | SQLAlchemy + Alembic | Migrations and query layer |
| **Jobs** | Redis + Celery | Async document parsing, AI pipelines, reports |
| **Database** | PostgreSQL + pgvector | Transactional state + vector retrieval |
| **Object Storage** | S3-compatible | Documents, photos, report artifacts |
| **Observability** | Sentry + PostHog + OpenTelemetry | Error tracking, analytics, metrics/tracing |
| **CI/CD** | GitHub Actions + Docker | Automated testing and deployment |

<br/>

---

## 🎯 Evaluation & Testing

### Golden Test Sets

| # | Protocol Pack | Validates |
|:---|:---|:---|
| 1 | Non-hazardous equipment setup | Basic step extraction, timers |
| 2 | Chemical handling with SDS | Hazard mapping, PPE, cross-doc reasoning |
| 3 | Instrument calibration checklist | Measurement capture, visual checks |
| 4 | Cleaning/decontamination SOP | Stop conditions, escalation triggers |
| 5 | Shift handover procedure | Event coverage, report generation |

### V1 Pass/Fail Targets

| Evaluation Area | Target |
|:---|:---|
| Protocol step extraction accuracy | ≥ 85% |
| Safety/PPE/control claims with citations | 100% |
| Critical unsupported operator-facing claims | 0 |
| Visual false-safe rate on critical missing items | 0 |
| Correct use of "cannot-verify" for hidden conditions | ≥ 90% |
| Handover report event coverage | ≥ 95% |
| Prompt-injection rejection (safety-critical) | 100% |
| Step Q&A citation coverage | ≥ 95% |
| Run state stored outside model | 100% |
| Published protocol version binding | 100% |

### Vision Test Set (12 staged images)

Correct setup · Missing label · Missing secondary containment · Wrong tube count · Blurry label · Blocked required item · Wrong container type · Spill-like prop · Unreadable display · Overcluttered bench · Partially occluded item · Cannot-verify condition

<br/>

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **Python** ≥ 3.11
- **Rust** (for Tauri 2)
- **PostgreSQL** ≥ 15
- **Redis** ≥ 7
- **Docker** (recommended)

### Quick Start

```bash
# Clone
git clone https://github.com/yuki-20/OS-Bench.git
cd OS-Bench

# Install frontend dependencies
npm install

# Install backend dependencies
cd services/api && pip install -r requirements.txt

# Start infrastructure
docker compose up -d postgres redis minio

# Run database migrations
cd services/api && alembic upgrade head

# Start the API server
uvicorn app.main:app --reload

# Start the web console (new terminal)
cd apps/console-web && npm run dev

# Start the desktop client (new terminal)
cd apps/bench-desktop && npm run tauri dev
```

<br/>

---

## 📋 Roadmap

```mermaid
gantt
    title OpenBench OS Roadmap
    dateFormat  YYYY-Q
    axisFormat  %Y-Q%q

    section Phase 0 — Foundation
    Auth, Orgs, Roles                    :done, p0a, 2026-Q2, 30d
    Document Ingestion                   :done, p0b, after p0a, 30d
    Protocol Drafts + Publish            :active, p0c, after p0b, 30d
    Core Run Engine + Desktop Shell      :p0d, after p0c, 45d

    section Phase 1 — Full V1
    Photo Checkpoint Engine              :p1a, after p0d, 30d
    Offline Queue & Sync                 :p1b, after p0d, 45d
    Deviation & Override Workflows       :p1c, after p1a, 30d
    Console + Audit + PDF Export         :p1d, after p1c, 30d
    Accessibility Baseline               :p1e, after p1d, 15d

    section Phase 1.1 — Trust & Polish
    Team Dashboards                      :p2a, after p1e, 30d
    Improved OCR & Handover Templates    :p2b, after p1e, 30d
    Webhook Exports                      :p2c, after p2a, 15d

    section Phase 2 — Adoption
    SSO/SCIM + ELN Integrations          :p3a, after p2c, 60d
    Training Simulator                   :p3b, after p2c, 45d
    Barcode/QR Module                    :p3c, after p3a, 30d
```

<br/>

---

## 🔒 Security & Privacy

- **TLS** in transit, **encryption at rest** for database and object storage
- **Encrypted SQLite** local cache for desktop client
- **Row-level tenant isolation** in PostgreSQL
- **Short-lived tokens** with refresh flow
- **Signed URLs** for all object access
- **No training on customer data** — documents are never used to train models
- **Configurable retention and deletion** windows
- **Audit logs** for all state-changing actions

<br/>

---

## ♿ Accessibility

OpenBench OS treats hands-busy, gloved, time-pressured workflows as **first-class use cases**:

- ⌨️ Full keyboard navigation
- 🔳 High contrast theme
- 🎯 Large target mode
- 🔊 Text-to-speech for current step
- 🔁 Repeat-last-instruction action
- 📏 Readable text scaling
- 🎤 Voice commands (with equivalent touch/keyboard actions)
- 📝 Accessible photo-check result summaries (not image-only)

<br/>

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

<br/>

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

<br/>

---

<div align="center">

**Built with 🧠 Opus 4.7 · ⚛️ Next.js · 🦀 Tauri 2 · 🐍 FastAPI · 🐘 PostgreSQL**

<br/>

*OpenBench OS — Not chat with SOPs. A protocol runtime.*

</div>
