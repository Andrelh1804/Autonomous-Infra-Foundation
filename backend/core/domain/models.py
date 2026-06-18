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
