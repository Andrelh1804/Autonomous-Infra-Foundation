from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator
import re


def validate_email_str(v: str) -> str:
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$|^[^@\s]+@[^@\s]+$', v):
        raise ValueError("Invalid email format")
    return v.lower()


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return validate_email_str(v)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Organization ──────────────────────────────────────────────────────────────

class OrganizationCreate(BaseModel):
    name: str
    company_name: Optional[str] = None
    document: Optional[str] = None
    status: str = "active"


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    document: Optional[str] = None
    status: Optional[str] = None


class OrganizationResponse(BaseModel):
    id: int
    uuid: str
    name: str
    company_name: Optional[str]
    document: Optional[str]
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── User ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    organization_id: Optional[int] = None
    first_name: str
    last_name: str
    email: str
    password: str
    role_ids: Optional[List[int]] = []

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return validate_email_str(v)

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    active: Optional[bool] = None
    role_ids: Optional[List[int]] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return validate_email_str(v)


class UserResponse(BaseModel):
    id: int
    uuid: str
    organization_id: Optional[int]
    first_name: str
    last_name: str
    email: str
    active: bool
    is_super_admin: bool
    mfa_enabled: bool
    last_login: Optional[datetime]
    created_at: datetime
    roles: List[str] = []

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ── Role ──────────────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permission_ids: Optional[List[int]] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[List[int]] = None


class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    permissions: List[str] = []

    class Config:
        from_attributes = True


# ── Permission ────────────────────────────────────────────────────────────────

class PermissionResponse(BaseModel):
    id: int
    name: str
    module: str
    description: Optional[str]

    class Config:
        from_attributes = True


# ── Site ──────────────────────────────────────────────────────────────────────

class SiteCreate(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None


class SiteResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    country: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Audit ─────────────────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    user_email: Optional[str]
    action: str
    module: str
    ip_address: Optional[str]
    payload: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingUpdate(BaseModel):
    value: str


class SettingResponse(BaseModel):
    key: str
    value: Optional[str]
    description: Optional[str]

    class Config:
        from_attributes = True


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_organizations: int
    total_users: int
    active_sessions: int
    active_organizations: int


class RecentAccessItem(BaseModel):
    user_email: str
    ip_address: Optional[str]
    created_at: datetime


# ── Pagination ────────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    per_page: int
    pages: int
