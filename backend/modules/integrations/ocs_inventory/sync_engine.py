"""
Core sync engine — orchestrates a full or incremental OCS sync job.
Called by the scheduler or on-demand from the API.
"""
import json
import logging
import time
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from backend.modules.integrations.ocs_inventory.models import (
    OcsIntegration, OcsSyncJob, OcsSyncLog,
)
from backend.modules.integrations.ocs_inventory.api_client import OcsApiClient, OcsApiError
from backend.modules.integrations.ocs_inventory.auth import decrypt_secret
from backend.modules.integrations.ocs_inventory.asset_mapper import (
    parse_hardware, upsert_ocs_asset, correlate_with_cmdb,
)
from backend.modules.integrations.ocs_inventory.software_mapper import sync_software_for_asset
from backend.modules.integrations.ocs_inventory.user_mapper import sync_users_for_asset
from backend.modules.integrations.ocs_inventory.network_mapper import sync_networks_for_asset

logger = logging.getLogger(__name__)

PAGE_SIZE = 100


def _log(db: Session, integration_id: int, organization_id: int, job_id: Optional[int],
         level: str, category: str, message: str, details: Optional[str] = None):
    entry = OcsSyncLog(
        organization_id=organization_id,
        integration_id=integration_id,
        job_id=job_id,
        level=level,
        category=category,
        message=message,
        details=details,
    )
    db.add(entry)
    try:
        db.flush()
    except Exception:
        pass


def run_sync(
    db: Session,
    integration: OcsIntegration,
    sync_type: str = "full",
    triggered_by: Optional[int] = None,
) -> OcsSyncJob:
    """Run a sync job synchronously. Returns the completed OcsSyncJob."""
    job = OcsSyncJob(
        organization_id=integration.organization_id,
        integration_id=integration.id,
        triggered_by=triggered_by,
        sync_type=sync_type,
        status="running",
        started_at=datetime.utcnow(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    t0 = time.time()
    try:
        _do_sync(db, integration, job, sync_type)
        job.status = "completed"
    except OcsApiError as exc:
        job.status = "failed"
        job.error_message = exc.message
        integration.status = "error"
        _log(db, integration.id, integration.organization_id, job.id,
             "error", "connection", f"Sync failed: {exc.message}")
    except Exception as exc:
        job.status = "failed"
        job.error_message = str(exc)
        integration.status = "error"
        _log(db, integration.id, integration.organization_id, job.id,
             "error", "general", f"Unexpected error: {exc}")
        logger.exception("OCS sync error for integration %d", integration.id)
    finally:
        job.finished_at = datetime.utcnow()
        job.duration_seconds = round(time.time() - t0, 2)
        if job.status == "completed":
            integration.status = "connected"
            integration.last_sync_at = datetime.utcnow()
        db.commit()
        db.refresh(integration)

    return job


def _do_sync(db: Session, integration: OcsIntegration, job: OcsSyncJob, sync_type: str):
    org_id = integration.organization_id

    client = OcsApiClient(
        url=integration.url,
        username=integration.username,
        password=decrypt_secret(integration.password_enc or ""),
        api_token=decrypt_secret(integration.api_token_enc or ""),
        auth_type=integration.auth_type,
        timeout=integration.timeout_seconds,
        retries=integration.retry_count,
        ssl_verify=integration.ssl_verify,
    )

    _log(db, integration.id, org_id, job.id, "info", "connection",
         f"Starting {sync_type} sync for {integration.url}")

    offset = 0
    total_assets = 0
    assets_created = 0
    assets_updated = 0
    total_sw = 0
    total_users = 0
    total_nets = 0
    changes = 0

    while True:
        if sync_type == "incremental" and integration.last_sync_at:
            since = integration.last_sync_at.strftime("%Y-%m-%d %H:%M:%S")
            page = client.get_computers_updated_since(since, offset=offset, limit=PAGE_SIZE)
        else:
            page = client.get_computers(offset=offset, limit=PAGE_SIZE)

        if not page:
            break

        for raw in page:
            parsed = parse_hardware(raw)
            if not parsed.get("ocs_hardware_id"):
                continue

            ocs_asset, was_updated = upsert_ocs_asset(db, integration.id, org_id, parsed, raw)
            db.flush()

            correlate_with_cmdb(db, ocs_asset, org_id)

            hw_id = parsed["ocs_hardware_id"]

            sw_list = client.get_software_for_computer(hw_id)
            sw_count = sync_software_for_asset(db, ocs_asset, sw_list, org_id, integration.id)
            total_sw += sw_count

            usr_list = client.get_users_for_computer(hw_id)
            usr_count = sync_users_for_asset(db, ocs_asset, usr_list, org_id, integration.id)
            total_users += usr_count

            net_list = client.get_networks_for_computer(hw_id)
            net_count = sync_networks_for_asset(db, ocs_asset, net_list, org_id, integration.id)
            total_nets += net_count

            if was_updated:
                assets_updated += 1
                changes += 1
            else:
                assets_created += 1

            total_assets += 1

        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    job.assets_found = total_assets
    job.assets_created = assets_created
    job.assets_updated = assets_updated
    job.software_imported = total_sw
    job.users_imported = total_users
    job.networks_imported = total_nets
    job.changes_detected = changes

    integration.total_assets = total_assets
    integration.total_software = total_sw
    integration.total_users = total_users
    integration.total_networks = total_nets

    _log(db, integration.id, org_id, job.id, "info", "general",
         f"Sync complete: {total_assets} assets, {total_sw} software, {total_users} users, {changes} changes")
    db.flush()
