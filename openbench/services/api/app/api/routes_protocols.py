from __future__ import annotations

from datetime import datetime
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.compiler import compile_hazards, compile_protocol
from app.ai.conflicts import resolve_conflicts
from app.api.deps import CurrentContext, current_context
from app.core.config import settings
from app.core.ids import proto_id, version_id
from app.db.session import get_db
from app.models.document import Document
from app.models.protocol import HazardRule, Protocol, ProtocolStep, ProtocolVersion
from app.schemas.protocol import (
    DraftCompileRequest,
    DraftPatchRequest,
    DraftPatchStepRequest,
    HazardRuleOut,
    ProtocolOut,
    ProtocolStepOut,
    ProtocolVersionDetail,
    ProtocolVersionOut,
    PublishResponse,
)
from app.services.audit import record_audit
from app.services.escalation import create_escalation
from app.services.trace import record_trace

router = APIRouter(prefix="/api", tags=["protocols"])


# --- Drafts (compile, list, edit, publish) -----------------------------------


@router.post("/protocol-drafts/compile", response_model=ProtocolVersionDetail)
async def compile_draft(
    payload: DraftCompileRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ProtocolVersionDetail:
    ctx.require_min("reviewer")
    if not payload.document_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "document_ids required")
    docs = (
        await session.execute(
            select(Document).where(Document.org_id == ctx.org_id, Document.id.in_(payload.document_ids))
        )
    ).scalars().all()
    if len(docs) != len(payload.document_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Some document IDs not found in this org")

    compile_result = await compile_protocol(session, payload.document_ids, payload.name)

    proto = Protocol(
        id=proto_id(),
        org_id=ctx.org_id,
        name=payload.name or compile_result.get("name") or "Untitled Protocol",
        created_by=ctx.user_id,
    )
    session.add(proto)

    pv = ProtocolVersion(
        id=version_id(),
        protocol_id=proto.id,
        version_label="v1",
        status="draft",
        source_doc_ids=list(payload.document_ids),
        compiler_metadata={"compiled_at": datetime.utcnow().isoformat()},
        summary=compile_result.get("summary"),
    )
    session.add(pv)

    steps = compile_result.get("steps", [])
    step_keys = []
    for i, s in enumerate(steps):
        step = ProtocolStep(
            protocol_version_id=pv.id,
            step_key=s["step_key"],
            order_index=i,
            title=s["title"],
            instruction=s["instruction"],
            is_skippable=s["is_skippable"],
            prerequisites_json=s["prerequisites"],
            required_ppe_json=s["required_ppe"],
            controls_json=s["controls"],
            materials_json=s["materials"],
            equipment_json=s["equipment"],
            timers_json=s["timers"],
            visual_checks_json=s["visual_checks"],
            stop_conditions_json=s["stop_conditions"],
            expected_observations_json=s["expected_observations"],
            data_capture_schema_json=s["data_capture"],
            source_refs_json=s["source_refs"],
            confidence_score=s["confidence_score"],
        )
        session.add(step)
        step_keys.append(s["step_key"])
    await session.flush()

    if step_keys:
        try:
            haz = await compile_hazards(session, payload.document_ids, step_keys)
            for r in haz.get("hazard_rules", []):
                # Map step_keys -> step_ids
                target_step_ids: List[str | None] = [None]
                if r.get("step_keys"):
                    res = await session.execute(
                        select(ProtocolStep).where(
                            ProtocolStep.protocol_version_id == pv.id,
                            ProtocolStep.step_key.in_(r["step_keys"]),
                        )
                    )
                    target_step_ids = [s.id for s in res.scalars().all()] or [None]
                for sid in target_step_ids:
                    session.add(
                        HazardRule(
                            protocol_version_id=pv.id,
                            step_id=sid,
                            category=r["category"],
                            requirement_text=r["requirement_text"],
                            severity=r["severity"],
                            source_refs_json=r["source_refs"],
                        )
                    )
            pv.compiler_metadata = {
                **(pv.compiler_metadata or {}),
                "missing_coverage": haz.get("missing_coverage", []),
            }
            await record_trace(
                session,
                org_id=ctx.org_id,
                protocol_version_id=pv.id,
                actor_id=ctx.user_id,
                task_type="hazard_map",
                model=settings.anthropic_model,
                input_summary=f"Hazard map for {len(step_keys)} steps from {len(payload.document_ids)} docs",
                output_schema="hazard.map.v1",
                output_json={
                    "hazard_rules": haz.get("hazard_rules", []),
                    "missing_coverage": haz.get("missing_coverage", []),
                },
                source_document_ids=list(payload.document_ids),
                citations=[
                    cite
                    for r in haz.get("hazard_rules", [])
                    for cite in (r.get("source_refs") or [])
                ],
                requires_human_review=bool(haz.get("missing_coverage")),
            )
        except Exception as e:  # noqa: BLE001
            pv.compiler_metadata = {
                **(pv.compiler_metadata or {}),
                "hazard_compile_error": str(e),
            }

        # Cross-document conflict resolution (PRD v3 Section 6.4)
        try:
            cflx = await resolve_conflicts(session, payload.document_ids, step_keys)
            pv.compiler_metadata = {
                **(pv.compiler_metadata or {}),
                "conflicts": cflx.get("conflicts", []),
                "gaps": cflx.get("gaps", []),
                "synthesis_cards": cflx.get("synthesis_cards", []),
            }
            await record_trace(
                session,
                org_id=ctx.org_id,
                protocol_version_id=pv.id,
                actor_id=ctx.user_id,
                task_type="conflict_resolve",
                model=settings.anthropic_model,
                input_summary=f"Conflict resolver across {len(payload.document_ids)} docs",
                output_schema="conflict.map.v1",
                output_json=cflx,
                source_document_ids=list(payload.document_ids),
                citations=[
                    s
                    for c in cflx.get("conflicts", [])
                    for s in (c.get("sources") or [])
                ],
                requires_human_review=bool(cflx.get("conflicts") or cflx.get("gaps")),
            )
            for c in cflx.get("conflicts", []):
                await create_escalation(
                    session,
                    org_id=ctx.org_id,
                    kind="source_conflict",
                    title=f"Conflict: {c.get('topic', 'unspecified')}"[:300],
                    description=c.get("summary", "")[:500],
                    severity=c.get("severity", "high"),
                    actor_id=ctx.user_id,
                    metadata={
                        "step_keys": c.get("step_keys", []),
                        "sources": c.get("sources", []),
                        "protocol_version_id": pv.id,
                    },
                )
            for g in cflx.get("gaps", []):
                await create_escalation(
                    session,
                    org_id=ctx.org_id,
                    kind="missing_source",
                    title=f"Missing source: {g.get('missing','')}"[:300],
                    description=g.get("recommended_action", "")[:500],
                    severity=g.get("severity", "high"),
                    actor_id=ctx.user_id,
                    metadata={
                        "step_keys": g.get("step_keys", []),
                        "protocol_version_id": pv.id,
                    },
                )
        except Exception as e:  # noqa: BLE001
            pv.compiler_metadata = {
                **(pv.compiler_metadata or {}),
                "conflict_resolve_error": str(e)[:200],
            }

    # Top-level compile trace
    await record_trace(
        session,
        org_id=ctx.org_id,
        protocol_version_id=pv.id,
        actor_id=ctx.user_id,
        task_type="protocol_compile",
        model=settings.anthropic_model,
        input_summary=f"Compile {len(steps)} steps from docs {','.join(payload.document_ids)[:200]}",
        output_schema="protocol.graph.v1",
        output_json={
            "name": proto.name,
            "summary": pv.summary,
            "step_count": len(steps),
            "step_keys": step_keys,
        },
        source_document_ids=list(payload.document_ids),
        citations=[
            ref for s in steps for ref in (s.get("source_refs") or [])
        ],
        confidence=_compile_confidence(steps),
        requires_human_review=True,
        min_citations_for_coverage=max(1, len(steps)),
    )

    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="protocol.compile",
        target_type="protocol_version",
        target_id=pv.id,
        summary=f"Compiled draft '{proto.name}' with {len(steps)} steps",
        metadata={"document_ids": list(payload.document_ids)},
    )
    await session.commit()
    return await _load_version_detail(session, pv.id)


@router.get("/protocol-drafts/{version_id}", response_model=ProtocolVersionDetail)
async def get_draft(
    version_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ProtocolVersionDetail:
    return await _load_version_detail(session, version_id, org_id=ctx.org_id)


@router.patch("/protocol-drafts/{version_id}", response_model=ProtocolVersionDetail)
async def patch_draft(
    version_id: str,
    payload: DraftPatchRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ProtocolVersionDetail:
    ctx.require_min("reviewer")
    pv, proto = await _get_pv_with_proto(session, version_id, ctx.org_id)
    if pv.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only drafts can be edited")
    if payload.name:
        proto.name = payload.name
    if payload.summary is not None:
        pv.summary = payload.summary

    if payload.add_step:
        existing_count = len(
            (
                await session.execute(
                    select(ProtocolStep).where(ProtocolStep.protocol_version_id == pv.id)
                )
            )
            .scalars()
            .all()
        )
        s = payload.add_step
        session.add(
            ProtocolStep(
                protocol_version_id=pv.id,
                step_key=s.step_key,
                order_index=existing_count,
                title=s.title,
                instruction=s.instruction or "",
                is_skippable=s.is_skippable,
                prerequisites_json=s.prerequisites_json,
                required_ppe_json=s.required_ppe_json,
                controls_json=s.controls_json,
                materials_json=s.materials_json,
                equipment_json=s.equipment_json,
                timers_json=[t.model_dump() for t in s.timers_json] if s.timers_json else [],
                visual_checks_json=[v.model_dump() for v in s.visual_checks_json]
                if s.visual_checks_json
                else [],
                stop_conditions_json=s.stop_conditions_json,
                expected_observations_json=s.expected_observations_json,
                data_capture_schema_json=[d.model_dump() for d in s.data_capture_schema_json]
                if s.data_capture_schema_json
                else [],
                source_refs_json=[r.model_dump() for r in s.source_refs_json]
                if s.source_refs_json
                else [],
                confidence_score=s.confidence_score,
            )
        )

    if payload.remove_step_id:
        st = (
            await session.execute(
                select(ProtocolStep).where(
                    ProtocolStep.id == payload.remove_step_id,
                    ProtocolStep.protocol_version_id == pv.id,
                )
            )
        ).scalar_one_or_none()
        if st is not None:
            await session.delete(st)

    if payload.patch_step_id and payload.patch_step:
        await _apply_step_patch(session, pv.id, payload.patch_step_id, payload.patch_step)

    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="protocol.patch_draft",
        target_type="protocol_version",
        target_id=pv.id,
    )
    await session.commit()
    return await _load_version_detail(session, pv.id)


@router.post("/protocol-drafts/{version_id}/publish", response_model=PublishResponse)
async def publish_draft(
    version_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> PublishResponse:
    ctx.require_min("reviewer")
    pv, proto = await _get_pv_with_proto(session, version_id, ctx.org_id)
    if pv.status not in ("draft", "in_review"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot publish from {pv.status}")
    pv.status = "published"
    pv.published_by = ctx.user_id
    pv.published_at = datetime.utcnow()
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="protocol.publish",
        target_type="protocol_version",
        target_id=pv.id,
        summary=f"Published {proto.name} {pv.version_label}",
    )
    await session.commit()
    return PublishResponse(protocol_version_id=pv.id, version_label=pv.version_label, status=pv.status)


@router.get("/protocols", response_model=List[ProtocolOut])
async def list_protocols(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> List[ProtocolOut]:
    res = await session.execute(
        select(Protocol)
        .where(Protocol.org_id == ctx.org_id)
        .options(selectinload(Protocol.versions))
        .order_by(desc(Protocol.created_at))
    )
    return [
        ProtocolOut(
            id=p.id,
            org_id=p.org_id,
            name=p.name,
            status=p.status,
            versions=[ProtocolVersionOut.model_validate(v) for v in p.versions],
        )
        for p in res.scalars().all()
    ]


@router.get("/protocol-versions/{version_id}", response_model=ProtocolVersionDetail)
async def get_version(
    version_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ProtocolVersionDetail:
    return await _load_version_detail(session, version_id, org_id=ctx.org_id)


@router.post("/protocol-versions/{version_id}/archive", response_model=ProtocolVersionOut)
async def archive_version(
    version_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ProtocolVersionOut:
    ctx.require_min("reviewer")
    pv, proto = await _get_pv_with_proto(session, version_id, ctx.org_id)
    pv.status = "archived"
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="protocol.archive",
        target_type="protocol_version",
        target_id=pv.id,
    )
    await session.commit()
    return ProtocolVersionOut.model_validate(pv)


@router.get("/protocol-versions", response_model=List[ProtocolVersionOut])
async def list_published_versions(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str = "published",
) -> List[ProtocolVersionOut]:
    res = await session.execute(
        select(ProtocolVersion)
        .join(Protocol, ProtocolVersion.protocol_id == Protocol.id)
        .where(Protocol.org_id == ctx.org_id, ProtocolVersion.status == status_filter)
        .order_by(desc(ProtocolVersion.published_at))
    )
    return [ProtocolVersionOut.model_validate(v) for v in res.scalars().all()]


@router.get("/protocol-versions/{a_id}/diff/{b_id}")
async def diff_protocol_versions(
    a_id: str,
    b_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Step-level diff between two protocol versions of the same protocol.

    Returns the set of step_keys added in B, removed from A, and modified
    (where the title, instruction, PPE, controls, visual checks, or stop
    conditions differ). Both versions must belong to the caller's org.
    """
    pv_a, _ = await _get_pv_with_proto(session, a_id, ctx.org_id)
    pv_b, _ = await _get_pv_with_proto(session, b_id, ctx.org_id)
    if pv_a.protocol_id != pv_b.protocol_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Versions belong to different protocols",
        )
    steps_a = (
        (
            await session.execute(
                select(ProtocolStep)
                .where(ProtocolStep.protocol_version_id == pv_a.id)
                .order_by(ProtocolStep.order_index)
            )
        )
        .scalars()
        .all()
    )
    steps_b = (
        (
            await session.execute(
                select(ProtocolStep)
                .where(ProtocolStep.protocol_version_id == pv_b.id)
                .order_by(ProtocolStep.order_index)
            )
        )
        .scalars()
        .all()
    )

    def _summary(s: ProtocolStep) -> dict:
        return {
            "step_key": s.step_key,
            "title": s.title,
            "instruction": s.instruction,
            "is_skippable": s.is_skippable,
            "required_ppe": list(s.required_ppe_json or []),
            "controls": list(s.controls_json or []),
            "stop_conditions": list(s.stop_conditions_json or []),
            "visual_check_ids": [v.get("check_id") for v in (s.visual_checks_json or [])],
            "timer_durations": [int(t.get("duration_seconds") or 0) for t in (s.timers_json or [])],
        }

    map_a = {s.step_key: _summary(s) for s in steps_a}
    map_b = {s.step_key: _summary(s) for s in steps_b}
    keys_a = set(map_a)
    keys_b = set(map_b)

    added = sorted(keys_b - keys_a)
    removed = sorted(keys_a - keys_b)
    modified: list[dict] = []
    for k in sorted(keys_a & keys_b):
        if map_a[k] != map_b[k]:
            changes: list[str] = []
            for field in (
                "title",
                "instruction",
                "is_skippable",
                "required_ppe",
                "controls",
                "stop_conditions",
                "visual_check_ids",
                "timer_durations",
            ):
                if map_a[k][field] != map_b[k][field]:
                    changes.append(field)
            modified.append({"step_key": k, "changed_fields": changes, "from": map_a[k], "to": map_b[k]})
    return {
        "protocol_id": pv_a.protocol_id,
        "from_version_id": pv_a.id,
        "from_label": pv_a.version_label,
        "to_version_id": pv_b.id,
        "to_label": pv_b.version_label,
        "added_step_keys": added,
        "removed_step_keys": removed,
        "modified": modified,
        "added_count": len(added),
        "removed_count": len(removed),
        "modified_count": len(modified),
    }


# --- helpers ----------------------------------------------------------------


def _compile_confidence(steps: list[dict]) -> str:
    if not steps:
        return "low"
    bands = [s.get("confidence", "medium") for s in steps]
    score = sum({"low": 0, "medium": 1, "high": 2}.get(b, 1) for b in bands) / len(bands)
    if score < 0.7:
        return "low"
    if score < 1.4:
        return "medium"
    return "high"


async def _get_pv_with_proto(session: AsyncSession, vid: str, org_id: str) -> tuple[ProtocolVersion, Protocol]:
    pv = (await session.execute(select(ProtocolVersion).where(ProtocolVersion.id == vid))).scalar_one_or_none()
    if pv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Protocol version not found")
    proto = (
        await session.execute(select(Protocol).where(Protocol.id == pv.protocol_id))
    ).scalar_one()
    if proto.org_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Protocol version not found")
    return pv, proto


async def _load_version_detail(
    session: AsyncSession, vid: str, *, org_id: str | None = None
) -> ProtocolVersionDetail:
    pv = (await session.execute(select(ProtocolVersion).where(ProtocolVersion.id == vid))).scalar_one_or_none()
    if pv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Protocol version not found")
    proto = (await session.execute(select(Protocol).where(Protocol.id == pv.protocol_id))).scalar_one()
    if org_id is not None and proto.org_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Protocol version not found")
    steps = (
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
    rules = (
        (
            await session.execute(
                select(HazardRule).where(HazardRule.protocol_version_id == pv.id)
            )
        )
        .scalars()
        .all()
    )
    return ProtocolVersionDetail(
        **ProtocolVersionOut.model_validate(pv).model_dump(),
        name=proto.name,
        steps=[ProtocolStepOut.model_validate(s) for s in steps],
        hazard_rules=[HazardRuleOut.model_validate(h) for h in rules],
        compiler_metadata=pv.compiler_metadata or {},
    )


async def _apply_step_patch(
    session: AsyncSession, version_id: str, step_id: str, patch: DraftPatchStepRequest
) -> None:
    step = (
        await session.execute(
            select(ProtocolStep).where(
                ProtocolStep.id == step_id, ProtocolStep.protocol_version_id == version_id
            )
        )
    ).scalar_one_or_none()
    if step is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Step not found")
    data = patch.model_dump(exclude_none=True)
    direct_fields = {
        "title",
        "instruction",
        "is_skippable",
        "prerequisites_json",
        "required_ppe_json",
        "controls_json",
        "materials_json",
        "equipment_json",
        "stop_conditions_json",
        "expected_observations_json",
        "reviewer_notes",
    }
    for k in direct_fields:
        if k in data:
            setattr(step, k, data[k])
    if "timers_json" in data and data["timers_json"] is not None:
        step.timers_json = [t for t in data["timers_json"]]
    if "visual_checks_json" in data and data["visual_checks_json"] is not None:
        step.visual_checks_json = data["visual_checks_json"]
    if "data_capture_schema_json" in data and data["data_capture_schema_json"] is not None:
        step.data_capture_schema_json = data["data_capture_schema_json"]
