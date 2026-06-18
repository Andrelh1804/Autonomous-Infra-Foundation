"""Maps OCS user records to OcsUser."""
import json
import logging
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from backend.modules.integrations.ocs_inventory.models import OcsUser, OcsAsset

logger = logging.getLogger(__name__)


def parse_user(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "username": raw.get("login") or raw.get("LOGIN") or raw.get("username"),
        "domain": raw.get("domain") or raw.get("DOMAIN"),
        "is_last_logged": bool(raw.get("last") or raw.get("LAST")),
    }


def sync_users_for_asset(
    db: Session,
    ocs_asset: OcsAsset,
    raw_user_list: List[Dict[str, Any]],
    organization_id: int,
    integration_id: int,
) -> int:
    db.query(OcsUser).filter_by(ocs_asset_id=ocs_asset.id).delete()
    count = 0
    for raw in raw_user_list:
        parsed = parse_user(raw)
        if not parsed.get("username"):
            continue
        user = OcsUser(
            organization_id=organization_id,
            integration_id=integration_id,
            ocs_asset_id=ocs_asset.id,
            ocs_hardware_id=ocs_asset.ocs_hardware_id,
            raw_data=json.dumps(raw),
            **parsed,
        )
        db.add(user)
        count += 1
    return count
