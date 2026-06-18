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


# ── Phase 2: CMDB / Discovery Schemas ─────────────────────────────────────────

class AssetTypeResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str]
    icon: Optional[str]

    class Config:
        from_attributes = True


class ManufacturerResponse(BaseModel):
    id: int
    name: str
    website: Optional[str]
    support_url: Optional[str]

    class Config:
        from_attributes = True


class TagResponse(BaseModel):
    id: int
    name: str
    color: str

    class Config:
        from_attributes = True


class AssetCreate(BaseModel):
    organization_id: Optional[int] = None
    site_id: Optional[int] = None
    asset_type_id: Optional[int] = None
    manufacturer_id: Optional[int] = None
    model_id: Optional[int] = None
    hostname: Optional[str] = None
    fqdn: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    serial_number: Optional[str] = None
    operating_system: Optional[str] = None
    os_version: Optional[str] = None
    firmware_version: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    responsible: Optional[str] = None
    status: str = "active"
    criticality: str = "medium"
    tag_ids: Optional[List[int]] = []


class AssetUpdate(BaseModel):
    site_id: Optional[int] = None
    asset_type_id: Optional[int] = None
    manufacturer_id: Optional[int] = None
    model_id: Optional[int] = None
    hostname: Optional[str] = None
    fqdn: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    serial_number: Optional[str] = None
    operating_system: Optional[str] = None
    os_version: Optional[str] = None
    firmware_version: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    responsible: Optional[str] = None
    status: Optional[str] = None
    criticality: Optional[str] = None
    approval_status: Optional[str] = None
    tag_ids: Optional[List[int]] = None


class AssetResponse(BaseModel):
    id: int
    uuid: str
    organization_id: int
    site_id: Optional[int]
    asset_type_id: Optional[int]
    manufacturer_id: Optional[int]
    model_id: Optional[int]
    hostname: Optional[str]
    fqdn: Optional[str]
    ip_address: Optional[str]
    mac_address: Optional[str]
    serial_number: Optional[str]
    operating_system: Optional[str]
    os_version: Optional[str]
    firmware_version: Optional[str]
    description: Optional[str]
    location: Optional[str]
    responsible: Optional[str]
    status: str
    criticality: str
    approval_status: str
    last_seen: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    asset_type: Optional[AssetTypeResponse] = None
    manufacturer: Optional[ManufacturerResponse] = None
    tags: List[TagResponse] = []

    @classmethod
    def model_validate(cls, obj, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        if hasattr(obj, 'asset_tags'):
            instance.tags = [TagResponse.model_validate(at.tag) for at in obj.asset_tags if at.tag]
        return instance

    class Config:
        from_attributes = True


class AssetHistoryResponse(BaseModel):
    id: int
    asset_id: int
    changed_by: Optional[int]
    change_source: str
    changes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AssetRelationshipCreate(BaseModel):
    target_asset_id: int
    relationship_type: str
    description: Optional[str] = None


class AssetRelationshipResponse(BaseModel):
    id: int
    source_asset_id: int
    target_asset_id: int
    relationship_type: str
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class DiscoveryJobCreate(BaseModel):
    name: Optional[str] = None
    organization_id: Optional[int] = None
    site_id: Optional[int] = None
    targets: List[str]
    methods: Optional[List[str]] = ["icmp", "dns"]


class DiscoveryJobResponse(BaseModel):
    id: int
    uuid: str
    organization_id: int
    site_id: Optional[int]
    name: Optional[str]
    targets: Optional[str]
    methods: Optional[str]
    status: str
    hosts_scanned: int
    hosts_found: int
    error_message: Optional[str]
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class DiscoveryResultResponse(BaseModel):
    id: int
    discovery_job_id: int
    asset_id: Optional[int]
    ip_address: Optional[str]
    hostname: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DiscoveryScheduleCreate(BaseModel):
    name: str
    organization_id: Optional[int] = None
    site_id: Optional[int] = None
    targets: List[str]
    methods: Optional[List[str]] = ["icmp", "dns"]
    interval_minutes: int = 60
    is_enabled: bool = True


class DiscoveryScheduleUpdate(BaseModel):
    name: Optional[str] = None
    targets: Optional[List[str]] = None
    methods: Optional[List[str]] = None
    interval_minutes: Optional[int] = None
    is_enabled: Optional[bool] = None


class DiscoveryScheduleResponse(BaseModel):
    id: int
    organization_id: int
    site_id: Optional[int]
    name: str
    targets: str
    methods: Optional[str]
    interval_minutes: int
    is_enabled: bool
    last_run_at: Optional[datetime]
    next_run_at: Optional[datetime]
    last_job_id: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
