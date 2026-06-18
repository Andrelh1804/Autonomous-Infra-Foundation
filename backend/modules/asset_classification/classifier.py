"""
Asset Classifier — infers asset type and manufacturer from discovered data.
"""
from typing import Optional, Dict, Any, Tuple

MANUFACTURER_OUI = {
    "00:00:0c": "Cisco",
    "00:1a:a1": "Cisco",
    "d4:8c:b5": "MikroTik",
    "cc:2d:e0": "MikroTik",
    "90:09:d0": "Fortinet",
    "08:5b:0e": "Fortinet",
    "00:1a:8c": "Sophos",
    "24:a4:3c": "UniFi (Ubiquiti)",
    "fc:ec:da": "UniFi (Ubiquiti)",
    "00:18:0a": "Aruba",
    "ac:a3:1e": "Aruba",
    "00:e0:fc": "Huawei",
    "48:57:02": "Huawei",
    "2c:21:31": "Juniper",
    "f8:c0:01": "Dell",
    "b0:83:fe": "Dell",
    "3c:d9:2b": "HP",
    "70:10:6f": "HP",
    "f8:db:88": "Lenovo",
    "54:ee:75": "Lenovo",
    "00:11:25": "IBM",
    "00:10:6b": "IBM",
    "00:30:48": "Supermicro",
    "00:11:32": "Synology",
    "24:5e:be": "QNAP",
    "00:08:9b": "Brother",
    "00:0a:e4": "Epson",
    "00:1e:73": "Lexmark",
    "00:1e:8f": "Canon",
    "00:26:73": "HP Printing",
    "00:00:aa": "Xerox",
}

ASSET_TYPE_HINTS = {
    "server": ["server", "srv", "esxi", "hyper-v", "proxmox", "vmware", "xen"],
    "workstation": ["ws", "workstation", "desktop", "pc-", "laptop"],
    "switch": ["switch", "sw-", "core-sw", "distribution"],
    "router": ["router", "rtr", "gw", "gateway"],
    "firewall": ["fw", "firewall", "pfsense", "fortigate", "asa"],
    "access_point": ["ap-", "wap", "wireless", "wifi", "ubnt", "unifi"],
    "printer": ["printer", "prn", "prt", "mfp", "plotter"],
    "storage": ["nas", "san", "storage", "synology", "qnap"],
    "virtual_machine": ["vm-", "-vm", "virtual"],
    "cloud_resource": ["aws", "azure", "gcp", "cloud"],
}

PORT_TYPE_MAP = {
    (22,): "server",
    (3389,): "workstation",
    (161,): "network",
    (9100,): "printer",
    (5985, 5986): "server",
}


def classify_by_hostname(hostname: Optional[str]) -> Optional[str]:
    if not hostname:
        return None
    name = hostname.lower()
    for asset_type, hints in ASSET_TYPE_HINTS.items():
        for hint in hints:
            if hint in name:
                return asset_type
    return None


def classify_by_ports(open_ports: list) -> Optional[str]:
    port_set = set(open_ports)
    if 9100 in port_set:
        return "printer"
    if 161 in port_set and not (22 in port_set or 3389 in port_set):
        return "switch"
    if 22 in port_set:
        return "server"
    if 3389 in port_set:
        return "workstation"
    return None


def get_manufacturer_from_mac(mac: Optional[str]) -> Optional[str]:
    if not mac:
        return None
    normalized = mac.lower().replace("-", ":")
    prefix = ":".join(normalized.split(":")[:3])
    return MANUFACTURER_OUI.get(prefix)


def classify_asset(scan_result: Dict[str, Any]) -> Tuple[str, Optional[str]]:
    """
    Returns (asset_type, manufacturer_name).
    """
    hostname = scan_result.get("hostname")
    open_ports = scan_result.get("open_ports", [])
    mac = scan_result.get("mac_address")
    snmp_data = scan_result.get("snmp_data", {})
    ssh_data = scan_result.get("ssh_data", {})

    asset_type = classify_by_hostname(hostname)
    if not asset_type:
        asset_type = classify_by_ports(open_ports)
    if not asset_type:
        asset_type = "server"

    if snmp_data:
        sys_descr = (snmp_data.get("sys_descr") or "").lower()
        if "cisco" in sys_descr:
            asset_type = "switch"
        elif "fortinet" in sys_descr or "fortigate" in sys_descr:
            asset_type = "firewall"
        elif "mikrotik" in sys_descr:
            asset_type = "router"
        elif "printer" in sys_descr or "laserjet" in sys_descr:
            asset_type = "printer"
        elif "linux" in sys_descr or "ubuntu" in sys_descr or "centos" in sys_descr:
            asset_type = "server"
        elif "windows" in sys_descr:
            asset_type = "server"

    if ssh_data:
        os_info = (ssh_data.get("os") or "").lower()
        if "linux" in os_info or "ubuntu" in os_info:
            asset_type = "server"

    manufacturer = get_manufacturer_from_mac(mac)
    if not manufacturer and snmp_data:
        manufacturer = snmp_data.get("manufacturer")

    return asset_type, manufacturer
