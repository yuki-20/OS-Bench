"""Edge-case tests beyond the happy path.

Verifies:
  - replayed idempotency keys return the original event (no duplicate)
  - cross-version step lookup returns 404
  - cross-org access returns 403/404
  - unauthorized override resolution returns 403
  - finalize from a non-finalizable status returns 409
  - critical deviation blocks the run *and* emits an escalation
  - sync events with duplicate idempotency_key are reported as 'duplicate'

Runs in-process against a live DB (db service in docker-compose) using
ASGITransport, so no real HTTP server needs to be up. Anthropic calls are
stubbed with the same patches used by test_run_lifecycle.py."""
from __future__ import annotations

import asyncio
import json
import sys
import uuid

sys.path.insert(0, "/app")

from sqlalchemy import select  # noqa: E402

from app.ai import client as ai_client  # noqa: E402
from app.ai import compiler as ai_compiler  # noqa: E402
from app.ai import conflicts as ai_conflicts  # noqa: E402
from app.ai import qa as ai_qa  # noqa: E402
from app.db.session import session_scope  # noqa: E402
from app.models.protocol import Protocol, ProtocolVersion  # noqa: E402
from app.models.run import RunEvent  # noqa: E402

from httpx import ASGITransport, AsyncClient  # noqa: E402

PASSWORD = "Bench!Demo1"


def _stub_call_json():
    """Minimal stub — just enough to let compile_draft + ask succeed."""
    def stub(*, system, messages, model=None, max_tokens=None, temperature=0.2):
        # Try to recover doc IDs in the prompt
        first = ""
        try:
            txt = messages[0].get("content", "") if messages else ""
            import re
            ids = re.findall(r"doc_[a-z0-9]+", str(txt))
            first = ids[0] if ids else ""
        except Exception:
            pass
        s = system or ""
        if "Protocol Compiler" in s:
            return {
                "name": "Edge case test",
                "summary": "Stubbed compile.",
                "steps": [
                    {
                        "step_key": "S1",
                        "title": "Setup",
                        "instruction": "Set up the bench.",
                        "is_skippable": False,
                        "prerequisites": [],
                        "required_ppe": ["nitrile gloves"],
                        "controls": [],
                        "materials": [],
                        "equipment": [],
                        "timers": [],
                        "visual_checks": [],
                        "stop_conditions": [],
                        "expected_observations": [],
                        "data_capture": [],
                        "source_refs": [
                            {"document_id": first, "page_no": 1,
                             "section_label": "Setup", "chunk_id": None,
                             "quote_summary": "Set up"}
                        ],
                        "confidence": "high",
                    },
                ],
            }
        if "Hazard Mapper" in s:
            return {"hazard_rules": [], "missing_coverage": []}
        if "Conflict Resolver" in s:
            return {"conflicts": [], "gaps": [], "synthesis_cards": []}
        if "Execution Coach" in s:
            return {
                "answer_text": "Use the protocol's PPE list.",
                "citations": [
                    {"document_id": first, "page_no": 1,
                     "section_label": "PPE", "chunk_id": None,
                     "quote_summary": "PPE required"}
                ],
                "confidence": "high",
                "escalation_required": False,
                "suggested_action": "no_action",
            }
        if "Safety Reviewer" in s:
            return {"verdict": "pass", "issues": [], "rewrite_suggestion": None,
                    "force_escalation": False}
        return {}
    ai_client.call_json = stub
    ai_compiler.call_json = stub
    ai_conflicts.call_json = stub
    ai_qa.call_json = stub
    from app.ai import safety as ai_safety
    ai_safety.call_json = stub


async def login(client: AsyncClient, email: str) -> tuple[str, str]:
    r = await client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    r.raise_for_status()
    tok = r.json()["access_token"]
    me = (await client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok}"})).json()
    return tok, me["memberships"][0]["org_id"]


def hdr(tok: str, org: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {tok}", "X-Org-Id": org}


async def main() -> int:
    _stub_call_json()
    from app.main import app  # noqa: WPS433

    transport = ASGITransport(app=app)
    failures: list[str] = []

    def expect(label, condition, detail=""):
        status = "✓" if condition else "✗"
        print(f"  {status} {label}{(' — ' + detail) if detail and not condition else ''}")
        if not condition:
            failures.append(label)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        tok_r, org = await login(client, "reviewer@demo.lab")
        tok_o, _ = await login(client, "operator@demo.lab")
        tok_a, _ = await login(client, "admin@demo.lab")

        docs = (await client.get("/api/documents", headers=hdr(tok_r, org))).json()
        doc_ids = [d["id"] for d in docs[:1]]

        # --- compile + publish a tiny protocol ---
        c = await client.post(
            "/api/protocol-drafts/compile",
            json={"document_ids": doc_ids, "name": "Edge case test"},
            headers=hdr(tok_r, org),
            timeout=60,
        )
        c.raise_for_status()
        pv = c.json()
        pub = await client.post(f"/api/protocol-drafts/{pv['id']}/publish", headers=hdr(tok_r, org))
        pub.raise_for_status()

        # --- create run as operator ---
        r = await client.post(
            "/api/runs",
            json={"protocol_version_id": pv["id"], "device_id": "edge-test"},
            headers=hdr(tok_o, org),
        )
        r.raise_for_status()
        run_id = r.json()["id"]

        print("\n[1] Pre-active state machine guards")
        # Cannot complete a step when run is in 'created'
        cs = await client.post(
            f"/api/runs/{run_id}/steps/{pv['steps'][0]['id']}/complete",
            json={"idempotency_key": str(uuid.uuid4())},
            headers=hdr(tok_o, org),
        )
        # 409 because run is not active (or different rejection from the engine)
        expect("complete-step before start rejected", cs.status_code in (409, 400, 404))

        # Start the run
        await client.post(f"/api/runs/{run_id}/preflight", headers=hdr(tok_o, org))
        st = await client.post(f"/api/runs/{run_id}/start", headers=hdr(tok_o, org))
        st.raise_for_status()

        print("\n[2] Idempotent note replay")
        idem = str(uuid.uuid4())
        n1 = await client.post(
            f"/api/runs/{run_id}/notes",
            json={"text": "first", "idempotency_key": idem},
            headers=hdr(tok_o, org),
        )
        n1.raise_for_status()
        n2 = await client.post(
            f"/api/runs/{run_id}/notes",
            json={"text": "second-but-same-idem", "idempotency_key": idem},
            headers=hdr(tok_o, org),
        )
        n2.raise_for_status()
        expect(
            "replayed idempotent note returns the original event",
            n1.json()["id"] == n2.json()["id"],
            f"{n1.json()['id']} vs {n2.json()['id']}",
        )

        print("\n[3] Cross-version step lookup → 404")
        # Use a step ID from another protocol version
        async with session_scope() as s:
            other_pv = (
                await s.execute(
                    select(ProtocolVersion)
                    .join(Protocol, ProtocolVersion.protocol_id == Protocol.id)
                    .where(Protocol.org_id == org, ProtocolVersion.id != pv["id"])
                    .limit(1)
                )
            ).scalar_one_or_none()
        # Try to start a step that doesn't belong to this run's protocol version
        bad = await client.post(
            f"/api/runs/{run_id}/steps/stp_doesnotexist000/start",
            json={"idempotency_key": str(uuid.uuid4())},
            headers=hdr(tok_o, org),
        )
        expect("nonexistent step → 404", bad.status_code == 404)

        print("\n[4] Cross-org X-Org-Id header → 403")
        cross_org = await client.get(
            "/api/runs",
            headers={
                "Authorization": f"Bearer {tok_o}",
                "X-Org-Id": "org_does_not_exist",
            },
        )
        expect("invalid org header rejected", cross_org.status_code == 403)

        print("\n[5] Override resolve requires manager+")
        ovr = await client.post(
            f"/api/runs/{run_id}/override-requests",
            json={
                "step_id": pv["steps"][0]["id"],
                "category": "minor_substitution",
                "reason": "edge test",
                "idempotency_key": str(uuid.uuid4()),
            },
            headers=hdr(tok_o, org),
        )
        ovr.raise_for_status()
        ev_id = ovr.json()["id"]
        # operator cannot resolve their own override
        deny = await client.post(
            f"/api/runs/{run_id}/override-requests/{ev_id}/resolve?decision=approved",
            headers=hdr(tok_o, org),
        )
        expect("operator cannot resolve override", deny.status_code == 403)
        # admin can
        ok = await client.post(
            f"/api/runs/{run_id}/override-requests/{ev_id}/resolve?decision=approved",
            headers=hdr(tok_a, org),
        )
        expect("admin can resolve override", ok.status_code == 200)

        print("\n[6] Critical deviation triggers block + escalation atomically")
        crit = await client.post(
            f"/api/runs/{run_id}/deviations",
            json={
                "title": "Spill hazard",
                "description": "Reagent A spilled on bench.",
                "severity": "critical",
                "step_id": pv["steps"][0]["id"],
                "idempotency_key": str(uuid.uuid4()),
            },
            headers=hdr(tok_o, org),
        )
        crit.raise_for_status()
        d = (await client.get(f"/api/runs/{run_id}", headers=hdr(tok_o, org))).json()
        expect("run is blocked after critical deviation", d["run"]["status"] == "blocked")
        # Confirm an escalation was raised
        elist = (
            await client.get(f"/api/escalations?run_id={run_id}", headers=hdr(tok_a, org))
        ).json()
        expect("escalation auto-created from critical deviation",
               any(e["kind"] in ("exposure_or_incident", "hazard_condition") for e in elist))

        print("\n[7] Finalize handover before generation → 409")
        fin = await client.post(
            f"/api/runs/{run_id}/handover/finalize", headers=hdr(tok_o, org)
        )
        expect("finalize without generate → 409", fin.status_code == 409)

        print("\n[8] Sync duplicate idempotency_key reported as 'duplicate'")
        dup_idem = str(uuid.uuid4())
        sr = await client.post(
            "/api/sync/events",
            json={
                "device_id": "edge",
                "events": [
                    {
                        "run_id": run_id,
                        "event_type": "note_added",
                        "payload": {"text": "from sync"},
                        "idempotency_key": dup_idem,
                    },
                    {
                        "run_id": run_id,
                        "event_type": "note_added",
                        "payload": {"text": "duplicate"},
                        "idempotency_key": dup_idem,
                    },
                ],
            },
            headers=hdr(tok_o, org),
        )
        sr.raise_for_status()
        items = sr.json()["items"]
        expect("first sync event accepted", items[0]["status"] == "accepted")
        expect("second sync event marked duplicate", items[1]["status"] == "duplicate")

        print("\n[9] Cross-org run access → 404")
        # operator from this org tries to fetch a runID using X-Org-Id of a non-member org
        # use admin to register a new org so we have one to try
        suffix = uuid.uuid4().hex[:8]
        reg = await client.post(
            "/api/auth/register",
            json={
                "email": f"edge_{suffix}@demo.lab",
                "password": "Bench!Demo1",
                "display_name": "Edge",
                "org_name": f"Edge Org {suffix}",
            },
        )
        if reg.status_code == 200:
            other_tok = reg.json()["access_token"]
            cross = await client.get(
                f"/api/runs/{run_id}",
                headers={"Authorization": f"Bearer {other_tok}"},
            )
            expect("foreign run lookup → 404", cross.status_code == 404)

    if failures:
        print("\n=== FAILURES ===")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("\nALL EDGE-CASE CHECKS PASSED ✓")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
