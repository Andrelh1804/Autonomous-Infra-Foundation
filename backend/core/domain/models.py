import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Float, Enum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def generate_uuid():
    return str(uuid.uuid4())


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), default=generate_uuid, unique=True, index=True)
    name = Column(String(255), nullable=False)
    company_name = Column(String(255))
    document = Column(String(50))
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    users = relationship("User", back_populates="organization")
    sites = relationship("Site", back_populates="organization")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255))

    user_roles = relationship("UserRole", back_populates="role")
    role_permissions = relationship("RolePermission", back_populates="role")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    module = Column(String(50), nullable=False)
    description = Column(String(255))

    role_permissions = relationship("RolePermission", back_populates="permission")


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"))
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"))

    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")

    __table_args__ = (UniqueConstraint("role_id", "permission_id"),)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), default=generate_uuid, unique=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"))
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_super_admin = Column(Boolean, default=False)
    active = Column(Boolean, default=True)
    mfa_secret = Column(String(64))
    mfa_enabled = Column(Boolean, default=False)
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="users")
    user_roles = relationship("UserRole", back_populates="user")
    sessions = relationship("UserSession", back_populates="user")


class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"))

    user = relationship("User", back_populates="user_roles")
    role = relationship("Role", back_populates="user_roles")

    __table_args__ = (UniqueConstraint("user_id", "role_id"),)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    token_jti = Column(String(36), unique=True, index=True)
    refresh_token_jti = Column(String(36), unique=True, index=True)
    ip_address = Column(String(45))
    user_agent = Column(String(512))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)

    user = relationship("User", back_populates="sessions")


class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"))
    name = Column(String(255), nullable=False)
    address = Column(String(500))
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="sites")


# ── Phase 2: CMDB / Discovery Models ──────────────────────────────────────────

class AssetType(Base):
    __tablename__ = "asset_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255))
    icon = Column(String(50))

    assets = relationship("Asset", back_populates="asset_type")


class Manufacturer(Base):
    __tablename__ = "manufacturers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    website = Column(String(255))
    support_url = Column(String(255))

    models = relationship("AssetModel", back_populates="manufacturer")
    assets = relationship("Asset", back_populates="manufacturer")


class AssetModel(Base):
    __tablename__ = "asset_models"

    id = Column(Integer, primary_key=True, index=True)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    part_number = Column(String(100))

    manufacturer = relationship("Manufacturer", back_populates="models")
    assets = relationship("Asset", back_populates="model")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    color = Column(String(20), default="#6366f1")

    asset_tags = relationship("AssetTag", back_populates="tag")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), default=generate_uuid, unique=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="SET NULL"), nullable=True)
    asset_type_id = Column(Integer, ForeignKey("asset_types.id", ondelete="SET NULL"), nullable=True)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id", ondelete="SET NULL"), nullable=True)
    model_id = Column(Integer, ForeignKey("asset_models.id", ondelete="SET NULL"), nullable=True)
    discovery_job_id = Column(Integer, ForeignKey("discovery_jobs.id", ondelete="SET NULL"), nullable=True)

    hostname = Column(String(255))
    fqdn = Column(String(255))
    ip_address = Column(String(45), index=True)
    mac_address = Column(String(17))
    serial_number = Column(String(100))
    operating_system = Column(String(255))
    os_version = Column(String(100))
    firmware_version = Column(String(100))
    description = Column(Text)
    location = Column(String(255))
    responsible = Column(String(255))
    uptime = Column(String(100))

    status = Column(String(20), default="active")
    criticality = Column(String(20), default="medium")
    approval_status = Column(String(20), default="approved")

    raw_data = Column(Text)
    last_seen = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization")
    site = relationship("Site")
    asset_type = relationship("AssetType", back_populates="assets")
    manufacturer = relationship("Manufacturer", back_populates="assets")
    model = relationship("AssetModel", back_populates="assets")
    asset_tags = relationship("AssetTag", back_populates="asset", cascade="all, delete-orphan")
    history = relationship("AssetHistory", back_populates="asset", cascade="all, delete-orphan")
    source_relationships = relationship("AssetRelationship", foreign_keys="AssetRelationship.source_asset_id", back_populates="source_asset", cascade="all, delete-orphan")
    target_relationships = relationship("AssetRelationship", foreign_keys="AssetRelationship.target_asset_id", back_populates="target_asset", cascade="all, delete-orphan")


class AssetTag(Base):
    __tablename__ = "asset_tags"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"))
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"))

    asset = relationship("Asset", back_populates="asset_tags")
    tag = relationship("Tag", back_populates="asset_tags")

    __table_args__ = (UniqueConstraint("asset_id", "tag_id"),)


class AssetRelationship(Base):
    __tablename__ = "asset_relationships"

    id = Column(Integer, primary_key=True, index=True)
    source_asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"))
    target_asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"))
    relationship_type = Column(String(100), nullable=False)
    description = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    source_asset = relationship("Asset", foreign_keys=[source_asset_id], back_populates="source_relationships")
    target_asset = relationship("Asset", foreign_keys=[target_asset_id], back_populates="target_relationships")


class AssetHistory(Base):
    __tablename__ = "asset_history"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"))
    changed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    change_source = Column(String(50), default="manual")
    changes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    asset = relationship("Asset", back_populates="history")
    user = relationship("User")


class DiscoveryJob(Base):
    __tablename__ = "discovery_jobs"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), default=generate_uuid, unique=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"))
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    name = Column(String(255))
    targets = Column(Text)
    methods = Column(String(255), default="icmp,dns")
    status = Column(String(20), default="pending")
    error_message = Column(Text)

    hosts_scanned = Column(Integer, default=0)
    hosts_found = Column(Integer, default=0)

    scheduled_at = Column(DateTime)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization")
    site = relationship("Site")
    creator = relationship("User")
    results = relationship("DiscoveryResult", back_populates="job", cascade="all, delete-orphan")
    assets = relationship("Asset", foreign_keys="Asset.discovery_job_id")


class DiscoveryResult(Base):
    __tablename__ = "discovery_results"

    id = Column(Integer, primary_key=True, index=True)
    discovery_job_id = Column(Integer, ForeignKey("discovery_jobs.id", ondelete="CASCADE"))
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)

    ip_address = Column(String(45))
    hostname = Column(String(255))
    status = Column(String(20), default="found")
    raw_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("DiscoveryJob", back_populates="results")
    asset = relationship("Asset")


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    name = Column(String(255), nullable=False)
    is_enabled = Column(Boolean, default=True)

    # Trigger: job_completed | job_failed | new_assets_found
    trigger = Column(String(50), nullable=False, default="job_completed")
    min_hosts_found = Column(Integer, default=1)   # for new_assets_found trigger

    # Channel: email | webhook | both
    channel = Column(String(20), nullable=False, default="email")

    # Email
    email_recipients = Column(Text)   # comma-separated addresses

    # Webhook
    webhook_url = Column(String(512))
    webhook_secret = Column(String(255))   # used for HMAC-SHA256 signature header

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization")
    creator = relationship("User")
    events = relationship("AlertEvent", back_populates="rule", cascade="all, delete-orphan")


class AlertEvent(Base):
    __tablename__ = "alert_events"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("alert_rules.id", ondelete="CASCADE"))
    discovery_job_id = Column(Integer, ForeignKey("discovery_jobs.id", ondelete="SET NULL"), nullable=True)

    trigger = Column(String(50))
    channel = Column(String(20))
    status = Column(String(20), default="sent")   # sent | failed
    payload = Column(Text)
    error_message = Column(Text)
    sent_at = Column(DateTime, default=datetime.utcnow)

    rule = relationship("AlertRule", back_populates="events")
    job = relationship("DiscoveryJob")


class DiscoverySchedule(Base):
    __tablename__ = "discovery_schedules"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    name = Column(String(255), nullable=False)
    targets = Column(Text, nullable=False)
    methods = Column(String(255), default="icmp,dns")
    interval_minutes = Column(Integer, nullable=False, default=60)
    is_enabled = Column(Boolean, default=True)

    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
    last_job_id = Column(Integer, ForeignKey("discovery_jobs.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization")
    site = relationship("Site")
    creator = relationship("User")
    last_job = relationship("DiscoveryJob", foreign_keys=[last_job_id])


# ── Audit Log (existing) ───────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_email = Column(String(255))
    action = Column(String(100), nullable=False)
    module = Column(String(50), nullable=False)
    ip_address = Column(String(45))
    user_agent = Column(String(512))
    payload = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text)
    description = Column(String(255))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
