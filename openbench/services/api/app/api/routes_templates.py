"""Run template library — saved starting configurations for a run.

PRD §32.2 V1.1 polish item. Templates capture (protocol_version_id, name,
description, default_device_id, default_metadata) so a recurring procedure
starts with one click instead of repeated copy-paste.
"""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentContext, current_context
from app.core.ids import run_id
from app.db.session import get_db
from app.models.protocol import Protocol, ProtocolVersion
from app.models.run import Run
from app.models.template import RunTemplate
from app.schemas.runs import RunOut
from app.services.audit import record_audit
from app.services.run_engine import append_event
from app.services.webhook import fan_out

router = APIRouter(prefix="/api/run-templates", tags=["templates"])


class TemplateCreate(BaseModel):
    protocol_version_id: str
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    default_device_id: Optional[str] = None
    default_metadata: dict[str, Any] = Field(default_factory=dict)


class TemplatePatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    default_device_id: Optional[str] = None
    default_metadata: Optional[dict[str, Any]] = None


class TemplateOut(BaseModel):
    id: str
    org_id: str
    protocol_version_id: str
    name: str
    description: Optional[str] = None
    default_device_id: Optional[str] = None
    default_metadata: dict[str, Any] = Field(default_factory=dict)
    created_by: Optional[str] = None
    created_at: datetime


def _to_out(t: RunTemplate) -> TemplateOut:
    return TemplateOut(
        id=t.id,
        org_id=t.org_id,
        protocol_version_id=t.protocol_version_id,
        name=t.name,
        description=t.description,
        default_device_id=t.default_device_id,
        default_metadata=dict(t.default_metadata or {}),
        created_by=t.created_by,
        created_at=t.created_at,
    )


async def _published_pv_for_org(
    session: AsyncSession, pv_id: str, org_id: str
) -> ProtocolVersion:
    pv = (await session.execute(select(ProtocolVersion).where(ProtocolVersion.id == pv_id))).scalar_one_or_none()
    if pv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Protocol version not found")
    proto = (await session.execute(select(Protocol).where(Protocol.id == pv.protocol_id))).scalar_one()
    if proto.org_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Protocol version not found")
    if pv.status != "published":
        raise HTTPException(status.HTTP_409_CONFLICT, "Templates require a published version")
    return pv


@router.post("", response_model=TemplateOut)
async def create_template(
    payload: TemplateCreate,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TemplateOut:
    ctx.require_min("reviewer")
    await _published_pv_for_org(session, payload.protocol_version_id, ctx.org_id)
    t = RunTemplate(
        org_id=ctx.org_id,
        protocol_version_id=payload.protocol_version_id,
        name=payload.name,
        description=payload.description,
        default_device_id=payload.default_device_id,
        default_metadata=payload.default_metadata,
        created_by=ctx.user_id,
    )
    session.add(t)
    await session.flush()
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="template.create",
        target_type="run_template",
        target_id=t.id,
        summary=f"Created template '{t.name}'",
    )
    await session.commit()
    return _to_out(t)


@router.get("", response_model=List[TemplateOut])
async def list_templates(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    protocol_version_id: Optional[str] = None,
) -> List[TemplateOut]:
    stmt = (
        select(RunTemplate)
        .where(RunTemplate.org_id == ctx.org_id)
        .order_by(RunTemplate.created_at.desc())
    )
    if protocol_version_id:
        stmt = stmt.where(RunTemplate.protocol_version_id == protocol_version_id)
    rows = (await session.execute(stmt)).scalars().all()
    return [_to_out(r) for r in rows]


@router.get("/{template_id}", response_model=TemplateOut)
async def get_template(
    template_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TemplateOut:
    t = (
        await session.execute(
            select(RunTemplate).where(
                RunTemplate.id == template_id, RunTemplate.org_id == ctx.org_id
            )
        )
    ).scalar_one_or_none()
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    return _to_out(t)


@router.patch("/{template_id}", response_model=TemplateOut)
async def patch_template(
    template_id: str,
    payload: TemplatePatch,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TemplateOut:
    ctx.require_min("reviewer")
    t = (
        await session.execute(
            select(RunTemplate).where(
                RunTemplate.id == template_id, RunTemplate.org_id == ctx.org_id
            )
        )
    ).scalar_one_or_none()
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    if payload.name is not None:
        t.name = payload.name
    if payload.description is not None:
        t.description = payload.description
    if payload.default_device_id is not None:
        t.default_device_id = payload.default_device_id
    if payload.default_metadata is not None:
        t.default_metadata = payload.default_metadata
    await session.commit()
    return _to_out(t)


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    ctx.require_min("reviewer")
    t = (
        await session.execute(
            select(RunTemplate).where(
                RunTemplate.id == template_id, RunTemplate.org_id == ctx.org_id
            )
        )
    ).scalar_one_or_none()
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="template.delete",
        target_type="run_template",
        target_id=t.id,
        summary=f"Deleted template '{t.name}'",
    )
    await session.delete(t)
    await session.commit()
    return {"status": "deleted"}


@router.post("/{template_id}/start", response_model=RunOut)
async def start_run_from_template(
    template_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    device_id_override: Optional[str] = None,
) -> RunOut:
    """Convenience endpoint: create a Run pre-bound to the template's pv,
    using the template's default device unless overridden."""
    t = (
        await session.execute(
            select(RunTemplate).where(
                RunTemplate.id == template_id, RunTemplate.org_id == ctx.org_id
            )
        )
    ).scalar_one_or_none()
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    pv = await _published_pv_for_org(session, t.protocol_version_id, ctx.org_id)
    run = Run(
        id=run_id(),
        org_id=ctx.org_id,
        protocol_version_id=pv.id,
        operator_id=ctx.user_id,
        status="created",
        device_id=device_id_override or t.default_device_id,
    )
    session.add(run)
    await session.flush()
    await append_event(
        session,
        run_id=run.id,
        event_type="run_created",
        actor_id=ctx.user_id,
        payload={
            "protocol_version_id": pv.id,
            "device_id": run.device_id,
            "from_template_id": t.id,
            "default_metadata": t.default_metadata,
        },
    )
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="run.create_from_template",
        target_type="run",
        target_id=run.id,
        metadata={"template_id": t.id, "protocol_version_id": pv.id},
    )
    await session.commit()
    await fan_out(
        session, org_id=ctx.org_id, event_type="run_created",
        payload={"run_id": run.id, "from_template_id": t.id},
    )
    await session.commit()
    return RunOut.model_validate(run)
