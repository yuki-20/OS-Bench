from __future__ import annotations

from typing import Any, List, Literal, Optional

from pydantic import AnyHttpUrl, BaseModel, EmailStr, Field

from app.schemas.common import ORMModel

RoleName = Literal["operator", "reviewer", "manager", "safety_lead", "admin"]
WebhookEventType = Literal[
    "run_created",
    "run_started",
    "run_resumed",
    "run_blocked",
    "run_ready_for_handover",
    "run_completed",
    "run_paused",
    "run_cancelled",
    "deviation_added",
    "override_requested",
    "override_resolved",
    "handover_generated",
    "handover_finalized",
]


class UserOut(ORMModel):
    id: str
    email: EmailStr
    display_name: str
    status: str


class MemberOut(BaseModel):
    membership_id: str
    user: UserOut
    role: RoleName
    team_id: Optional[str] = None


class InviteRequest(BaseModel):
    email: EmailStr
    display_name: str
    role: RoleName = "operator"
    initial_password: str = Field(min_length=8)


class RoleUpdate(BaseModel):
    role: RoleName


class OrgSettingsOut(BaseModel):
    org_id: str
    name: str
    slug: str
    data_region: str
    retention_policy_days: int


class OrgSettingsUpdate(BaseModel):
    name: Optional[str] = None
    data_region: Optional[str] = None
    retention_policy_days: Optional[int] = Field(default=None, gt=0, le=3650)


class WebhookCreate(BaseModel):
    target_url: AnyHttpUrl
    event_types: List[WebhookEventType] = Field(default_factory=list, max_length=20)


class WebhookOut(BaseModel):
    id: str
    target_url: str
    event_types: List[str]
    active: bool


class AuditLogOut(BaseModel):
    id: str
    actor_id: Optional[str] = None
    action: str
    target_type: str
    target_id: Optional[str] = None
    summary: Optional[str] = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)
    created_at: Any
