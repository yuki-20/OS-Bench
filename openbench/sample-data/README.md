# Sample data

Demo documents for the OpenBench OS walkthrough. They are **illustrative only** and do not
represent a real reagent, real safety data sheet, or real equipment manual.

## Auto-seeded on first boot

You don't need to upload these manually. On first `docker compose up`, the API container's
seed step (`app.scripts.seed`) renders these Markdown files to PDF using WeasyPrint and
inserts them as `Document` rows in the demo org. The reviewer can immediately compile a
draft from them.

The canonical copies the seeder uses live at `services/api/sample_data/` (so they ship
inside the API container image). The duplicates here in `sample-data/` exist for humans to
read and for manual uploads if you want to re-test the upload flow.

## Files

- `sop.md` — staged Standard Operating Procedure ("Sample Prep SOP v1.3").
- `sds.md` — staged Safety Data Sheet for "Reagent A".
- `equipment_manual.md` — BP-1000 pipette manual excerpt.

## Photo capture for the visual checkpoint

Stage two photos for the Step 4 visual checkpoint:

- `bench_setup_ok.jpg` — labeled tubes, secondary containment tray, waste bottle,
  pipette display visible.
- `bench_setup_missing_containment.jpg` — same scene, but *without* the containment tray.

The visual verifier should mark the second one as `attention_required` with the secondary
containment item flagged `not_visible` and ventilation `cannot_verify`.

## Suggested demo flow

1. `docker compose up` — wait for `web` to log `ready` and `api` to log `Application startup complete`.
2. Sign in to the Console at <http://localhost:3000/console> as `reviewer@demo.lab`
   (password `Bench!Demo1`).
3. Open **Protocols → New** — three sample documents are already in the table.
4. Tick all three, click **Compile draft**, wait 30–90 seconds for the AI compile to finish.
5. Review the draft, optionally edit, click **Publish version**.
6. Sign out, sign in as `operator@demo.lab`, open `/app`, start a run from the published version.
7. At step 4, upload the missing-containment photo — observe the visual mismatch + escalation.
8. Log a deviation, complete the run, click **Generate handover**, then **Finalize PDF**.
