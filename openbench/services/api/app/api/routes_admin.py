from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentContext, current_context
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.organization import Membership, Organization
from app.models.protocol import Protocol, ProtocolVersion
from app.models.user import User
from app.models.webhook import WebhookSubscription
from app.schemas.admin import (
    AuditLogOut,
    InviteRequest,
    MemberOut,
    OrgSettingsOut,
    OrgSettingsUpdate,
    RoleUpdate,
    UserOut,
    WebhookCreate,
    WebhookOut,
)
from app.services.audit import record_audit
from app.services.webhook import validate_webhook_target_url

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=List[MemberOut])
async def list_org_members(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> List[MemberOut]:
    ctx.require_min("manager")
    res = await session.execute(
        select(Membership).where(Membership.org_id == ctx.org_id)
    )
    out: list[MemberOut] = []
    for m in res.scalars().all():
        u = (await session.execute(select(User).where(User.id == m.user_id))).scalar_one()
        out.append(
            MemberOut(membership_id=m.id, user=UserOut.model_validate(u), role=m.role, team_id=m.team_id)
        )
    return out


@router.post("/users/invite", response_model=MemberOut)
async def invite_user(
    payload: InviteRequest,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberOut:
    ctx.require_min("admin")
    if payload.role == "admin" and ctx.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can invite admins")
    user = (await session.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if user is None:
        user = User(
            email=payload.email,
            display_name=payload.display_name,
            password_hash=hash_password(payload.initial_password),
        )
        session.add(user)
        await session.flush()
    existing = (
        await session.execute(
            select(Membership).where(
                Membership.user_id == user.id, Membership.org_id == ctx.org_id
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "User already a member of this org")
    m = Membership(org_id=ctx.org_id, user_id=user.id, role=payload.role)
    session.add(m)
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="admin.user_invite",
        target_type="user",
        target_id=user.id,
        summary=f"Invited {user.email} as {payload.role}",
    )
    await session.commit()
    return MemberOut(membership_id=m.id, user=UserOut.model_validate(user), role=m.role, team_id=m.team_id)


@router.patch("/memberships/{membership_id}", response_model=MemberOut)
async def update_membership(
    membership_id: str,
    payload: RoleUpdate,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberOut:
    ctx.require_min("admin")
    m = (
        await session.execute(
            select(Membership).where(Membership.id == membership_id, Membership.org_id == ctx.org_id)
        )
    ).scalar_one_or_none()
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership not found")
    m.role = payload.role
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="admin.role_update",
        target_type="membership",
        target_id=m.id,
        summary=f"Changed role to {payload.role}",
    )
    await session.commit()
    user = (await session.execute(select(User).where(User.id == m.user_id))).scalar_one()
    return MemberOut(membership_id=m.id, user=UserOut.model_validate(user), role=m.role, team_id=m.team_id)


@router.get("/settings", response_model=OrgSettingsOut)
async def get_settings(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> OrgSettingsOut:
    org = (await session.execute(select(Organization).where(Organization.id == ctx.org_id))).scalar_one()
    return OrgSettingsOut(
        org_id=org.id,
        name=org.name,
        slug=org.slug,
        data_region=org.data_region,
        retention_policy_days=org.retention_policy_days,
    )


@router.patch("/settings", response_model=OrgSettingsOut)
async def patch_settings(
    payload: OrgSettingsUpdate,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> OrgSettingsOut:
    ctx.require_min("admin")
    org = (await session.execute(select(Organization).where(Organization.id == ctx.org_id))).scalar_one()
    if payload.name is not None:
        org.name = payload.name
    if payload.data_region is not None:
        org.data_region = payload.data_region
    if payload.retention_policy_days is not None:
        org.retention_policy_days = payload.retention_policy_days
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="admin.settings_update",
        target_type="organization",
        target_id=org.id,
    )
    await session.commit()
    return OrgSettingsOut(
        org_id=org.id,
        name=org.name,
        slug=org.slug,
        data_region=org.data_region,
        retention_policy_days=org.retention_policy_days,
    )


@router.get("/audit", response_model=List[AuditLogOut])
async def query_audit(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 200,
) -> List[AuditLogOut]:
    ctx.require_min("manager")
    res = await session.execute(
        select(AuditLog).where(AuditLog.org_id == ctx.org_id).order_by(desc(AuditLog.created_at)).limit(limit)
    )
    return [
        AuditLogOut(
            id=a.id,
            actor_id=a.actor_id,
            action=a.action,
            target_type=a.target_type,
            target_id=a.target_id,
            summary=a.summary,
            metadata_json=a.metadata_json,
            created_at=a.created_at,
        )
        for a in res.scalars().all()
    ]


# Webhooks --------------------------------------------------------------------


@router.post("/webhooks", response_model=WebhookOut)
async def add_webhook(
    payload: WebhookCreate,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> WebhookOut:
    ctx.require_min("admin")
    try:
        target_url = validate_webhook_target_url(str(payload.target_url))
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    sub = WebhookSubscription(
        org_id=ctx.org_id,
        target_url=target_url,
        event_types=payload.event_types,
        active=True,
        created_by=ctx.user_id,
    )
    session.add(sub)
    await session.flush()
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="admin.webhook_create",
        target_type="webhook",
        target_id=sub.id,
        summary=f"Created webhook {target_url}",
    )
    await session.commit()
    return WebhookOut(id=sub.id, target_url=sub.target_url, event_types=sub.event_types, active=sub.active)


@router.get("/webhooks", response_model=List[WebhookOut])
async def list_webhooks(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> List[WebhookOut]:
    ctx.require_min("admin")
    res = await session.execute(
        select(WebhookSubscription).where(WebhookSubscription.org_id == ctx.org_id)
    )
    return [
        WebhookOut(id=w.id, target_url=w.target_url, event_types=w.event_types, active=w.active)
        for w in res.scalars().all()
    ]


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    ctx.require_min("admin")
    res = await session.execute(
        select(WebhookSubscription).where(
            WebhookSubscription.id == webhook_id, WebhookSubscription.org_id == ctx.org_id
        )
    )
    sub = res.scalar_one_or_none()
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Webhook not found")
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="admin.webhook_delete",
        target_type="webhook",
        target_id=sub.id,
        summary=f"Deleted webhook {sub.target_url}",
    )
    await session.delete(sub)
    await session.commit()
    return {"status": "deleted"}


# Reviewer queue (PRD §32.2 reviewer workload tools) -------------------------


@router.get("/reviewer-queue")
async def reviewer_queue(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Drafts and in-review protocol versions waiting for human review.

    Sorted oldest-first so the longest-pending work surfaces at the top.
    Each row carries the conflict / gap counts from the compiler so reviewers
    can prioritise the riskiest extractions.
    """
    ctx.require_min("reviewer")
    res = await session.execute(
        select(ProtocolVersion, Protocol)
        .join(Protocol, ProtocolVersion.protocol_id == Protocol.id)
        .where(
            Protocol.org_id == ctx.org_id,
            ProtocolVersion.status.in_(["draft", "in_review"]),
        )
        .order_by(ProtocolVersion.created_at.asc())
    )
    out: list[dict] = []
    for pv, proto in res.all():
        cm = pv.compiler_metadata or {}
        out.append(
            {
                "protocol_version_id": pv.id,
                "protocol_id": proto.id,
                "name": proto.name,
                "version_label": pv.version_label,
                "status": pv.status,
                "created_at": pv.created_at.isoformat() if pv.created_at else None,
                "source_doc_count": len(pv.source_doc_ids or []),
                "conflicts": len(cm.get("conflicts") or []),
                "gaps": len(cm.get("gaps") or []),
                "synthesis_cards": len(cm.get("synthesis_cards") or []),
                "missing_coverage": len(cm.get("missing_coverage") or []),
                "compile_error": bool(cm.get("hazard_compile_error") or cm.get("conflict_resolve_error")),
            }
        )
    return out



# Retention enforcement on-demand --------------------------------------------


@router.post("/retention/purge")
async def admin_retention_purge(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Run the retention sweep for the caller's org immediately.

    Deletes completed/cancelled runs older than `retention_policy_days`. The
    Celery beat schedule runs this daily; this endpoint exists for admins who
    just changed their policy and want it applied now.
    """
    ctx.require_min("admin")
    from app.services.retention import purge_org_retention

    summary = await purge_org_retention(session, ctx.organization)
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="admin.retention_purge",
        target_type="organization",
        target_id=ctx.org_id,
        summary=f"Retention purge: {summary.get('runs_purged', 0)} runs",
        metadata=summary,
    )
    await session.commit()
    return summary


# Anthropic API key management ------------------------------------------------


class ApiKeyStatus(BaseModel):
    has_key: bool
    masked: Optional[str] = None
    source: str  # "org" | "env" | "none"
    updated_at: Optional[datetime] = None


class ApiKeyUpdate(BaseModel):
    api_key: Optional[str] = None  # null/empty clears the override


class ApiKeyTestResponse(BaseModel):
    ok: bool
    detail: Optional[str] = None
    model: Optional[str] = None


def _mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:4]}…{key[-4:]}"


@router.get("/api-keys", response_model=ApiKeyStatus)
async def get_api_key_status(
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiKeyStatus:
    """Return whether the org has an Anthropic key set, and a masked preview.

    Never returns the raw key. Falls back to indicating the env var is in use
    when the org has none.
    """
    ctx.require_min("manager")
    org = (
        await session.execute(select(Organization).where(Organization.id == ctx.org_id))
    ).scalar_one()
    if org.anthropic_api_key:
        return ApiKeyStatus(
            has_key=True,
            masked=_mask_key(org.anthropic_api_key),
            source="org",
            updated_at=org.updated_at,
        )
    if (settings.anthropic_api_key or "").strip():
        return ApiKeyStatus(
            has_key=True,
            masked=_mask_key(settings.anthropic_api_key),
            source="env",
        )
    return ApiKeyStatus(has_key=False, source="none")


@router.patch("/api-keys", response_model=ApiKeyStatus)
async def update_api_key(
    payload: ApiKeyUpdate,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiKeyStatus:
    """Set or clear the org's Anthropic API key.

    Pass `api_key: null` (or empty string) to clear and fall back to the env.
    Admin-only; the key is stored plaintext and never returned raw.
    """
    ctx.require_min("admin")
    org = (
        await session.execute(select(Organization).where(Organization.id == ctx.org_id))
    ).scalar_one()
    new_key = (payload.api_key or "").strip() or None
    org.anthropic_api_key = new_key
    await record_audit(
        session,
        org_id=ctx.org_id,
        actor_id=ctx.user_id,
        action="admin.api_key_update",
        target_type="organization",
        target_id=org.id,
        summary="Cleared Anthropic key" if new_key is None else "Updated Anthropic key",
    )
    await session.commit()
    # Refresh the request-scoped override so subsequent calls in this request
    # use the new key immediately.
    from app.ai.client import set_request_anthropic_key

    set_request_anthropic_key(new_key)
    if new_key:
        return ApiKeyStatus(
            has_key=True,
            masked=_mask_key(new_key),
            source="org",
            updated_at=org.updated_at,
        )
    if (settings.anthropic_api_key or "").strip():
        return ApiKeyStatus(
            has_key=True, masked=_mask_key(settings.anthropic_api_key), source="env"
        )
    return ApiKeyStatus(has_key=False, source="none")


@router.post("/api-keys/test", response_model=ApiKeyTestResponse)
async def test_api_key(
    ctx: Annotated[CurrentContext, Depends(current_context)],
) -> ApiKeyTestResponse:
    """Send a tiny ping to Anthropic with the currently-active key.

    Uses the resolved key for this request — org override if set, env otherwise.
    Returns ok=True on a successful round-trip.
    """
    ctx.require_min("manager")
    try:
        from app.ai.client import call_text

        out = call_text(
            system="Reply with the single word 'pong' and nothing else.",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=16,
        )
        return ApiKeyTestResponse(ok=True, detail=out.strip()[:64], model=settings.anthropic_model)
    except Exception as e:  # noqa: BLE001
        return ApiKeyTestResponse(ok=False, detail=str(e)[:200])
