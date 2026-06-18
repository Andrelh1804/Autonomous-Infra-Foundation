"""
Discovery Engine — orchestrates network scans and CMDB updates.
"""
import asyncio
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from backend.modules.network_scan.scanner import scan_network, expand_target
from backend.modules.asset_classification.classifier import classify_asset
from backend.core.domain.models import (
    Asset, AssetType, Manufacturer, AssetModel, DiscoveryJob,
    DiscoveryResult, AssetHistory,
)
from backend.core.application.audit import log_action


def get_or_create_asset_type(db: Session, type_name: str) -> AssetType:
    at = db.query(AssetType).filter(AssetType.slug == type_name).first()
    if not at:
        at = AssetType(
            name=type_name.replace("_", " ").title(),
            slug=type_name,
        )
        db.add(at)
        db.flush()
    return at


def get_or_create_manufacturer(db: Session, name: str) -> Manufacturer:
    m = db.query(Manufacturer).filter(Manufacturer.name == name).first()
    if not m:
        m = Manufacturer(name=name)
        db.add(m)
        db.flush()
    return m


def upsert_asset(
    db: Session,
    organization_id: int,
    site_id: Optional[int],
    scan_result: Dict[str, Any],
    asset_type_id: int,
    manufacturer_id: Optional[int],
    discovery_job_id: int,
) -> Asset:
    ip = scan_result["ip_address"]
    existing = db.query(Asset).filter(
        Asset.organization_id == organization_id,
        Asset.ip_address == ip,
    ).first()

    data = {
        "organization_id": organization_id,
        "site_id": site_id,
        "asset_type_id": asset_type_id,
        "manufacturer_id": manufacturer_id,
        "hostname": scan_result.get("hostname"),
        "ip_address": ip,
        "mac_address": scan_result.get("mac_address"),
        "operating_system": scan_result.get("operating_system"),
        "status": "active",
        "last_seen": datetime.utcnow(),
        "discovery_job_id": discovery_job_id,
        "raw_data": json.dumps(scan_result),
    }

    if existing:
        changes = {}
        for field in ["hostname", "mac_address", "operating_system", "ip_address"]:
            old_val = getattr(existing, field)
            new_val = data.get(field)
            if old_val != new_val and new_val is not None:
                changes[field] = {"before": old_val, "after": new_val}

        if changes:
            history = AssetHistory(
                asset_id=existing.id,
                changed_by=None,
                change_source="discovery",
                changes=json.dumps(changes),
            )
            db.add(history)

        for k, v in data.items():
            if v is not None:
                setattr(existing, k, v)
        existing.updated_at = datetime.utcnow()
        return existing
    else:
        asset = Asset(**data)
        db.add(asset)
        db.flush()
        return asset


async def run_discovery(
    db: Session,
    job_id: int,
    targets: List[str],
    organization_id: int,
    site_id: Optional[int],
    concurrency: int = 100,
):
    job = db.query(DiscoveryJob).filter(DiscoveryJob.id == job_id).first()
    if not job:
        return

    job.status = "running"
    job.started_at = datetime.utcnow()
    db.commit()

    try:
        scan_results = await scan_network(targets, concurrency=concurrency)

        found = 0
        for result in scan_results:
            asset_type_name, manufacturer_name = classify_asset(result)
            at = get_or_create_asset_type(db, asset_type_name)
            mfr = get_or_create_manufacturer(db, manufacturer_name) if manufacturer_name else None

            asset = upsert_asset(
                db,
                organization_id=organization_id,
                site_id=site_id,
                scan_result=result,
                asset_type_id=at.id,
                manufacturer_id=mfr.id if mfr else None,
                discovery_job_id=job_id,
            )
            db.flush()

            dr = DiscoveryResult(
                discovery_job_id=job_id,
                asset_id=asset.id,
                ip_address=result["ip_address"],
                hostname=result.get("hostname"),
                status="found",
                raw_data=json.dumps(result),
            )
            db.add(dr)
            found += 1

        job.status = "completed"
        job.finished_at = datetime.utcnow()
        job.hosts_found = found
        job.hosts_scanned = sum(len(expand_target(t)) for t in targets)
        db.commit()

        # Fire alerts
        try:
            from backend.modules.alerts.sender import fire_alerts
            fire_alerts(db, job.id, "job_completed")
            if found > 0:
                fire_alerts(db, job.id, "new_assets_found")
        except Exception as ae:
            import logging
            logging.getLogger("aii.engine").warning(f"Alert dispatch error: {ae}")

    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        job.finished_at = datetime.utcnow()
        db.commit()

        try:
            from backend.modules.alerts.sender import fire_alerts
            fire_alerts(db, job.id, "job_failed")
        except Exception as ae:
            import logging
            logging.getLogger("aii.engine").warning(f"Alert dispatch error: {ae}")
        raise
