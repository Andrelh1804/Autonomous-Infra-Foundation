"""
Maps OCS Inventory hardware records to OcsAsset and (optionally) Asset CMDB records.
"""
import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from backend.core.domain.models import Asset, AssetType, Manufacturer
from backend.modules.integrations.ocs_inventory.models import OcsAsset, OcsChangeLog

logger = logging.getLogger(__name__)


def _safe(d: dict, *keys, default=None):
    for k in keys:
        if isinstance(d, dict):
            d = d.get(k, default)
        else:
            return default
    return d if d is not None else default


def parse_hardware(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise a raw OCS computer record into a flat dict."""
    hw = raw.get("hardware", raw) if isinstance(raw, dict) else {}
    return {
        "ocs_hardware_id": str(_safe(hw, "id", default=_safe(hw, "ID", default=""))),
        "hostname": _safe(hw, "name", "NAME"),
        "fqdn": _safe(hw, "fqdn", "FQDN"),
        "ip_address": _safe(hw, "ipaddr", "IPADDR"),
        "mac_address": _safe(hw, "macaddr", "MACADDR"),
        "serial_number": _safe(hw, "serialnumber", "SERIALNUMBER"),
        "ocs_uuid": _safe(hw, "uuid", "UUID"),
        "manufacturer": _safe(hw, "manufacturer", "MANUFACTURER"),
        "model": _safe(hw, "description", "DESCRIPTION"),
        "device_type": _safe(hw, "type", "TYPE"),
        "os_name": _safe(hw, "osname", "OSNAME"),
        "os_version": _safe(hw, "osversion", "OSVERSION"),
        "os_arch": _safe(hw, "arch", "ARCH"),
        "cpu_model": _safe(hw, "processort", "PROCESSORT"),
        "cpu_cores": _int(_safe(hw, "processors", "PROCESSORS")),
        "ram_mb": _int(_safe(hw, "memory", "MEMORY")),
        "disk_total_mb": _int(_safe(hw, "swap", "SWAP")),
        "bios_version": _safe(hw, "biosversion", "BIOSVERSION"),
        "bios_date": _safe(hw, "bdate", "BDATE"),
        "domain": _safe(hw, "workgroup", "WORKGROUP"),
        "last_inventoried_at": _parse_dt(_safe(hw, "lastdate", "LASTDATE")),
    }


def _int(v) -> Optional[int]:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _parse_dt(v) -> Optional[datetime]:
    if not v:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(v), fmt)
        except ValueError:
            continue
    return None


def upsert_ocs_asset(
    db: Session,
    integration_id: int,
    organization_id: int,
    parsed: Dict[str, Any],
    raw: Dict[str, Any],
) -> OcsAsset:
    hw_id = parsed["ocs_hardware_id"]
    existing = (
        db.query(OcsAsset)
        .filter_by(integration_id=integration_id, ocs_hardware_id=hw_id)
        .first()
    )

    if existing:
        changed_fields = []
        for field, value in parsed.items():
            if field == "ocs_hardware_id":
                continue
            old = getattr(existing, field, None)
            if old != value and value is not None:
                changed_fields.append((field, old, value))
                setattr(existing, field, value)

        existing.raw_data = json.dumps(raw)
        existing.updated_at = datetime.utcnow()
        existing.sync_status = "synced"

        for field, old_val, new_val in changed_fields:
            log = OcsChangeLog(
                organization_id=organization_id,
                integration_id=integration_id,
                ocs_asset_id=existing.id,
                ocs_hardware_id=hw_id,
                change_type="hardware_change",
                field_name=field,
                old_value=str(old_val),
                new_value=str(new_val),
            )
            db.add(log)

        return existing, len(changed_fields) > 0

    ocs_asset = OcsAsset(
        organization_id=organization_id,
        integration_id=integration_id,
        raw_data=json.dumps(raw),
        **parsed,
    )
    db.add(ocs_asset)
    db.flush()
    return ocs_asset, False


def correlate_with_cmdb(
    db: Session,
    ocs_asset: OcsAsset,
    organization_id: int,
) -> Optional[Asset]:
    """Try to find an existing CMDB Asset matching this OCS record."""
    if ocs_asset.asset_id:
        return db.query(Asset).filter_by(id=ocs_asset.asset_id).first()

    asset: Optional[Asset] = None

    # Priority: serial → mac → hostname+ip
    if ocs_asset.serial_number:
        asset = (
            db.query(Asset)
            .filter_by(organization_id=organization_id, serial_number=ocs_asset.serial_number)
            .first()
        )

    if not asset and ocs_asset.mac_address:
        asset = (
            db.query(Asset)
            .filter_by(organization_id=organization_id, mac_address=ocs_asset.mac_address)
            .first()
        )

    if not asset and ocs_asset.hostname:
        asset = (
            db.query(Asset)
            .filter_by(organization_id=organization_id, hostname=ocs_asset.hostname)
            .first()
        )

    if asset:
        ocs_asset.asset_id = asset.id
        _enrich_cmdb_asset(db, asset, ocs_asset)

    return asset


def _enrich_cmdb_asset(db: Session, asset: Asset, ocs: OcsAsset):
    """Backfill empty CMDB fields from OCS data."""
    if not asset.serial_number and ocs.serial_number:
        asset.serial_number = ocs.serial_number
    if not asset.mac_address and ocs.mac_address:
        asset.mac_address = ocs.mac_address
    if not asset.operating_system and ocs.os_name:
        asset.operating_system = ocs.os_name
    if not asset.os_version and ocs.os_version:
        asset.os_version = ocs.os_version
    if not asset.hostname and ocs.hostname:
        asset.hostname = ocs.hostname
    asset.last_seen = ocs.last_inventoried_at or datetime.utcnow()
