import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Float,
)
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


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(64), unique=True, nullable=False, index=True)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    user = relationship("User")


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
    trigger = Column(String(50), nullable=False, default="job_completed")
    min_hosts_found = Column(Integer, default=1)
    channel = Column(String(20), nullable=False, default="email")
    email_recipients = Column(Text)
    webhook_url = Column(String(512))
    webhook_secret = Column(String(255))
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
    status = Column(String(20), default="sent")
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


# ── Phase 3: Monitoring & Observability ───────────────────────────────────────

class MonitoringTarget(Base):
    __tablename__ = "monitoring_targets"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    host = Column(String(255), nullable=False)
    device_type = Column(String(50), default="server")
    vendor = Column(String(100))
    collection_method = Column(String(20), default="icmp")
    snmp_version = Column(String(5), default="2c")
    snmp_community = Column(String(100), default="public")
    snmp_port = Column(Integer, default=161)
    ssh_user = Column(String(100))
    ssh_key = Column(Text)
    api_url = Column(String(512))
    api_token = Column(String(512))
    interval_seconds = Column(Integer, default=300)
    is_enabled = Column(Boolean, default=True)
    is_online = Column(Boolean, nullable=True)
    last_polled_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    health_score = Column(Float, default=100.0)
    uptime_percent = Column(Float, default=100.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    asset = relationship("Asset")
    site = relationship("Site")
    metrics = relationship("MetricSample", back_populates="target", cascade="all, delete-orphan")
    printer_supplies = relationship("PrinterSupply", back_populates="target", cascade="all, delete-orphan")


class MetricSample(Base):
    __tablename__ = "metric_samples"
    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("monitoring_targets.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    metric_name = Column(String(100), nullable=False, index=True)
    metric_value = Column(Float, nullable=False)
    metric_unit = Column(String(20))
    labels = Column(Text)
    sampled_at = Column(DateTime, default=datetime.utcnow, index=True)
    target = relationship("MonitoringTarget", back_populates="metrics")


class PrinterSupply(Base):
    __tablename__ = "printer_supplies"
    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("monitoring_targets.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    supply_type = Column(String(50), nullable=False)
    current_level = Column(Integer)
    max_level = Column(Integer, default=100)
    level_percent = Column(Float)
    daily_consumption = Column(Float)
    days_remaining = Column(Float)
    estimated_empty_at = Column(DateTime, nullable=True)
    risk_level = Column(String(20), default="normal")
    page_count_total = Column(Integer)
    page_count_mono = Column(Integer)
    page_count_color = Column(Integer)
    sampled_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    target = relationship("MonitoringTarget", back_populates="printer_supplies")


class MonitoringIncident(Base):
    __tablename__ = "monitoring_incidents"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(512), nullable=False)
    description = Column(Text)
    severity = Column(String(20), default="warning")
    status = Column(String(20), default="open")
    root_cause_target_id = Column(Integer, ForeignKey("monitoring_targets.id", ondelete="SET NULL"), nullable=True)
    event_count = Column(Integer, default=1)
    affected_targets = Column(Text)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    events = relationship("MonitoringEvent", foreign_keys="MonitoringEvent.incident_id")


class MonitoringEvent(Base):
    __tablename__ = "monitoring_events"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    target_id = Column(Integer, ForeignKey("monitoring_targets.id", ondelete="SET NULL"), nullable=True)
    incident_id = Column(Integer, ForeignKey("monitoring_incidents.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(50), nullable=False)
    severity = Column(String(20), default="info")
    title = Column(String(512), nullable=False)
    description = Column(Text)
    metric_name = Column(String(100))
    metric_value = Column(Float)
    threshold_value = Column(Float)
    status = Column(String(20), default="open")
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    organization = relationship("Organization")
    target = relationship("MonitoringTarget")


class MonitoringAlertRule(Base):
    __tablename__ = "monitoring_alert_rules"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    is_enabled = Column(Boolean, default=True)
    metric_name = Column(String(100), nullable=False)
    device_type = Column(String(50))
    operator = Column(String(10), default="gt")
    threshold = Column(Float, nullable=False)
    duration_minutes = Column(Integer, default=0)
    severity = Column(String(20), default="warning")
    channels = Column(Text, default='["email"]')
    email_recipients = Column(Text)
    webhook_url = Column(String(512))
    slack_webhook = Column(String(512))
    teams_webhook = Column(String(512))
    telegram_chat_id = Column(String(100))
    telegram_bot_token = Column(String(255))
    discord_webhook = Column(String(512))
    escalation_minutes = Column(Integer, default=60)
    escalation_channels = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")


class OidDefinition(Base):
    __tablename__ = "oid_definitions"
    id = Column(Integer, primary_key=True, index=True)
    vendor = Column(String(100), default="generic")
    device_type = Column(String(50), nullable=False)
    oid = Column(String(255), nullable=False, index=True)
    metric_name = Column(String(100), nullable=False)
    description = Column(String(255))
    unit = Column(String(20))
    value_type = Column(String(20), default="gauge")
    multiplier = Column(Float, default=1.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class HealthScoreRecord(Base):
    __tablename__ = "health_score_records"
    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("monitoring_targets.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, nullable=False)
    availability_score = Column(Float)
    performance_score = Column(Float)
    error_score = Column(Float)
    capacity_score = Column(Float)
    details = Column(Text)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)


class SlaRecord(Base):
    __tablename__ = "sla_records"
    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("monitoring_targets.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    period_type = Column(String(10), nullable=False)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    uptime_minutes = Column(Float, default=0)
    downtime_minutes = Column(Float, default=0)
    total_minutes = Column(Float, nullable=False)
    availability_percent = Column(Float, nullable=False)
    incident_count = Column(Integer, default=0)
    mttr_minutes = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)


class NotificationChannel(Base):
    __tablename__ = "notification_channels"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    channel_type = Column(String(30), nullable=False)
    is_enabled = Column(Boolean, default=True)
    config = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")


# ── Phase 4: Endpoint Management & RMM ────────────────────────────────────────

class Endpoint(Base):
    __tablename__ = "endpoints"
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), default=generate_uuid, unique=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="SET NULL"), nullable=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    hostname = Column(String(255), nullable=False, index=True)
    fqdn = Column(String(255))
    ip_address = Column(String(45), index=True)
    mac_address = Column(String(17))
    platform = Column(String(20), default="windows")
    os_name = Column(String(255))
    os_version = Column(String(100))
    os_build = Column(String(100))
    os_arch = Column(String(20))
    cpu_model = Column(String(255))
    cpu_cores = Column(Integer)
    ram_gb = Column(Float)
    disk_total_gb = Column(Float)
    disk_free_gb = Column(Float)
    agent_version = Column(String(50))
    agent_status = Column(String(20), default="offline")
    status = Column(String(20), default="active")
    last_seen = Column(DateTime)
    last_checkin = Column(DateTime)
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    risk_score = Column(Integer, default=0)
    compliance_score = Column(Integer, default=100)
    patch_score = Column(Integer, default=100)
    antivirus_status = Column(String(20), default="unknown")
    firewall_status = Column(String(20), default="unknown")
    encryption_status = Column(String(20), default="unknown")
    domain = Column(String(255))
    logged_user = Column(String(255))
    timezone = Column(String(100))
    locale = Column(String(50))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    site = relationship("Site")
    asset = relationship("Asset")
    agent_token = relationship("AgentToken", back_populates="endpoint", uselist=False)
    software = relationship("SoftwareInstallation", back_populates="endpoint", cascade="all, delete-orphan")
    ep_patches = relationship("EndpointPatch", back_populates="endpoint", cascade="all, delete-orphan")
    vulnerabilities = relationship("EndpointVulnerability", back_populates="endpoint", cascade="all, delete-orphan")
    compliance_checks = relationship("ComplianceCheck", back_populates="endpoint", cascade="all, delete-orphan")
    remote_actions = relationship("RemoteAction", back_populates="endpoint", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="endpoint", cascade="all, delete-orphan")
    policy_checks = relationship("PolicyCheck", back_populates="endpoint", cascade="all, delete-orphan")


class AgentToken(Base):
    __tablename__ = "agent_tokens"
    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    token_jti = Column(String(36), unique=True, index=True)
    is_active = Column(Boolean, default=True)
    last_used = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    endpoint = relationship("Endpoint", back_populates="agent_token")
    organization = relationship("Organization")


class SoftwareInstallation(Base):
    __tablename__ = "software_installations"
    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(512), nullable=False, index=True)
    publisher = Column(String(255))
    version = Column(String(100))
    install_date = Column(String(20))
    install_location = Column(String(512))
    install_size_mb = Column(Float)
    license_type = Column(String(50))
    is_system = Column(Boolean, default=False)
    is_64bit = Column(Boolean, default=True)
    last_used = Column(DateTime)
    usage_count = Column(Integer, default=0)
    source = Column(String(50), default="registry")
    uninstall_string = Column(String(512))
    collected_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("endpoint_id", "name", "version"),)
    endpoint = relationship("Endpoint", back_populates="software")
    organization = relationship("Organization")


class LicenseRecord(Base):
    __tablename__ = "license_records"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    vendor = Column(String(255), nullable=False)
    product = Column(String(255), nullable=False)
    edition = Column(String(100))
    version = Column(String(50))
    license_type = Column(String(50), default="per_seat")
    quantity = Column(Integer, default=1)
    cost_per_unit = Column(Float)
    currency = Column(String(10), default="BRL")
    cost_center = Column(String(100))
    purchase_date = Column(String(20))
    expiry_date = Column(String(20))
    renewal_date = Column(String(20))
    license_key = Column(Text)
    notes = Column(Text)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    assignments = relationship("LicenseAssignment", back_populates="license", cascade="all, delete-orphan")


class LicenseAssignment(Base):
    __tablename__ = "license_assignments"
    id = Column(Integer, primary_key=True, index=True)
    license_id = Column(Integer, ForeignKey("license_records.id", ondelete="CASCADE"), nullable=False)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text)
    license = relationship("LicenseRecord", back_populates="assignments")
    endpoint = relationship("Endpoint")
    user = relationship("User")


class Vulnerability(Base):
    __tablename__ = "vulnerabilities"
    id = Column(Integer, primary_key=True, index=True)
    cve_id = Column(String(30), unique=True, index=True)
    title = Column(String(512), nullable=False)
    description = Column(Text)
    cvss_score = Column(Float)
    cvss_vector = Column(String(100))
    severity = Column(String(20), default="medium")
    affected_product = Column(String(255))
    affected_vendor = Column(String(255))
    affected_versions = Column(Text)
    patch_available = Column(Boolean, default=False)
    patch_url = Column(String(512))
    reference_urls = Column(Text)
    published_at = Column(DateTime)
    last_modified = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    endpoint_vulns = relationship("EndpointVulnerability", back_populates="vulnerability", cascade="all, delete-orphan")


class EndpointVulnerability(Base):
    __tablename__ = "endpoint_vulnerabilities"
    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id", ondelete="CASCADE"), nullable=False)
    vulnerability_id = Column(Integer, ForeignKey("vulnerabilities.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="open")
    detected_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)
    notes = Column(Text)
    __table_args__ = (UniqueConstraint("endpoint_id", "vulnerability_id"),)
    endpoint = relationship("Endpoint", back_populates="vulnerabilities")
    vulnerability = relationship("Vulnerability", back_populates="endpoint_vulns")
    organization = relationship("Organization")


class CompliancePolicy(Base):
    __tablename__ = "compliance_policies"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    framework = Column(String(50), default="custom")
    platform = Column(String(20), default="all")
    is_enabled = Column(Boolean, default=True)
    rules = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    checks = relationship("ComplianceCheck", back_populates="policy", cascade="all, delete-orphan")


class ComplianceCheck(Base):
    __tablename__ = "compliance_checks"
    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id", ondelete="CASCADE"), nullable=False)
    policy_id = Column(Integer, ForeignKey("compliance_policies.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    rule_name = Column(String(255), nullable=False)
    status = Column(String(20), default="unknown")
    value_found = Column(String(255))
    value_expected = Column(String(255))
    details = Column(Text)
    checked_at = Column(DateTime, default=datetime.utcnow)
    endpoint = relationship("Endpoint", back_populates="compliance_checks")
    policy = relationship("CompliancePolicy", back_populates="checks")
    organization = relationship("Organization")


class RemoteAction(Base):
    __tablename__ = "remote_actions"
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), default=generate_uuid, unique=True, index=True)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(String(50), nullable=False)
    shell = Column(String(20), default="auto")
    command = Column(Text, nullable=False)
    args = Column(Text)
    timeout_seconds = Column(Integer, default=60)
    status = Column(String(20), default="pending")
    output = Column(Text)
    exit_code = Column(Integer)
    error_message = Column(Text)
    queued_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    endpoint = relationship("Endpoint", back_populates="remote_actions")
    creator = relationship("User")
    organization = relationship("Organization")


class Patch(Base):
    __tablename__ = "patches"
    id = Column(Integer, primary_key=True, index=True)
    patch_id = Column(String(100), unique=True, index=True)
    title = Column(String(512), nullable=False)
    description = Column(Text)
    platform = Column(String(20), default="windows")
    category = Column(String(50))
    severity = Column(String(20), default="moderate")
    kb_article = Column(String(50))
    bulletin_id = Column(String(50))
    product = Column(String(255))
    size_mb = Column(Float)
    requires_reboot = Column(Boolean, default=False)
    release_date = Column(String(20))
    download_url = Column(String(512))
    created_at = Column(DateTime, default=datetime.utcnow)
    endpoint_patches = relationship("EndpointPatch", back_populates="patch", cascade="all, delete-orphan")


class EndpointPatch(Base):
    __tablename__ = "endpoint_patches"
    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id", ondelete="CASCADE"), nullable=False)
    patch_id = Column(Integer, ForeignKey("patches.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending")
    installed_at = Column(DateTime)
    failed_at = Column(DateTime)
    error_message = Column(Text)
    detected_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("endpoint_id", "patch_id"),)
    endpoint = relationship("Endpoint", back_populates="ep_patches")
    patch = relationship("Patch", back_populates="endpoint_patches")
    organization = relationship("Organization")


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), default=generate_uuid, unique=True, index=True)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    job_type = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    parameters = Column(Text)
    status = Column(String(20), default="pending")
    output = Column(Text)
    error_message = Column(Text)
    exit_code = Column(Integer)
    progress = Column(Integer, default=0)
    scheduled_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    endpoint = relationship("Endpoint", back_populates="jobs")
    creator = relationship("User")
    organization = relationship("Organization")


class Policy(Base):
    __tablename__ = "policies"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    platform = Column(String(20), default="all")
    category = Column(String(50), default="security")
    is_enabled = Column(Boolean, default=True)
    rules = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    checks = relationship("PolicyCheck", back_populates="policy", cascade="all, delete-orphan")


class PolicyCheck(Base):
    __tablename__ = "policy_checks"
    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id", ondelete="CASCADE"), nullable=False)
    policy_id = Column(Integer, ForeignKey("policies.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    rule_name = Column(String(255), nullable=False)
    status = Column(String(20), default="unknown")
    details = Column(Text)
    checked_at = Column(DateTime, default=datetime.utcnow)
    endpoint = relationship("Endpoint", back_populates="policy_checks")
    policy = relationship("Policy", back_populates="checks")
    organization = relationship("Organization")


# ── Phase 5: ITSM Enterprise ──────────────────────────────────────────────────

class SlaPolicy(Base):
    __tablename__ = "sla_policies"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    priority = Column(String(20), nullable=False)
    response_hours = Column(Float, nullable=False, default=4.0)
    resolution_hours = Column(Float, nullable=False, default=24.0)
    business_hours_only = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")


class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), default=generate_uuid, unique=True, index=True)
    number = Column(String(20), unique=True, nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    ticket_type = Column(String(30), nullable=False, default="incident")
    title = Column(String(512), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    subcategory = Column(String(100))
    priority = Column(String(20), default="medium")
    impact = Column(String(20), default="medium")
    urgency = Column(String(20), default="medium")
    status = Column(String(30), default="open")
    source = Column(String(30), default="manual")
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sla_policy_id = Column(Integer, ForeignKey("sla_policies.id", ondelete="SET NULL"), nullable=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id", ondelete="SET NULL"), nullable=True)
    monitoring_event_id = Column(Integer, ForeignKey("monitoring_events.id", ondelete="SET NULL"), nullable=True)
    parent_ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True)
    resolution = Column(Text)
    resolution_code = Column(String(50))
    sla_breached = Column(Boolean, default=False)
    response_due_at = Column(DateTime)
    resolution_due_at = Column(DateTime)
    responded_at = Column(DateTime)
    resolved_at = Column(DateTime)
    closed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    assignee = relationship("User", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])
    requester = relationship("User", foreign_keys=[requester_id])
    sla_policy = relationship("SlaPolicy")
    asset = relationship("Asset")
    endpoint = relationship("Endpoint")
    monitoring_event = relationship("MonitoringEvent")
    comments = relationship("TicketComment", back_populates="ticket", cascade="all, delete-orphan")
    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan")
    activities = relationship("TicketActivity", back_populates="ticket", cascade="all, delete-orphan")


class TicketComment(Base):
    __tablename__ = "ticket_comments"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    ticket = relationship("Ticket", back_populates="comments")
    author = relationship("User")


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512))
    file_size = Column(Integer)
    mime_type = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    ticket = relationship("Ticket", back_populates="attachments")


class TicketActivity(Base):
    __tablename__ = "ticket_activities"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    field_name = Column(String(100))
    old_value = Column(String(512))
    new_value = Column(String(512))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    ticket = relationship("Ticket", back_populates="activities")
    actor = relationship("User")


class Problem(Base):
    __tablename__ = "problems"
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), default=generate_uuid, unique=True, index=True)
    number = Column(String(20), unique=True, nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(512), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    priority = Column(String(20), default="medium")
    impact = Column(String(20), default="medium")
    status = Column(String(30), default="open")
    root_cause = Column(Text)
    workaround = Column(Text)
    solution = Column(Text)
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime)
    closed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    assignee = relationship("User", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])
    asset = relationship("Asset")
    related_tickets = relationship("ProblemTicket", back_populates="problem", cascade="all, delete-orphan")
    comments = relationship("ProblemComment", back_populates="problem", cascade="all, delete-orphan")


class ProblemTicket(Base):
    __tablename__ = "problem_tickets"
    id = Column(Integer, primary_key=True, index=True)
    problem_id = Column(Integer, ForeignKey("problems.id", ondelete="CASCADE"), nullable=False)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    __table_args__ = (UniqueConstraint("problem_id", "ticket_id"),)
    problem = relationship("Problem", back_populates="related_tickets")
    ticket = relationship("Ticket")


class ProblemComment(Base):
    __tablename__ = "problem_comments"
    id = Column(Integer, primary_key=True, index=True)
    problem_id = Column(Integer, ForeignKey("problems.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    problem = relationship("Problem", back_populates="comments")
    author = relationship("User")


class Change(Base):
    __tablename__ = "changes"
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), default=generate_uuid, unique=True, index=True)
    number = Column(String(20), unique=True, nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    change_type = Column(String(20), default="normal")
    title = Column(String(512), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    priority = Column(String(20), default="medium")
    risk = Column(String(20), default="medium")
    impact = Column(String(20), default="medium")
    status = Column(String(30), default="draft")
    justification = Column(Text)
    implementation_plan = Column(Text)
    rollback_plan = Column(Text)
    test_plan = Column(Text)
    requested_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    scheduled_start = Column(DateTime)
    scheduled_end = Column(DateTime)
    actual_start = Column(DateTime)
    actual_end = Column(DateTime)
    approved_at = Column(DateTime)
    rejected_at = Column(DateTime)
    implemented_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    requester = relationship("User", foreign_keys=[requested_by])
    assignee = relationship("User", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])
    asset = relationship("Asset")
    approvals = relationship("ChangeApproval", back_populates="change", cascade="all, delete-orphan")
    comments = relationship("ChangeComment", back_populates="change", cascade="all, delete-orphan")


class ChangeApproval(Base):
    __tablename__ = "change_approvals"
    id = Column(Integer, primary_key=True, index=True)
    change_id = Column(Integer, ForeignKey("changes.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="pending")
    order = Column(Integer, default=1)
    decision = Column(String(20))
    comments = Column(Text)
    decided_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    change = relationship("Change", back_populates="approvals")
    approver = relationship("User")


class ChangeComment(Base):
    __tablename__ = "change_comments"
    id = Column(Integer, primary_key=True, index=True)
    change_id = Column(Integer, ForeignKey("changes.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    change = relationship("Change", back_populates="comments")
    author = relationship("User")


class ServiceCatalogItem(Base):
    __tablename__ = "service_catalog_items"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    icon = Column(String(50))
    sla_hours = Column(Float, default=8.0)
    requires_approval = Column(Boolean, default=False)
    approver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    default_assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    form_fields = Column(Text)
    is_enabled = Column(Boolean, default=True)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    approver = relationship("User", foreign_keys=[approver_id])
    default_assignee = relationship("User", foreign_keys=[default_assignee_id])


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(512), nullable=False)
    content = Column(Text)
    category = Column(String(100))
    tags = Column(String(512))
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="draft")
    version = Column(Integer, default=1)
    views = Column(Integer, default=0)
    helpful_votes = Column(Integer, default=0)
    published_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    author = relationship("User", foreign_keys=[author_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])


class WorkflowTemplate(Base):
    __tablename__ = "workflow_templates"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    trigger_type = Column(String(50), nullable=False)
    trigger_config = Column(Text)
    steps = Column(Text)
    is_enabled = Column(Boolean, default=True)
    run_count = Column(Integer, default=0)
    last_run_at = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    creator = relationship("User")
    executions = relationship("WorkflowExecution", back_populates="template", cascade="all, delete-orphan")


class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("workflow_templates.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    trigger_data = Column(Text)
    status = Column(String(20), default="running")
    current_step = Column(Integer, default=0)
    steps_log = Column(Text)
    error_message = Column(Text)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    template = relationship("WorkflowTemplate", back_populates="executions")
    organization = relationship("Organization")


class AutomationRule(Base):
    __tablename__ = "automation_rules"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    trigger_type = Column(String(50), nullable=False)
    trigger_config = Column(Text)
    conditions = Column(Text)
    actions = Column(Text)
    is_enabled = Column(Boolean, default=True)
    run_count = Column(Integer, default=0)
    last_triggered_at = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization = relationship("Organization")
    creator = relationship("User")
