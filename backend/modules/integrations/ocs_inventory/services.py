"""High-level service functions used by the route handlers."""
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from backend.modules.integrations.ocs_inventory.models import (
    OcsIntegration, OcsSyncJob, OcsSyncLog, OcsAsset,
    OcsSoftware, OcsUser, OcsNetwork, OcsChangeLog,
)
from backend.modules.integrations.ocs_inventory.api_client import OcsApiClient, OcsApiError
from backend.modules.integrations.ocs_inventory.auth import encrypt_secret, decrypt_secret
from backend.modules.integrations.ocs_inventory.sync_engine import run_sync


def create_integration(db: Session, organization_id: int, user_id: int, data: dict) -> OcsIntegration:
    password = data.pop("password", None)
    api_token = data.pop("api_token", None)
    integration = OcsIntegration(
        organization_id=organization_id,
        created_by=user_id,
        password_enc=encrypt_secret(password or ""),
        api_token_enc=encrypt_secret(api_token or ""),
        **data,
    )
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return integration


def update_integration(db: Session, integration: OcsIntegration, data: dict) -> OcsIntegration:
    password = data.pop("password", None)
    api_token = data.pop("api_token", None)
    if password is not None:
        integration.password_enc = encrypt_secret(password)
    if api_token is not None:
        integration.api_token_enc = encrypt_secret(api_token)
    for k, v in data.items():
        if v is not None and hasattr(integration, k):
            setattr(integration, k, v)
    integration.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(integration)
    return integration


def test_connection(db: Session, integration: OcsIntegration) -> dict:
    client = OcsApiClient(
        url=integration.url,
        username=integration.username,
        password=decrypt_secret(integration.password_enc or ""),
        api_token=decrypt_secret(integration.api_token_enc or ""),
        auth_type=integration.auth_type,
        timeout=integration.timeout_seconds,
        retries=1,
        ssl_verify=integration.ssl_verify,
    )
    try:
        result = client.test_connection()
        count = client.get_computer_count()
        integration.status = "connected"
        integration.last_test_at = datetime.utcnow()
        integration.last_test_error = None
        db.commit()
        return {
            "success": True,
            "message": "Connection successful",
            "ocs_version": result.get("ocs_version"),
            "computer_count": count,
        }
    except OcsApiError as exc:
        integration.status = "error"
        integration.last_test_at = datetime.utcnow()
        integration.last_test_error = exc.message
        db.commit()
        return {"success": False, "message": exc.message}
    except Exception as exc:
        integration.status = "error"
        integration.last_test_error = str(exc)
        db.commit()
        return {"success": False, "message": str(exc)}


def trigger_sync(
    db: Session,
    integration: OcsIntegration,
    sync_type: str = "full",
    triggered_by: Optional[int] = None,
) -> OcsSyncJob:
    return run_sync(db, integration, sync_type=sync_type, triggered_by=triggered_by)


def pause_integration(db: Session, integration: OcsIntegration) -> OcsIntegration:
    integration.is_paused = True
    integration.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(integration)
    return integration


def resume_integration(db: Session, integration: OcsIntegration) -> OcsIntegration:
    integration.is_paused = False
    integration.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(integration)
    return integration


def get_dashboard_stats(db: Session, integration: OcsIntegration) -> dict:
    last_job = (
        db.query(OcsSyncJob)
        .filter_by(integration_id=integration.id)
        .order_by(OcsSyncJob.started_at.desc())
        .first()
    )
    error_count = (
        db.query(OcsSyncLog)
        .filter_by(integration_id=integration.id, level="error")
        .count()
    )
    return {
        "status": integration.status,
        "is_paused": integration.is_paused,
        "total_assets": integration.total_assets,
        "total_software": integration.total_software,
        "total_users": integration.total_users,
        "total_networks": integration.total_networks,
        "last_sync_at": integration.last_sync_at,
        "next_sync_at": integration.next_sync_at,
        "last_job": last_job,
        "error_count": error_count,
    }
