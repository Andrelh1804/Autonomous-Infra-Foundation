"""
OCS Inventory NG — SQLAlchemy models.
These are appended to the shared Base so create_all() picks them up.
"""
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint,
)
from backend.core.domain.models import Base


class OcsIntegration(Base):
    __tablename__ = "ocs_integrations"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    url = Column(String(512), nullable=False)
    username = Column(String(255))
    password_enc = Column(Text)
    api_token_enc = Column(Text)
    auth_type = Column(String(20), default="basic")
    timeout_seconds = Column(Integer, default=30)
    retry_count = Column(Integer, default=3)
    sync_interval_minutes = Column(Integer, default=60)
    ssl_verify = Column(Boolean, default=True)
    status = Column(String(20), default="disconnected")
    is_enabled = Column(Boolean, default=True)
    is_paused = Column(Boolean, default=False)
    last_test_at = Column(DateTime, nullable=True)
    last_test_error = Column(Text, nullable=True)
    last_sync_at = Column(DateTime, nullable=True)
    next_sync_at = Column(DateTime, nullable=True)
    total_assets = Column(Integer, default=0)
    total_software = Column(Integer, default=0)
    total_users = Column(Integer, default=0)
    total_networks = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint("organization_id", "name"),)


class OcsSyncJob(Base):
    __tablename__ = "ocs_sync_jobs"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    integration_id = Column(Integer, ForeignKey("ocs_integrations.id", ondelete="CASCADE"), nullable=False)
    triggered_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sync_type = Column(String(20), nullable=False, default="full")
    status = Column(String(20), default="running")
    assets_found = Column(Integer, default=0)
    assets_created = Column(Integer, default=0)
    assets_updated = Column(Integer, default=0)
    assets_removed = Column(Integer, default=0)
    software_imported = Column(Integer, default=0)
    users_imported = Column(Integer, default=0)
    networks_imported = Column(Integer, default=0)
    changes_detected = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, nullable=True)


class OcsSyncLog(Base):
    __tablename__ = "ocs_sync_logs"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    integration_id = Column(Integer, ForeignKey("ocs_integrations.id", ondelete="CASCADE"), nullable=False)
    job_id = Column(Integer, ForeignKey("ocs_sync_jobs.id", ondelete="SET NULL"), nullable=True)
    level = Column(String(10), nullable=False, default="info")
    category = Column(String(50), default="general")
    message = Column(Text, nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class OcsAsset(Base):
    __tablename__ = "ocs_assets"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    integration_id = Column(Integer, ForeignKey("ocs_integrations.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    ocs_hardware_id = Column(String(100), nullable=False, index=True)
    hostname = Column(String(255))
    fqdn = Column(String(255))
    ip_address = Column(String(45), index=True)
    mac_address = Column(String(17))
    serial_number = Column(String(100))
    ocs_uuid = Column(String(100))
    manufacturer = Column(String(255))
    model = Column(String(255))
    device_type = Column(String(100))
    os_name = Column(String(255))
    os_version = Column(String(100))
    os_arch = Column(String(20))
    cpu_model = Column(String(255))
    cpu_cores = Column(Integer)
    ram_mb = Column(Integer)
    disk_total_mb = Column(Integer)
    bios_version = Column(String(100))
    bios_date = Column(String(100))
    domain = Column(String(255))
    last_inventoried_at = Column(DateTime, nullable=True)
    raw_data = Column(Text)
    sync_status = Column(String(20), default="synced")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint("integration_id", "ocs_hardware_id"),)


class OcsSoftware(Base):
    __tablename__ = "ocs_software"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    integration_id = Column(Integer, ForeignKey("ocs_integrations.id", ondelete="CASCADE"), nullable=False)
    ocs_asset_id = Column(Integer, ForeignKey("ocs_assets.id", ondelete="CASCADE"), nullable=False)
    ocs_hardware_id = Column(String(100), index=True)
    name = Column(String(512), nullable=False)
    version = Column(String(100))
    vendor = Column(String(255))
    publisher = Column(String(255))
    install_date = Column(String(50))
    install_dir = Column(String(512))
    guid = Column(String(255))
    raw_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class OcsUser(Base):
    __tablename__ = "ocs_users"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    integration_id = Column(Integer, ForeignKey("ocs_integrations.id", ondelete="CASCADE"), nullable=False)
    ocs_asset_id = Column(Integer, ForeignKey("ocs_assets.id", ondelete="CASCADE"), nullable=False)
    ocs_hardware_id = Column(String(100), index=True)
    username = Column(String(255))
    domain = Column(String(255))
    is_last_logged = Column(Boolean, default=False)
    raw_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class OcsNetwork(Base):
    __tablename__ = "ocs_networks"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    integration_id = Column(Integer, ForeignKey("ocs_integrations.id", ondelete="CASCADE"), nullable=False)
    ocs_asset_id = Column(Integer, ForeignKey("ocs_assets.id", ondelete="CASCADE"), nullable=False)
    ocs_hardware_id = Column(String(100), index=True)
    interface_name = Column(String(100))
    ip_address = Column(String(45))
    mac_address = Column(String(17))
    subnet_mask = Column(String(45))
    gateway = Column(String(45))
    dns_servers = Column(String(512))
    dhcp_enabled = Column(Boolean, nullable=True)
    speed_mbps = Column(Integer, nullable=True)
    raw_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class OcsChangeLog(Base):
    __tablename__ = "ocs_change_logs"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    integration_id = Column(Integer, ForeignKey("ocs_integrations.id", ondelete="CASCADE"), nullable=False)
    ocs_asset_id = Column(Integer, ForeignKey("ocs_assets.id", ondelete="SET NULL"), nullable=True)
    ocs_hardware_id = Column(String(100))
    change_type = Column(String(50), nullable=False)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
