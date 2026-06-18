"""
Network Scanner — ICMP ping, DNS reverse lookup, port scan.
Runs asynchronously using asyncio for high concurrency (500+ hosts).
"""
import asyncio
import socket
import ipaddress
import subprocess
from typing import List, Optional, Dict, Any
from datetime import datetime


async def ping_host(ip: str, timeout: float = 1.0) -> bool:
    try:
        proc = await asyncio.create_subprocess_exec(
            "ping", "-c", "1", "-W", str(int(timeout * 1000)), ip,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.communicate(), timeout=timeout + 0.5)
        return proc.returncode == 0
    except Exception:
        return False


async def reverse_dns(ip: str) -> Optional[str]:
    try:
        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(None, socket.gethostbyaddr, ip),
            timeout=2.0,
        )
        return result[0]
    except Exception:
        return None


async def get_open_ports(ip: str, ports: List[int] = None, timeout: float = 0.5) -> List[int]:
    if ports is None:
        ports = [22, 23, 80, 443, 161, 3389, 5985, 8080, 8443]
    open_ports = []

    async def check_port(port: int) -> Optional[int]:
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(ip, port), timeout=timeout
            )
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            return port
        except Exception:
            return None

    tasks = [check_port(p) for p in ports]
    results = await asyncio.gather(*tasks)
    return [p for p in results if p is not None]


def expand_target(target: str) -> List[str]:
    """Expand a CIDR, IP range, or single IP to a list of IP strings."""
    target = target.strip()
    ips = []

    if "/" in target:
        network = ipaddress.ip_network(target, strict=False)
        ips = [str(h) for h in network.hosts()]
    elif "-" in target:
        parts = target.split("-")
        start_ip = ipaddress.ip_address(parts[0].strip())
        end_str = parts[1].strip()
        if "." in end_str:
            end_ip = ipaddress.ip_address(end_str)
        else:
            base = str(start_ip).rsplit(".", 1)[0]
            end_ip = ipaddress.ip_address(f"{base}.{end_str}")
        current = int(start_ip)
        end = int(end_ip)
        while current <= end:
            ips.append(str(ipaddress.ip_address(current)))
            current += 1
    else:
        ips = [target]

    return ips


async def scan_host(ip: str) -> Optional[Dict[str, Any]]:
    alive = await ping_host(ip)
    if not alive:
        return None

    hostname, open_ports = await asyncio.gather(
        reverse_dns(ip),
        get_open_ports(ip),
    )

    return {
        "ip_address": ip,
        "hostname": hostname,
        "open_ports": open_ports,
        "is_alive": True,
        "scanned_at": datetime.utcnow().isoformat(),
    }


async def scan_network(targets: List[str], concurrency: int = 100) -> List[Dict[str, Any]]:
    all_ips = []
    for t in targets:
        all_ips.extend(expand_target(t))

    all_ips = list(dict.fromkeys(all_ips))
    semaphore = asyncio.Semaphore(concurrency)

    async def bounded_scan(ip: str):
        async with semaphore:
            return await scan_host(ip)

    tasks = [bounded_scan(ip) for ip in all_ips]
    results = await asyncio.gather(*tasks)
    return [r for r in results if r is not None]
