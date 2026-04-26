from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.config import settings
from app.db.session import get_db
from app.models.organization import Membership, Organization
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    MeResponse,
    MembershipOut,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
)
from slugify import slugify

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory refresh-token revocation set. Sufficient for single-process V1; a
# production deployment with multiple workers should swap in Redis.
_REVOKED_REFRESH_JTIS: set[str] = set()


@router.post("/register", response_model=TokenPair)
async def register(
    payload: RegisterRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPair:
    existing = await session.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "User with that email already exists")
    user = User(
        email=payload.email,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
    )
    org = Organization(name=payload.org_name, slug=payload.org_slug or slugify(payload.org_name))
    session.add_all([user, org])
    await session.flush()
    membership = Membership(org_id=org.id, user_id=user.id, role="admin")
    session.add(membership)
    await session.commit()
    return TokenPair(
        access_token=create_access_token(user.id, claims={"org_id": org.id}),
        refresh_token=create_refresh_token(user.id),
        expires_in_min=settings.jwt_access_ttl_min,
    )


@router.post("/login", response_model=TokenPair)
async def login(
    payload: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPair:
    user = (await session.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if user is None or user.status != "active" or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in_min=settings.jwt_access_ttl_min,
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    payload: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPair:
    try:
        claims = decode_token(payload.refresh_token)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid refresh: {e}") from e
    if claims.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    jti = claims.get("jti")
    if jti and jti in _REVOKED_REFRESH_JTIS:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token revoked")
    user = (
        await session.execute(select(User).where(User.id == claims["sub"]))
    ).scalar_one_or_none()
    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    # rotate: revoke the just-used jti so a stolen refresh token cannot be replayed
    if jti:
        _REVOKED_REFRESH_JTIS.add(jti)
    return TokenPair(
        access_token=create_access_token(claims["sub"]),
        refresh_token=create_refresh_token(claims["sub"]),
        expires_in_min=settings.jwt_access_ttl_min,
    )


@router.post("/logout")
async def logout(payload: RefreshRequest | None = None) -> dict[str, str]:
    if payload and payload.refresh_token:
        try:
            claims = decode_token(payload.refresh_token)
            if claims.get("type") == "refresh" and claims.get("jti"):
                _REVOKED_REFRESH_JTIS.add(claims["jti"])
        except Exception:
            pass
    return {"status": "ok"}


@router.get("/me", response_model=MeResponse)
async def me(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MeResponse:
    res = await session.execute(select(Membership).where(Membership.user_id == user.id))
    memberships = res.scalars().all()
    out = []
    for m in memberships:
        org = (
            await session.execute(select(Organization).where(Organization.id == m.org_id))
        ).scalar_one()
        out.append(
            MembershipOut(
                id=m.id, org_id=m.org_id, org_name=org.name, org_slug=org.slug, role=m.role
            )
        )
    return MeResponse(
        id=user.id, email=user.email, display_name=user.display_name, memberships=out
    )
