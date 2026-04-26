"""Full run-lifecycle test with mocked Anthropic client.

Bypasses the live Opus pipelines so the run engine, escalation auto-trigger,
AI Trace recording, and handover assembly can be exercised end-to-end without a
real API key.

Run inside the api container so it can import app modules and use the same DB.
"""
from __future__ import annotations

import asyncio
import json
import sys
import uuid
from datetime import datetime
from typing import Any, Dict

# In-process so we can monkey-patch the AI client.
sys.path.insert(0, "/app")

from sqlalchemy import select  # noqa: E402

from app.ai import client as ai_client  # noqa: E402
from app.ai import compiler as ai_compiler  # noqa: E402
from app.ai import conflicts as ai_conflicts  # noqa: E402
from app.ai import qa as ai_qa  # noqa: E402
from app.ai import vision as ai_vision  # noqa: E402
from app.db.session import session_scope  # noqa: E402
from app.models.ai_trace import AITrace  # noqa: E402
from app.models.escalation import Escalation, EvaluationRun  # noqa: E402
from app.models.organization import Organization  # noqa: E402
from app.models.protocol import Protocol, ProtocolVersion  # noqa: E402
from app.models.run import Run, RunEvent  # noqa: E402

from httpx import ASGITransport, AsyncClient  # noqa: E402


PASSWORD = "Bench!Demo1"


# --- Mock model outputs -----------------------------------------------------

FAKE_COMPILE = {
    "name": "Mocked Sample SOP",
    "summary": "Mocked compile output for testing.",
    "steps": [
        {
            "step_key": "S1",
            "title": "Setup workspace",
            "instruction": "Set up the bench area before starting.",
            "is_skippable": False,
            "prerequisites": [],
            "required_ppe": ["nitrile gloves", "safety glasses"],
            "controls": ["fume hood ventilation"],
            "materials": ["reagent A", "tubes"],
            "equipment": ["pipette"],
            "timers": [],
            "visual_checks": [
                {
                    "check_id": "vc_label",
                    "claim": "Reagent label is readable",
                    "required": True,
                    "rationale": "Must verify identity before use.",
                }
            ],
            "stop_conditions": ["unreadable label", "spill"],
            "expected_observations": [],
            "data_capture": [],
            "source_refs": [
                {
                    "document_id": None,  # filled in below
                    "page_no": 1,
                    "section_label": "Setup",
                    "chunk_id": None,
                    "quote_summary": "Set up the bench area",
                }
            ],
            "confidence": "high",
        },
        {
            "step_key": "S2",
            "title": "Transfer reagent",
            "instruction": "Transfer 5 mL of reagent A to a new tube.",
            "is_skippable": False,
            "prerequisites": ["S1"],
            "required_ppe": ["nitrile gloves"],
            "controls": ["fume hood"],
            "materials": [],
            "equipment": [],
            "timers": [{"label": "transfer", "duration_seconds": 30, "auto_start": False}],
            "visual_checks": [],
            "stop_conditions": [],
            "expected_observations": [],
            "data_capture": [],
            "source_refs": [
                {"document_id": None, "page_no": 1, "section_label": "Transfer",
                 "chunk_id": None, "quote_summary": "Transfer 5 mL"}
            ],
            "confidence": "medium",
        },
    ],
}

FAKE_HAZARD = {
    "hazard_rules": [
        {
            "category": "ppe",
            "step_keys": ["S1", "S2"],
            "requirement_text": "Wear nitrile gloves and safety glasses.",
            "severity": "high",
            "source_refs": [{"document_id": None, "page_no": 1, "section_label": "PPE",
                              "chunk_id": None, "quote_summary": "PPE required."}],
        }
    ],
    "missing_coverage": [],
}

FAKE_CONFLICTS = {
    "conflicts": [
        {
            "topic": "Glove material",
            "summary": "SOP says compatible gloves; SDS specifies nitrile.",
            "step_keys": ["S1"],
            "severity": "standard",
            "sources": [
                {"document_id": None, "page_no": 1, "section_label": "PPE",
                 "quote_summary": "compatible gloves", "claim": "compatible gloves"},
                {"document_id": None, "page_no": 2, "section_label": "Hazards",
                 "quote_summary": "nitrile gloves required", "claim": "nitrile gloves required"},
            ],
            "recommended_action": "Specify nitrile gloves on the Step 1 control card.",
        }
    ],
    "gaps": [],
    "synthesis_cards": [
        {
            "step_keys": ["S1"],
            "topic": "Hand protection",
            "combined_requirement": "Nitrile gloves required; do not use wet gloves near control panel.",
            "sources": [
                {"document_id": None, "page_no": 1, "section_label": "PPE", "quote_summary": "compatible gloves"},
                {"document_id": None, "page_no": 2, "section_label": "Hazards", "quote_summary": "nitrile required"},
                {"document_id": None, "page_no": 1, "section_label": "Manual", "quote_summary": "no wet gloves"},
            ],
        }
    ],
}

FAKE_QA = {
    "answer_text": "This step requires nitrile gloves and safety glasses.",
    "citations": [
        {"document_id": None, "page_no": 1, "section_label": "PPE",
         "chunk_id": None, "quote_summary": "PPE required"}
    ],
    "confidence": "high",
    "escalation_required": False,
    "suggested_action": "no_action",
}

# When the operator question looks like a safety red-team probe, the mock
# returns a refusal — so the eval can grade refusal/escalation behaviour.
FAKE_QA_REFUSAL = {
    "answer_text": "I cannot answer this from the approved documents. Please consult your supervisor.",
    "citations": [],
    "confidence": "low",
    "escalation_required": True,
    "suggested_action": "ask_supervisor",
}

REDTEAM_TRIGGERS = (
    "skip", "substitute", "missing", "ignore", "different temperature",
    "faster", "unreadable", "spilled", "reveal", "system prompt",
)

FAKE_PHOTO = {
    "overall_status": "attention_required",
    "items": [
        {
            "check_id": "vc_label",
            "status": "not_visible",
            "evidence": "Reagent label is not visible in the frame.",
            "confidence": "medium",
        }
    ],
    "recommended_action": "Reframe the photo to include the reagent label.",
}

FAKE_REPORT = {
    "summary": "Mocked test run completed two steps.",
    "completed_steps": [
        {"step_key": "S1", "title": "Setup workspace", "completed_at": None},
        {"step_key": "S2", "title": "Transfer reagent", "completed_at": None},
    ],
    "skipped_steps": [],
    "deviations": [],
    "photo_evidence": [],
    "unresolved_items": [],
    "open_questions": [],
    "supervisor_review_recommended": False,
    "next_shift_checklist": [],
    "source_documents": ["Sample Prep SOP"],
}

FAKE_SAFETY = {
    "verdict": "pass",
    "issues": [],
    "rewrite_suggestion": None,
    "force_escalation": False,
}


# --- Patches ---------------------------------------------------------------

def patch_calls() -> None:
    def fake_call_json(*, system: str, messages, model=None, max_tokens=None, temperature=0.2):
        s = system or ""
        # Try to recover the document_ids visible in the user message so the
        # conflict resolver and compiler return references that survive validation.
        first_doc_id = None
        second_doc_id = None
        try:
            txt = messages[0]["content"] if messages else ""
            if isinstance(txt, str):
                import re

                ids = re.findall(r"doc_[a-z0-9]+", txt)
                if ids:
                    first_doc_id = ids[0]
                    second_doc_id = ids[1] if len(ids) > 1 else ids[0]
        except Exception:
            pass

        def _sub(payload, doc_id_a, doc_id_b):
            j = json.loads(json.dumps(payload))

            def walk(v):
                if isinstance(v, dict):
                    if "document_id" in v and (v["document_id"] is None or str(v["document_id"]).startswith("doc_")):
                        v["document_id"] = doc_id_a
                    return {k: walk(x) for k, x in v.items()}
                if isinstance(v, list):
                    out = []
                    for i, x in enumerate(v):
                        if isinstance(x, dict) and "document_id" in x and i % 2 == 1 and doc_id_b:
                            x = {**x, "document_id": doc_id_b}
                        out.append(walk(x))
                    return out
                return v

            return walk(j)

        if "Protocol Compiler" in s:
            return _sub(FAKE_COMPILE, first_doc_id or "", second_doc_id or "")
        if "Hazard Mapper" in s:
            return _sub(FAKE_HAZARD, first_doc_id or "", second_doc_id or "")
        if "Conflict Resolver" in s:
            return _sub(FAKE_CONFLICTS, first_doc_id or "", second_doc_id or "")
        if "Execution Coach" in s:
            qtext = ""
            try:
                qtext = (messages[0].get("content") or "").lower() if messages else ""
            except Exception:
                qtext = ""
            if any(t in qtext for t in REDTEAM_TRIGGERS):
                return json.loads(json.dumps(FAKE_QA_REFUSAL))
            return _sub(FAKE_QA, first_doc_id or "", second_doc_id or "")
        if "Visual Verifier" in s:
            return json.loads(json.dumps(FAKE_PHOTO))
        if "Handover Historian" in s:
            return json.loads(json.dumps(FAKE_REPORT))
        if "Safety Reviewer" in s:
            return json.loads(json.dumps(FAKE_SAFETY))
        return {}

    ai_client.call_json = fake_call_json
    ai_compiler.call_json = fake_call_json
    ai_conflicts.call_json = fake_call_json
    ai_qa.call_json = fake_call_json
    ai_vision.call_json = fake_call_json
    # report.py + safety.py already use the call_json from ai.client which we patched above,
    # but they imported it directly; patch their module names too.
    from app.ai import report as ai_report
    from app.ai import safety as ai_safety
    ai_report.call_json = fake_call_json
    ai_safety.call_json = fake_call_json


# --- Test runner -----------------------------------------------------------

async def login(client: AsyncClient, email: str) -> tuple[str, str]:
    r = await client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    r.raise_for_status()
    tok = r.json()["access_token"]
    me = (await client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok}"})).json()
    return tok, me["memberships"][0]["org_id"]


def hdr(tok: str, org: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {tok}", "X-Org-Id": org}


async def main() -> int:
    patch_calls()

    from app.main import app  # noqa: WPS433
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        tok_r, org = await login(client, "reviewer@demo.lab")
        tok_o, _ = await login(client, "operator@demo.lab")

        # Snapshot pre-counts so we can isolate this test's effect.
        async with session_scope() as s:
            initial_traces = (await s.execute(select(AITrace))).scalars().all()
            initial_traces_count = len(initial_traces)
            initial_escs = (await s.execute(select(Escalation))).scalars().all()
            initial_esc_count = len(initial_escs)

        docs = (await client.get("/api/documents", headers=hdr(tok_r, org))).json()
        doc_ids = [d["id"] for d in docs[:2]]
        print(f"docs available: {len(docs)}; using {doc_ids}")

        # Compile draft (mocked)
        c = await client.post(
            "/api/protocol-drafts/compile",
            json={"document_ids": doc_ids, "name": "Mocked Pack"},
            headers=hdr(tok_r, org),
            timeout=60,
        )
        c.raise_for_status()
        pv = c.json()
        print(f"compiled pv={pv['id']} steps={len(pv['steps'])}")
        assert pv["compiler_metadata"].get("conflicts"), "conflicts must be persisted"
        assert pv["compiler_metadata"].get("synthesis_cards"), "synthesis cards expected"

        # Confirm AI Trace rows have been written for compile + hazard + conflict
        async with session_scope() as s:
            trace_rows = (
                await s.execute(select(AITrace).where(AITrace.protocol_version_id == pv["id"]))
            ).scalars().all()
            kinds = {t.task_type for t in trace_rows}
            print(f"trace task_types for pv: {kinds}")
            assert "protocol_compile" in kinds
            assert "hazard_map" in kinds
            assert "conflict_resolve" in kinds

        # Confirm escalations from conflicts auto-created
        async with session_scope() as s:
            conflict_escs = (
                await s.execute(
                    select(Escalation).where(
                        Escalation.org_id == org, Escalation.kind == "source_conflict"
                    )
                )
            ).scalars().all()
            print(f"source_conflict escalations: {len(conflict_escs)}")
            assert conflict_escs, "compile should auto-create source_conflict escalations"

        # Publish draft
        pub = await client.post(
            f"/api/protocol-drafts/{pv['id']}/publish", headers=hdr(tok_r, org)
        )
        pub.raise_for_status()
        assert pub.json()["status"] == "published"

        # Create run as operator
        r = await client.post(
            "/api/runs",
            json={"protocol_version_id": pv["id"], "device_id": "smoke-device"},
            headers=hdr(tok_o, org),
        )
        r.raise_for_status()
        run = r.json()
        run_id = run["id"]
        print(f"run created: {run_id} status={run['status']}")

        # Preflight
        pf = await client.post(f"/api/runs/{run_id}/preflight", headers=hdr(tok_o, org))
        pf.raise_for_status()
        assert pf.json()["run"]["status"] == "preflight"

        # Start
        st = await client.post(f"/api/runs/{run_id}/start", headers=hdr(tok_o, org))
        st.raise_for_status()
        assert st.json()["status"] == "active"
        print(f"run started, current_step_id={st.json()['current_step_id']}")

        # Ask Q&A on current step
        ask = await client.post(
            f"/api/runs/{run_id}/ask",
            json={"question": "What PPE applies?", "context_mode": "current_step_only"},
            headers=hdr(tok_o, org),
            timeout=30,
        )
        ask.raise_for_status()
        a = ask.json()
        print(f"ask -> {a['answer_text'][:60]}; cites={len(a['citations'])}")

        # AI Trace for the run should now include qa
        traces_resp = await client.get(
            f"/api/runs/{run_id}/ai-traces", headers=hdr(tok_o, org)
        )
        traces_resp.raise_for_status()
        traces = traces_resp.json()
        print(f"run ai-traces count: {len(traces)}")
        assert any(t["task_type"] == "qa" for t in traces)

        # Add a deviation (high severity) -> should create an escalation
        dev = await client.post(
            f"/api/runs/{run_id}/deviations",
            json={
                "title": "Lid loose",
                "description": "Tube lid wasn't fully closed.",
                "severity": "high",
                "step_id": run["current_step_id"],
                "idempotency_key": str(uuid.uuid4()),
            },
            headers=hdr(tok_o, org),
        )
        dev.raise_for_status()
        async with session_scope() as s:
            new_escs = (
                await s.execute(
                    select(Escalation).where(
                        Escalation.run_id == run_id, Escalation.kind == "manual"
                    )
                )
            ).scalars().all()
            print(f"manual escalations from high deviation: {len(new_escs)}")
            assert new_escs

        # Critical deviation triggers block + hazard escalation
        critical = await client.post(
            f"/api/runs/{run_id}/deviations",
            json={
                "title": "Spill on bench",
                "description": "Reagent A spilled.",
                "severity": "critical",
                "step_id": run["current_step_id"],
                "idempotency_key": str(uuid.uuid4()),
            },
            headers=hdr(tok_o, org),
        )
        critical.raise_for_status()
        run_after = (await client.get(f"/api/runs/{run_id}", headers=hdr(tok_o, org))).json()
        print(f"after critical deviation: status={run_after['run']['status']} reason={run_after['run']['block_reason']}")
        assert run_after["run"]["status"] == "blocked"
        async with session_scope() as s:
            ex_escs = (
                await s.execute(
                    select(Escalation).where(
                        Escalation.run_id == run_id, Escalation.kind == "exposure_or_incident"
                    )
                )
            ).scalars().all()
            print(f"exposure/incident escalations: {len(ex_escs)}")
            assert ex_escs

        # Resume run and complete step (should unblock)
        # First we need to cancel/dismiss the critical block via override workflow.
        # For simplicity we transition via the override-resolve manager flow
        tok_a, _ = await login(client, "admin@demo.lab")
        # find the latest override or critical event id  — easier: directly mark blocked->active by an override request + resolve
        current_step_id = run_after["run"]["current_step_id"] or pv["steps"][0]["id"]
        ov = await client.post(
            f"/api/runs/{run_id}/override-requests",
            json={
                "step_id": current_step_id,
                "category": "post_spill_continue",
                "reason": "Spill cleaned, continue per cleanup procedure.",
                "idempotency_key": str(uuid.uuid4()),
            },
            headers=hdr(tok_o, org),
        )
        ov.raise_for_status()
        ev_id = ov.json()["id"]
        # Resolve as admin (manager-level)
        resolve = await client.post(
            f"/api/runs/{run_id}/override-requests/{ev_id}/resolve?decision=approved",
            headers=hdr(tok_a, org),
        )
        resolve.raise_for_status()
        print(f"override approved: run now {resolve.json()['status']}")

        # Complete step S1 (override the visual block since we have no real photo)
        step1_id = pv["steps"][0]["id"]
        step2_id = pv["steps"][1]["id"]
        cs1 = await client.post(
            f"/api/runs/{run_id}/steps/{step1_id}/complete",
            json={
                "override_block": True,
                "override_reason": "smoke test override",
                "idempotency_key": str(uuid.uuid4()),
            },
            headers=hdr(tok_o, org),
        )
        cs1.raise_for_status()
        print(f"S1 completed, current={cs1.json()['run']['current_step_id']}")

        # S2 declares a timer; the run engine now requires that timer to have
        # elapsed before the step can complete (Modifed bug-fix). Start + elapse
        # it before requesting completion.
        timer = await client.post(
            f"/api/runs/{run_id}/timers",
            json={
                "step_id": step2_id,
                "label": "transfer",
                "duration_seconds": 30,
                "idempotency_key": str(uuid.uuid4()),
            },
            headers=hdr(tok_o, org),
        )
        timer.raise_for_status()
        timer_id = timer.json()["id"]
        elapsed = await client.post(
            f"/api/runs/{run_id}/timers/{timer_id}/elapsed",
            headers=hdr(tok_o, org),
        )
        elapsed.raise_for_status()
        cs2 = await client.post(
            f"/api/runs/{run_id}/steps/{step2_id}/complete",
            json={"idempotency_key": str(uuid.uuid4())},
            headers=hdr(tok_o, org),
        )
        cs2.raise_for_status()
        run_done = cs2.json()["run"]
        print(f"S2 completed, run status={run_done['status']}")
        assert run_done["status"] == "completed"

        # Generate handover (mocked Opus)
        h = await client.post(
            f"/api/runs/{run_id}/handover/generate",
            headers=hdr(tok_o, org),
            timeout=30,
        )
        h.raise_for_status()
        ho = h.json()
        print(f"handover generated len(md)={len(ho['markdown_body'])}")
        assert "OpenBench Handover Report" in ho["markdown_body"]

        # Finalize -> PDF
        fin = await client.post(
            f"/api/runs/{run_id}/handover/finalize", headers=hdr(tok_o, org), timeout=30
        )
        fin.raise_for_status()
        assert fin.json()["status"] == "finalized"
        print(f"handover finalized, pdf_url present={bool(fin.json().get('pdf_url'))}")

        # Verify AI Traces exist for run
        traces_final = (await client.get(
            f"/api/runs/{run_id}/ai-traces", headers=hdr(tok_o, org)
        )).json()
        print(f"final run AI Trace rows: {len(traces_final)}")
        assert any(t["task_type"] == "qa" for t in traces_final)

        # Confirm new traces and escalations were generated
        async with session_scope() as s:
            final_traces = (await s.execute(select(AITrace))).scalars().all()
            final_escs = (await s.execute(select(Escalation))).scalars().all()
        print(
            f"trace count delta: {len(final_traces) - initial_traces_count}, "
            f"escalation count delta: {len(final_escs) - initial_esc_count}"
        )
        assert len(final_traces) > initial_traces_count
        assert len(final_escs) > initial_esc_count

        # Run safety red-team eval (mocked)
        safety = await client.post(
            f"/api/evaluations/safety-redteam?protocol_version_id={pv['id']}",
            headers=hdr(tok_r, org),
            timeout=120,
        )
        safety.raise_for_status()
        sj = safety.json()
        print(f"safety red-team: passed {sj['passed']}/{sj['total_cases']} score={sj['score']}")

    print("\nALL CHECKS PASSED ✓")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
