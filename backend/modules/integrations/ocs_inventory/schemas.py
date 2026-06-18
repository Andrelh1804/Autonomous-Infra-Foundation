from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class OcsIntegrationCreate(BaseModel):
    name: str
    url: str
    username: Optional[str] = None
    password: Optional[str] = None
    api_token: Optional[str] = None
    auth_type: str = "basic"
    timeout_seconds: int = 30
    retry_count: int = 3
    sync_interval_minutes: int = 60
    ssl_verify: bool = True


class OcsIntegrationUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    api_token: Optional[str] = None
    auth_type: Optional[str] = None
    timeout_seconds: Optional[int] = None
    retry_count: Optional[int] = None
    sync_interval_minutes: Optional[int] = None
    ssl_verify: Optional[bool] = None
    is_enabled: Optional[bool] = None


class OcsIntegrationResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    url: str
    username: Optional[str]
    auth_type: str
    timeout_seconds: int
    retry_count: int
    sync_interval_minutes: int
    ssl_verify: bool
    status: str
    is_enabled: bool
    is_paused: bool
    last_test_at: Optional[datetime]
    last_test_error: Optional[str]
    last_sync_at: Optional[datetime]
    next_sync_at: Optional[datetime]
    total_assets: int
    total_software: int
    total_users: int
    total_networks: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class OcsSyncJobResponse(BaseModel):
    id: int
    integration_id: int
    sync_type: str
    status: str
    assets_found: int
    assets_created: int
    assets_updated: int
    assets_removed: int
    software_imported: int
    users_imported: int
    networks_imported: int
    changes_detected: int
    error_message: Optional[str]
    started_at: datetime
    finished_at: Optional[datetime]
    duration_seconds: Optional[float]

    class Config:
        from_attributes = True


class OcsSyncLogResponse(BaseModel):
    id: int
    integration_id: int
    job_id: Optional[int]
    level: str
    category: str
    message: str
    details: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class OcsAssetResponse(BaseModel):
    id: int
    integration_id: int
    asset_id: Optional[int]
    ocs_hardware_id: str
    hostname: Optional[str]
    fqdn: Optional[str]
    ip_address: Optional[str]
    mac_address: Optional[str]
    serial_number: Optional[str]
    manufacturer: Optional[str]
    model: Optional[str]
    device_type: Optional[str]
    os_name: Optional[str]
    os_version: Optional[str]
    os_arch: Optional[str]
    cpu_model: Optional[str]
    cpu_cores: Optional[int]
    ram_mb: Optional[int]
    disk_total_mb: Optional[int]
    domain: Optional[str]
    last_inventoried_at: Optional[datetime]
    sync_status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class OcsSoftwareResponse(BaseModel):
    id: int
    ocs_asset_id: int
    ocs_hardware_id: Optional[str]
    name: str
    version: Optional[str]
    vendor: Optional[str]
    publisher: Optional[str]
    install_date: Optional[str]
    install_dir: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class OcsUserResponse(BaseModel):
    id: int
    ocs_asset_id: int
    ocs_hardware_id: Optional[str]
    username: Optional[str]
    domain: Optional[str]
    is_last_logged: bool
    created_at: datetime

    class Config:
        from_attributes = True


class OcsNetworkResponse(BaseModel):
    id: int
    ocs_asset_id: int
    ocs_hardware_id: Optional[str]
    interface_name: Optional[str]
    ip_address: Optional[str]
    mac_address: Optional[str]
    subnet_mask: Optional[str]
    gateway: Optional[str]
    dns_servers: Optional[str]
    dhcp_enabled: Optional[bool]
    created_at: datetime

    class Config:
        from_attributes = True


class OcsChangeLogResponse(BaseModel):
    id: int
    integration_id: int
    ocs_asset_id: Optional[int]
    ocs_hardware_id: Optional[str]
    change_type: str
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    detected_at: datetime

    class Config:
        from_attributes = True


class OcsTestConnectionResponse(BaseModel):
    success: bool
    message: str
    ocs_version: Optional[str] = None
    computer_count: Optional[int] = None


class OcsDashboardResponse(BaseModel):
    integration: OcsIntegrationResponse
    last_job: Optional[OcsSyncJobResponse]
    stats: dict
