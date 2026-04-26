"""Common FastAPI dependencies (auth, current org, RBAC)."""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import set_request_anthropic_key
from app.core.security import decode_token
from app.db.session import get_db
from app.models.organization import Membership, Organization
from app.models.user import User

bearer = HTTPBearer(auto_error=False)

ROLE_RANK = {
    "operator": 0,
    "reviewer": 2,
    "manager": 3,
    "safety_lead": 3,
    "admin": 4,
}


async def get_current_user(
    creds: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if creds is None or not creds.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        claims = decode_token(creds.credentials)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}") from e
    if claims.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    user_id = claims.get("sub")
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User is inactive")
    return user


class CurrentContext:
    def __init__(
        self, user: User, membership: Membership, organization: Organization
    ) -> None:
        self.user = user
        self.membership = membership
        self.organization = organization

    @property
    def role(self) -> str:
        return self.membership.role

    @property
    def org_id(self) -> str:
        return self.organization.id

    @property
    def user_id(self) -> str:
        return self.user.id

    def require_role(self, *roles: str) -> None:
        if self.role in roles:
            return
        # rank-based: admin can do anything
        if ROLE_RANK.get(self.role, -1) >= ROLE_RANK.get("admin", 999) and "admin" in roles:
            return
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires role: {','.join(roles)}")

    def require_min(self, min_role: str) -> None:
        if ROLE_RANK.get(self.role, -1) < ROLE_RANK.get(min_role, 0):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, f"Requires at least role: {min_role}"
            )

    def has_min(self, min_role: str) -> bool:
        return ROLE_RANK.get(self.role, -1) >= ROLE_RANK.get(min_role, 0)


async def current_context(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
    x_org_id: Annotated[Optional[str], Header(alias="X-Org-Id")] = None,
) -> CurrentContext:
    res = await session.execute(select(Membership).where(Membership.user_id == user.id))
    memberships = list(res.scalars().all())
    if not memberships:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "User has no organization memberships")
    membership: Optional[Membership] = None
    if x_org_id:
        membership = next((m for m in memberships if m.org_id == x_org_id), None)
        if membership is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "User is not a member of this organization")
    if membership is None:
        membership = memberships[0]
    org = (
        await session.execute(select(Organization).where(Organization.id == membership.org_id))
    ).scalar_one()
    # Surface the org's Anthropic key (if any) for AI calls during this request.
    set_request_anthropic_key(org.anthropic_api_key)
    return CurrentContext(user=user, membership=membership, organization=org)
