# AI pipelines

OpenBench OS uses six pipelines built on Anthropic Claude Opus 4.7 (with Haiku 4.5 for
short Q&A). Every prompt contract lives in `services/api/app/ai/prompts.py` and every
output is schema-validated JSON. Free text is allowed only inside designated fields.

## Source-grounding rule

> Every claim must point to source evidence inside one of the supplied documents. No
> source, no claim.

The compiler enforces this by stripping any `source_refs` whose `document_id` does not
appear in the supplied document set, and the safety reviewer flags answers that lack
citations.

## Pipelines

### 1. Protocol Compiler (Opus)

`app.ai.compiler.compile_protocol`

- Input: SOP, SDS, equipment manual, optional policy overlays.
- Output: `{name, summary, steps[]}` with full step graph (PPE, controls, materials,
  timers, visual checks, stop conditions, data capture, source refs, confidence).
- Confidence is mapped to a numeric `confidence_score` for reviewer triage.

### 2. Hazard Mapper (Opus)

`app.ai.compiler.compile_hazards`

- Input: SDS / policy / manual + the compiled step keys.
- Output: `hazard_rules[]` with category, severity, sources, and which steps each rule
  applies to. Plus `missing_coverage[]` notes for the reviewer.
- Severity `critical` implies a stop condition in run-time evaluation.

### 3. Step Q&A — Execution Coach (Haiku)

`app.ai.qa.answer_step_question`

- Retrieves top chunks via Postgres FTS scoped to the active protocol's source documents,
  then asks the model with the strict QA contract.
- Output: `{answer_text, citations, confidence, escalation_required, suggested_action}`.
- Always run through Safety Reviewer before returning to the operator.

### 4. Visual Checkpoint Engine (Opus, vision)

`app.ai.vision.assess_photo`

- Input: bench photo + active step's visual checklist + supporting source snippets.
- Output: `{overall_status, items[], recommended_action}` with status taxonomy
  `confirmed | not_visible | unclear | cannot_verify`.
- The engine *never* identifies people and never infers hidden state.
- A required-and-not-confirmed item demotes overall_status from `ok` to
  `attention_required`. A visible spill / fire / broken glass triggers `stop`.

### 5. Report Generator — Historian (Opus)

`app.ai.report.generate_report` + `render_markdown`

- Input: full run summary built from events, step states, timers, deviations, photo
  assessments.
- Output: structured JSON; rendered to Markdown → HTML → PDF (WeasyPrint) for finalization.
- The model never claims the run is "safe"; the report explicitly carries that disclaimer.

### 6. Safety Reviewer (Haiku, with heuristic pre-checks)

`app.ai.safety.review_qa_answer`

- Audits operator-facing AI outputs for unsupported claims, missing citations, overconfident
  phrasing, impermissible protocol invention, identity analysis of people, claims of safety.
- Returns `{verdict, issues, rewrite_suggestion, force_escalation}`. `block` verdicts are
  replaced with a generic refusal that escalates to a supervisor.

## Retrieval

`services/api/app/services/retrieval.py` uses Postgres `to_tsvector` with a fallback to
RapidFuzz token-set ratio when FTS returns nothing. The `document_chunks.embedding` column
is reserved for an embedding-based future upgrade (pgvector dim = 384).

## Prompt rules summary

- Output **JSON only**, no Markdown fences, no preamble.
- All free text fields are short and operator-facing.
- For dangerous or out-of-scope questions, refuse and escalate; do not invent.
- For images: only assess items in the explicit checklist. Use `cannot_verify` liberally.
