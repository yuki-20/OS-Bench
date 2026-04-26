"""Handover report generator."""
from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import call_json
from app.ai.prompts import REPORT_SYSTEM
from app.core.config import settings
from app.models.document import Document
from app.models.protocol import ProtocolStep, ProtocolVersion
from app.models.run import Deviation, PhotoAssessment, Run, RunEvent, StepState, Timer


async def generate_report(session: AsyncSession, run_id: str) -> Dict[str, Any]:
    run: Run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one()
    pv: ProtocolVersion = (
        await session.execute(select(ProtocolVersion).where(ProtocolVersion.id == run.protocol_version_id))
    ).scalar_one()
    proto_steps = (
        (
            await session.execute(
                select(ProtocolStep)
                .where(ProtocolStep.protocol_version_id == pv.id)
                .order_by(ProtocolStep.order_index)
            )
        )
        .scalars()
        .all()
    )
    step_map = {s.id: s for s in proto_steps}

    step_states = (
        (await session.execute(select(StepState).where(StepState.run_id == run_id))).scalars().all()
    )
    timers = (
        (await session.execute(select(Timer).where(Timer.run_id == run_id))).scalars().all()
    )
    deviations = (
        (await session.execute(select(Deviation).where(Deviation.run_id == run_id))).scalars().all()
    )
    events = (
        (
            await session.execute(
                select(RunEvent)
                .where(RunEvent.run_id == run_id)
                .order_by(RunEvent.server_timestamp)
            )
        )
        .scalars()
        .all()
    )
    assessments = (
        (await session.execute(select(PhotoAssessment).where(PhotoAssessment.run_id == run_id)))
        .scalars()
        .all()
    )
    documents = (
        (
            await session.execute(
                select(Document).where(Document.id.in_(pv.source_doc_ids or []))
            )
        )
        .scalars()
        .all()
    )

    summary = {
        "run_id": run_id,
        "operator_id": run.operator_id,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "ended_at": run.ended_at.isoformat() if run.ended_at else None,
        "protocol_name": pv.summary or "Protocol",
        "protocol_version_id": pv.id,
        "version_label": pv.version_label,
        "steps": [
            {
                "step_key": s.step_key,
                "title": s.title,
                "is_skippable": s.is_skippable,
            }
            for s in proto_steps
        ],
        "step_states": [
            {
                "step_id": ss.step_id,
                "step_key": step_map.get(ss.step_id).step_key if step_map.get(ss.step_id) else None,
                "status": ss.status,
                "started_at": ss.started_at.isoformat() if ss.started_at else None,
                "completed_at": ss.completed_at.isoformat() if ss.completed_at else None,
                "blocked_reason": ss.blocked_reason_json,
                "confirmations": ss.confirmations_json,
                "measurements": ss.measurements_json,
            }
            for ss in step_states
        ],
        "timers": [
            {
                "label": t.label,
                "duration_seconds": t.duration_seconds,
                "started_at": t.started_at.isoformat() if t.started_at else None,
                "ended_at": t.ended_at.isoformat() if t.ended_at else None,
                "status": t.status,
            }
            for t in timers
        ],
        "deviations": [
            {
                "id": d.id,
                "step_id": d.step_id,
                "severity": d.severity,
                "title": d.title,
                "description": d.description,
                "resolution_state": d.resolution_state,
            }
            for d in deviations
        ],
        "photo_assessments": [
            {
                "step_id": a.step_id,
                "step_key": step_map.get(a.step_id).step_key if step_map.get(a.step_id) else None,
                "overall_status": a.overall_status,
                "items": a.items_json,
                "recommended_action": a.recommended_action,
            }
            for a in assessments
        ],
        "events": [
            {
                "event_type": e.event_type,
                "step_id": e.step_id,
                "actor_id": e.actor_id,
                "payload": e.payload_json,
                "at": e.server_timestamp.isoformat(),
            }
            for e in events
        ],
        "source_documents": [
            {"id": d.id, "title": d.title or d.document_type.upper(), "type": d.document_type}
            for d in documents
        ],
    }

    user = (
        "RUN PAYLOAD:\n"
        + json.dumps(summary, default=str, indent=2)[:80000]
        + "\n\nProduce the structured handover report JSON as specified."
    )
    result = await asyncio.to_thread(
        call_json,
        system=REPORT_SYSTEM,
        messages=[{"role": "user", "content": user}],
        model=settings.anthropic_model,
        temperature=0.1,
        max_tokens=64000,
    )
    # Attach raw run summary for completeness
    result["_raw"] = summary
    return result


def render_markdown(report: Dict[str, Any]) -> str:
    lines: List[str] = []
    raw = report.get("_raw", {})
    lines.append(f"# OpenBench Handover Report")
    lines.append("")
    lines.append(f"**Protocol:** {raw.get('protocol_name','')} ({raw.get('version_label','')})")
    lines.append(f"**Run ID:** `{raw.get('run_id','')}`")
    lines.append(f"**Operator:** `{raw.get('operator_id','')}`")
    lines.append(f"**Start:** {raw.get('started_at','')}")
    lines.append(f"**End:** {raw.get('ended_at','')}")
    lines.append("")
    lines.append("## Summary")
    lines.append(report.get("summary", "").strip() or "_No summary._")
    lines.append("")
    lines.append("## Completed Steps")
    for s in report.get("completed_steps", []) or []:
        lines.append(f"- **{s.get('step_key','?')}** — {s.get('title','')}")
    if not report.get("completed_steps"):
        lines.append("_None._")
    lines.append("")
    lines.append("## Skipped Steps")
    for s in report.get("skipped_steps", []) or []:
        lines.append(f"- **{s.get('step_key','?')}** — {s.get('title','')}: {s.get('reason','')}")
    if not report.get("skipped_steps"):
        lines.append("_None._")
    lines.append("")
    lines.append("## Deviations")
    for d in report.get("deviations", []) or []:
        lines.append(
            f"- **{d.get('severity','minor').upper()}**: {d.get('title','')} — {d.get('description','')} "
            f"_(state: {d.get('resolution_state','open')})_"
        )
    if not report.get("deviations"):
        lines.append("_None recorded._")
    lines.append("")
    lines.append("## Photo Evidence")
    for p in report.get("photo_evidence", []) or []:
        lines.append(f"- Step **{p.get('step_key','?')}** — overall: {p.get('overall_status','?')}")
        for it in p.get("items", []) or []:
            lines.append(f"    - `{it.get('check_id','?')}` — {it.get('status','?')} — {it.get('evidence','')}")
    if not report.get("photo_evidence"):
        lines.append("_No photo evidence captured._")
    lines.append("")
    lines.append("## Unresolved Items")
    for u in report.get("unresolved_items", []) or []:
        lines.append(f"- {u}")
    if not report.get("unresolved_items"):
        lines.append("_None._")
    lines.append("")
    if report.get("open_questions"):
        lines.append("## Open Questions")
        for q in report["open_questions"]:
            lines.append(f"- {q}")
        lines.append("")
    if report.get("next_shift_checklist"):
        lines.append("## Next-shift checklist")
        for q in report["next_shift_checklist"]:
            lines.append(f"- [ ] {q}")
        lines.append("")
    lines.append("## Source Documents")
    for d in raw.get("source_documents", []) or []:
        lines.append(f"- {d.get('title')} ({d.get('type')})")
    lines.append("")
    if report.get("supervisor_review_recommended"):
        lines.append("> **Supervisor review recommended.**")
    lines.append("")
    lines.append("_OpenBench OS does not certify safety. The handover is decision-support evidence._")
    return "\n".join(lines)
