# Demo script

A 5–7 minute walkthrough that exercises every pillar.

## Setup (one-time)

1. `cp .env.example .env` and set `ANTHROPIC_API_KEY=...`.
2. `docker compose up --build`.
3. Wait for `api` to log `Application startup complete.` and `web` to log `ready`.

Available URLs:

- Console: http://localhost:3000/console
- Bench: http://localhost:3000/app
- API docs: http://localhost:8000/docs
- MinIO console: http://localhost:9001 (minio / minio12345)

Demo seeds: `reviewer@demo.lab`, `operator@demo.lab`, `admin@demo.lab` with password
`Bench!Demo1`.

## Optional: stage a bench photo

Take or stage two photos:

- `bench_setup_ok.jpg` — labeled tubes, secondary containment tray, waste bottle, pipette
  display visible.
- `bench_setup_missing_containment.jpg` — same scene without the containment tray.

## Flow

### Scene 1 — Upload & compile

1. Sign in as `reviewer@demo.lab` at `/login`.
2. Open **Protocols → New**.
3. Upload `sample-data/sop.md`, `sample-data/sds.md`, `sample-data/equipment_manual.md`
   (or any equivalent PDFs).
4. Tick all three documents and enter a name like *Sample Prep SOP*.
5. Click **Compile draft**. After 30–90 seconds the draft review screen opens.

### Scene 2 — Review the graph

Show:

- Step list with PPE, materials, controls, timers, visual checks.
- Hazard rules from the SDS mapped to specific steps.
- Source citations on every step.
- Reviewer can edit titles and instructions inline.

Click **Publish version**.

### Scene 3 — Start a run

Switch identity (sign out → sign in as `operator@demo.lab`) and visit `/app`. Open the
published protocol → **Start run**.

### Scene 4 — Step execution

On step 4 ("Verify bench setup"):

- Click **Read aloud** to demonstrate accessibility.
- Click **Ask** and type: *What PPE applies here?* → Coach answers from the SOP/SDS with
  citations.
- Toggle the **Voice** button and say *"What hazards apply here?"* — the same path runs
  via Web Speech API.

### Scene 5 — Photo check (the killer moment)

Click **Photo check**, upload the *missing containment* photo. The Vision Checkpoint
returns:

- `confirmed`: labeled tubes
- `not_visible`: secondary containment
- `cannot_verify`: ventilation status (no readable indicator)

Overall status: `attention_required`. Recommended action: pause and verify.

### Scene 6 — Deviation + resolution

Click **Mark deviation** → severity `moderate`, title *"Initial setup missing secondary
containment; corrected"*. Re-upload the OK photo and verify all required items confirm.

Click **Complete step**.

### Scene 7 — Finish & handover

Walk through remaining steps quickly. After the last step, the run state becomes
`completed`. Click **Generate handover** then **Finalize PDF** and **Download PDF**. Show
the structured report (timeline, deviations, unresolved items, sources, disclaimer).

### Scene 8 — Console review

Switch back to `reviewer@demo.lab`. Open **Runs → (the run id)** to show the manager view:
event log, step states, deviations, photo assessments, handover preview, audit log entries.

### Closing

> "OpenBench OS does not replace the scientist or safety officer. It makes the approved
> procedure executable, accessible, and traceable."
