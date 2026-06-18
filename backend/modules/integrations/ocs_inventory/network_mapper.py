"""Maps OCS network interface records to OcsNetwork."""
import json
import logging
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from backend.modules.integrations.ocs_inventory.models import OcsNetwork, OcsAsset

logger = logging.getLogger(__name__)


def parse_network(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "interface_name": raw.get("description") or raw.get("DESCRIPTION"),
        "ip_address": raw.get("ipaddress") or raw.get("IPADDRESS"),
        "mac_address": raw.get("macaddr") or raw.get("MACADDR"),
        "subnet_mask": raw.get("ipmask") or raw.get("IPMASK"),
        "gateway": raw.get("ipgateway") or raw.get("IPGATEWAY"),
        "dns_servers": raw.get("dns") or raw.get("DNS"),
        "dhcp_enabled": _bool(raw.get("dhcp") or raw.get("DHCP")),
        "speed_mbps": _int(raw.get("speed") or raw.get("SPEED")),
    }


def _bool(v) -> bool | None:
    if v is None:
        return None
    return str(v).lower() in ("1", "yes", "true", "enabled")


def _int(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def sync_networks_for_asset(
    db: Session,
    ocs_asset: OcsAsset,
    raw_network_list: List[Dict[str, Any]],
    organization_id: int,
    integration_id: int,
) -> int:
    db.query(OcsNetwork).filter_by(ocs_asset_id=ocs_asset.id).delete()
    count = 0
    for raw in raw_network_list:
        parsed = parse_network(raw)
        net = OcsNetwork(
            organization_id=organization_id,
            integration_id=integration_id,
            ocs_asset_id=ocs_asset.id,
            ocs_hardware_id=ocs_asset.ocs_hardware_id,
            raw_data=json.dumps(raw),
            **parsed,
        )
        db.add(net)
        count += 1
    return count
