#!/usr/bin/env python3
"""
AII Agent — Autonomous Infrastructure Intelligence Agent
Cross-platform collector for Windows, Linux, macOS.
Usage:
  python aii_agent.py --server https://your-aii-server --token YOUR_TOKEN
  python aii_agent.py --enroll --server https://your-aii-server --org-token ORG_TOKEN
"""
import argparse
import hashlib
import json
import os
import platform
import socket
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system(f"{sys.executable} -m pip install requests")
    import requests

try:
    import psutil
except ImportError:
    print("Installing psutil...")
    os.system(f"{sys.executable} -m pip install psutil")
    import psutil

CONFIG_FILE = Path(os.path.expanduser("~/.aii_agent.json"))
VERSION = "1.0.0"
DEFAULT_INTERVAL = 60


def load_config():
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE) as f:
            return json.load(f)
    return {}


def save_config(config):
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    CONFIG_FILE.chmod(0o600)


def get_hostname():
    return socket.gethostname()


def get_fqdn():
    try:
        return socket.getfqdn()
    except Exception:
        return get_hostname()


def get_ip_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def get_mac_address():
    try:
        mac = uuid.getnode()
        return ":".join(("%012X" % mac)[i:i+2] for i in range(0, 12, 2))
    except Exception:
        return None


def get_platform_info():
    system = platform.system().lower()
    if system == "windows":
        return "windows"
    elif system == "darwin":
        return "macos"
    else:
        return "linux"


def get_os_info():
    system = platform.system()
    release = platform.release()
    version = platform.version()
    machine = platform.machine()
    if system == "Windows":
        import platform
        win_ver = platform.win32_ver()
        return {
            "os_name": f"Windows {win_ver[0]}",
            "os_version": win_ver[1] or release,
            "os_build": win_ver[2] or version,
            "os_arch": machine,
        }
    elif system == "Darwin":
        mac_ver = platform.mac_ver()
        return {
            "os_name": f"macOS {mac_ver[0]}",
            "os_version": mac_ver[0],
            "os_build": release,
            "os_arch": machine,
        }
    else:
        try:
            with open("/etc/os-release") as f:
                lines = dict(l.strip().split("=", 1) for l in f if "=" in l)
            name = lines.get("PRETTY_NAME", lines.get("NAME", "Linux")).strip('"')
        except Exception:
            name = f"Linux {release}"
        return {
            "os_name": name,
            "os_version": release,
            "os_build": version,
            "os_arch": machine,
        }


def get_hardware_info():
    try:
        cpu_count = psutil.cpu_count(logical=False) or psutil.cpu_count()
        ram = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        cpu_freq = psutil.cpu_freq()
        cpu_model = "Unknown CPU"
        if platform.system() == "Windows":
            try:
                import winreg
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
                cpu_model = winreg.QueryValueEx(key, "ProcessorNameString")[0].strip()
            except Exception:
                pass
        elif platform.system() == "Linux":
            try:
                with open("/proc/cpuinfo") as f:
                    for line in f:
                        if "model name" in line:
                            cpu_model = line.split(":")[1].strip()
                            break
            except Exception:
                pass
        elif platform.system() == "Darwin":
            try:
                import subprocess
                cpu_model = subprocess.check_output(["sysctl", "-n", "machdep.cpu.brand_string"]).decode().strip()
            except Exception:
                pass
        return {
            "cpu_model": cpu_model,
            "cpu_cores": cpu_count,
            "ram_gb": round(ram.total / (1024 ** 3), 2),
            "disk_total_gb": round(disk.total / (1024 ** 3), 2),
            "disk_free_gb": round(disk.free / (1024 ** 3), 2),
        }
    except Exception as e:
        return {"cpu_model": "Unknown", "cpu_cores": 1, "ram_gb": 0, "disk_total_gb": 0, "disk_free_gb": 0}


def get_logged_user():
    try:
        users = psutil.users()
        if users:
            return users[0].name
    except Exception:
        pass
    try:
        return os.environ.get("USERNAME") or os.environ.get("USER") or "unknown"
    except Exception:
        return None


def get_disk_free_gb():
    try:
        disk = psutil.disk_usage("/")
        return round(disk.free / (1024 ** 3), 2)
    except Exception:
        return None


def get_software_windows():
    software = []
    try:
        import winreg
        for hive in [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]:
            for wow64 in [winreg.KEY_READ, winreg.KEY_READ | winreg.KEY_WOW64_32KEY]:
                try:
                    key = winreg.OpenKey(hive, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", 0, wow64)
                    count = winreg.QueryInfoKey(key)[0]
                    for i in range(count):
                        try:
                            sub_key = winreg.OpenKey(key, winreg.EnumKey(key, i))
                            name = winreg.QueryValueEx(sub_key, "DisplayName")[0]
                            if not name:
                                continue
                            def _get(k):
                                try:
                                    return winreg.QueryValueEx(sub_key, k)[0]
                                except Exception:
                                    return None
                            software.append({
                                "name": name,
                                "publisher": _get("Publisher"),
                                "version": _get("DisplayVersion"),
                                "install_date": _get("InstallDate"),
                                "install_location": _get("InstallLocation"),
                                "uninstall_string": _get("UninstallString"),
                                "is_system": hive == winreg.HKEY_LOCAL_MACHINE,
                                "is_64bit": not (wow64 == winreg.KEY_READ | winreg.KEY_WOW64_32KEY),
                                "source": "registry",
                            })
                        except Exception:
                            continue
                except Exception:
                    continue
    except Exception as e:
        print(f"[WARN] Could not read Windows registry: {e}")
    return software


def get_software_linux():
    software = []
    try:
        import subprocess
        result = subprocess.run(["dpkg-query", "-W", "-f=${Package}\t${Version}\t${Architecture}\t${Installed-Size}\n"], capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n"):
                parts = line.split("\t")
                if len(parts) >= 2:
                    software.append({"name": parts[0], "version": parts[1], "is_system": True, "source": "dpkg"})
    except Exception:
        pass
    if not software:
        try:
            import subprocess
            result = subprocess.run(["rpm", "-qa", "--queryformat", "%{NAME}\t%{VERSION}-%{RELEASE}\t%{ARCH}\n"], capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                for line in result.stdout.strip().split("\n"):
                    parts = line.split("\t")
                    if len(parts) >= 2:
                        software.append({"name": parts[0], "version": parts[1], "is_system": True, "source": "rpm"})
        except Exception:
            pass
    return software


def get_software_macos():
    software = []
    try:
        import subprocess
        result = subprocess.run(["system_profiler", "SPApplicationsDataType", "-json"], capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            apps = data.get("SPApplicationsDataType", [])
            for app in apps:
                software.append({
                    "name": app.get("_name", ""),
                    "version": app.get("version", ""),
                    "publisher": app.get("obtained_from", ""),
                    "is_system": app.get("obtained_from") == "apple",
                    "source": "system_profiler",
                })
    except Exception:
        pass
    return software


def collect_software():
    sys_platform = platform.system()
    if sys_platform == "Windows":
        return get_software_windows()
    elif sys_platform == "Darwin":
        return get_software_macos()
    else:
        return get_software_linux()


def enroll(server_url, org_token, site_id=None):
    print(f"[INFO] Enrolling with server: {server_url}")
    hw = get_hardware_info()
    os_info = get_os_info()
    payload = {
        "hostname": get_hostname(),
        "fqdn": get_fqdn(),
        "ip_address": get_ip_address(),
        "mac_address": get_mac_address(),
        "platform": get_platform_info(),
        "agent_version": VERSION,
        "site_id": site_id,
        **os_info,
        **hw,
    }
    headers = {"Authorization": f"Bearer {org_token}", "Content-Type": "application/json"}
    try:
        resp = requests.post(f"{server_url}/api/v1/agents/enroll", json=payload, headers=headers, timeout=30, verify=False)
        resp.raise_for_status()
        data = resp.json()
        config = load_config()
        config.update({
            "server_url": server_url,
            "agent_token": data["agent_token"],
            "endpoint_id": data["endpoint_id"],
            "endpoint_uuid": data["endpoint_uuid"],
        })
        save_config(config)
        print(f"[OK] Enrolled successfully! Endpoint ID: {data['endpoint_id']}")
        print(f"[OK] Config saved to: {CONFIG_FILE}")
        return True
    except Exception as e:
        print(f"[ERROR] Enrollment failed: {e}")
        return False


def checkin(config):
    server_url = config["server_url"]
    token = config["agent_token"]
    payload = {
        "agent_token": token,
        "ip_address": get_ip_address(),
        "logged_user": get_logged_user(),
        "disk_free_gb": get_disk_free_gb(),
        "agent_version": VERSION,
    }
    try:
        resp = requests.post(f"{server_url}/api/v1/agents/checkin", json=payload, timeout=15, verify=False)
        resp.raise_for_status()
        data = resp.json()
        cmds = data.get("pending_commands", [])
        if cmds:
            print(f"[INFO] {len(cmds)} pending command(s)")
            for cmd in cmds:
                execute_command(config, cmd)
        return True
    except Exception as e:
        print(f"[WARN] Checkin failed: {e}")
        return False


def execute_command(config, cmd):
    import subprocess
    action_id = cmd.get("id")
    command = cmd.get("command", "")
    shell = cmd.get("shell", "auto")
    timeout = cmd.get("timeout", 60)
    print(f"[CMD] Executing action #{action_id}: {command[:80]}")
    if shell == "auto":
        shell_flag = platform.system() == "Windows"
    elif shell == "powershell" and platform.system() == "Windows":
        command = f"powershell -Command \"{command}\""
        shell_flag = True
    elif shell == "bash":
        command = f"bash -c '{command}'"
        shell_flag = True
    else:
        shell_flag = platform.system() == "Windows"
    try:
        result = subprocess.run(command, shell=shell_flag, capture_output=True, text=True, timeout=timeout)
        output = result.stdout + result.stderr
        success = result.returncode == 0
        exit_code = result.returncode
    except subprocess.TimeoutExpired:
        output = f"Command timed out after {timeout} seconds"
        success = False
        exit_code = -1
    except Exception as e:
        output = str(e)
        success = False
        exit_code = -1
    server_url = config["server_url"]
    payload = {
        "agent_token": config["agent_token"],
        "action_id": action_id,
        "output": output[:10000],
        "exit_code": exit_code,
        "success": success,
    }
    try:
        requests.post(f"{server_url}/api/v1/agents/checkin/result", json=payload, timeout=15, verify=False)
    except Exception as e:
        print(f"[WARN] Could not submit result: {e}")


def report_software(config):
    print("[INFO] Collecting software inventory...")
    software = collect_software()
    print(f"[INFO] Found {len(software)} software items")
    if not software:
        return
    server_url = config["server_url"]
    endpoint_id = config["endpoint_id"]
    payload = {"endpoint_id": endpoint_id, "agent_token": config["agent_token"], "software": software}
    try:
        resp = requests.post(f"{server_url}/api/v1/software-inventory/bulk-report", json=payload, timeout=60, verify=False)
        resp.raise_for_status()
        print(f"[OK] Software inventory reported: {len(software)} items")
    except Exception as e:
        print(f"[WARN] Software report failed: {e}")


def run_loop(config, interval):
    print(f"[INFO] AII Agent v{VERSION} starting (interval: {interval}s)")
    sw_interval = 3600
    sw_last = 0
    while True:
        checkin(config)
        now = time.time()
        if now - sw_last > sw_interval:
            report_software(config)
            sw_last = now
        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="AII Agent")
    parser.add_argument("--server", default=os.environ.get("AII_SERVER_URL", "http://localhost:8008"))
    parser.add_argument("--token", default=os.environ.get("AII_AGENT_TOKEN"))
    parser.add_argument("--org-token", default=os.environ.get("AII_ORG_TOKEN"))
    parser.add_argument("--enroll", action="store_true")
    parser.add_argument("--site-id", type=int)
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL)
    parser.add_argument("--report-software", action="store_true")
    parser.add_argument("--once", action="store_true", help="Run checkin once and exit")
    args = parser.parse_args()

    if args.enroll:
        if not args.org_token:
            print("[ERROR] --org-token required for enrollment")
            sys.exit(1)
        success = enroll(args.server, args.org_token, args.site_id)
        sys.exit(0 if success else 1)

    config = load_config()
    if args.token:
        config["agent_token"] = args.token
    if args.server:
        config["server_url"] = args.server

    if not config.get("agent_token") or not config.get("server_url"):
        print("[ERROR] Agent not enrolled. Run with --enroll first.")
        sys.exit(1)

    if args.report_software:
        report_software(config)
        return

    if args.once:
        checkin(config)
        return

    run_loop(config, args.interval)


if __name__ == "__main__":
    main()
