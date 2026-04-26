from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_min: int


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str
    org_name: str
    org_slug: Optional[str] = None


class MembershipOut(BaseModel):
    id: str
    org_id: str
    org_name: str
    org_slug: str
    role: str


class MeResponse(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    memberships: List[MembershipOut]
