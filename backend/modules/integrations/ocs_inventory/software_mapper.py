"""Maps OCS software records to OcsSoftware and SoftwareInstallation."""
import json
import logging
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from backend.modules.integrations.ocs_inventory.models import OcsSoftware, OcsAsset, OcsChangeLog

logger = logging.getLogger(__name__)


def parse_software(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": raw.get("name") or raw.get("NAME") or raw.get("software") or "Unknown",
        "version": raw.get("version") or raw.get("VERSION"),
        "vendor": raw.get("publisher") or raw.get("PUBLISHER") or raw.get("vendor"),
        "publisher": raw.get("publisher") or raw.get("PUBLISHER"),
        "install_date": str(raw.get("installdate") or raw.get("INSTALLDATE") or ""),
        "install_dir": raw.get("folder") or raw.get("FOLDER"),
        "guid": raw.get("guid") or raw.get("GUID"),
    }


def sync_software_for_asset(
    db: Session,
    ocs_asset: OcsAsset,
    raw_software_list: List[Dict[str, Any]],
    organization_id: int,
    integration_id: int,
) -> int:
    existing = (
        db.query(OcsSoftware)
        .filter_by(ocs_asset_id=ocs_asset.id)
        .all()
    )
    existing_keys = {(s.name, s.version) for s in existing}
    new_keys = set()
    count = 0

    for raw in raw_software_list:
        parsed = parse_software(raw)
        name = parsed["name"]
        version = parsed.get("version")
        key = (name, version)
        new_keys.add(key)

        if key not in existing_keys:
            sw = OcsSoftware(
                organization_id=organization_id,
                integration_id=integration_id,
                ocs_asset_id=ocs_asset.id,
                ocs_hardware_id=ocs_asset.ocs_hardware_id,
                raw_data=json.dumps(raw),
                **parsed,
            )
            db.add(sw)
            count += 1

            db.add(OcsChangeLog(
                organization_id=organization_id,
                integration_id=integration_id,
                ocs_asset_id=ocs_asset.id,
                ocs_hardware_id=ocs_asset.ocs_hardware_id,
                change_type="software_added",
                field_name="software",
                new_value=f"{name} {version or ''}".strip(),
            ))

    removed = existing_keys - new_keys
    for name, version in removed:
        db.query(OcsSoftware).filter_by(
            ocs_asset_id=ocs_asset.id, name=name, version=version
        ).delete()
        db.add(OcsChangeLog(
            organization_id=organization_id,
            integration_id=integration_id,
            ocs_asset_id=ocs_asset.id,
            ocs_hardware_id=ocs_asset.ocs_hardware_id,
            change_type="software_removed",
            field_name="software",
            old_value=f"{name} {version or ''}".strip(),
        ))

    return count
