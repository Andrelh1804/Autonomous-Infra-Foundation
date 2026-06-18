"""
OCS Inventory NG REST API client.
Supports Basic Auth, API Token and Session auth.
Compatible with OCS NG 2.x REST API.
"""
import logging
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

OCS_DEFAULT_TIMEOUT = 30
OCS_DEFAULT_RETRIES = 3


class OcsApiError(Exception):
    def __init__(self, message: str, status_code: int = 0):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class OcsApiClient:
    def __init__(
        self,
        url: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        api_token: Optional[str] = None,
        auth_type: str = "basic",
        timeout: int = OCS_DEFAULT_TIMEOUT,
        retries: int = OCS_DEFAULT_RETRIES,
        ssl_verify: bool = True,
    ):
        self.base_url = url.rstrip("/")
        self.username = username
        self.password = password
        self.api_token = api_token
        self.auth_type = auth_type
        self.timeout = timeout
        self.retries = retries
        self.ssl_verify = ssl_verify
        self._session_token: Optional[str] = None

    def _build_headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self.auth_type == "token" and self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"
        elif self.auth_type == "apikey" and self.api_token:
            headers["X-Api-Key"] = self.api_token
        elif self.auth_type == "session" and self._session_token:
            headers["Authorization"] = f"Bearer {self._session_token}"
        return headers

    def _build_auth(self):
        if self.auth_type == "basic" and self.username and self.password:
            return (self.username, self.password)
        return None

    def _request(self, method: str, path: str, **kwargs) -> Any:
        url = f"{self.base_url}{path}"
        last_exc: Exception = Exception("No attempt made")
        for attempt in range(self.retries):
            try:
                resp = httpx.request(
                    method,
                    url,
                    headers=self._build_headers(),
                    auth=self._build_auth(),
                    timeout=self.timeout,
                    verify=self.ssl_verify,
                    **kwargs,
                )
                if resp.status_code == 401:
                    raise OcsApiError("Authentication failed (401)", 401)
                if resp.status_code == 403:
                    raise OcsApiError("Access denied (403)", 403)
                if resp.status_code >= 500:
                    raise OcsApiError(f"OCS server error ({resp.status_code})", resp.status_code)
                if resp.status_code >= 400:
                    raise OcsApiError(f"Client error ({resp.status_code}): {resp.text[:200]}", resp.status_code)
                try:
                    return resp.json()
                except Exception:
                    return resp.text
            except OcsApiError:
                raise
            except Exception as exc:
                last_exc = exc
                logger.warning("OCS request attempt %d/%d failed: %s", attempt + 1, self.retries, exc)
        raise OcsApiError(f"OCS request failed after {self.retries} attempts: {last_exc}")

    def test_connection(self) -> Dict[str, Any]:
        """
        Ping the OCS server. Tries /api/v1/config/apikey and falls back to /ocsreports/.
        Returns a dict with success bool and server info.
        """
        for path in ["/api/v1/config/apikey", "/ocsreports/", "/"]:
            try:
                resp = httpx.request(
                    "GET",
                    f"{self.base_url}{path}",
                    headers=self._build_headers(),
                    auth=self._build_auth(),
                    timeout=self.timeout,
                    verify=self.ssl_verify,
                    follow_redirects=True,
                )
                if resp.status_code < 500:
                    version = resp.headers.get("X-Ocs-Version", "unknown")
                    return {
                        "success": True,
                        "status_code": resp.status_code,
                        "ocs_version": version,
                    }
            except Exception as exc:
                logger.debug("Test connection path %s failed: %s", path, exc)
        raise OcsApiError(f"Cannot reach OCS server at {self.base_url}")

    def get_computers(self, offset: int = 0, limit: int = 100) -> List[Dict]:
        try:
            data = self._request("GET", f"/api/v1/computers?start={offset}&limit={limit}")
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return data.get("computers", data.get("data", []))
            return []
        except OcsApiError:
            raise
        except Exception as exc:
            raise OcsApiError(f"Failed to fetch computers: {exc}")

    def get_computer(self, hardware_id: str) -> Dict:
        try:
            return self._request("GET", f"/api/v1/computers/{hardware_id}")
        except OcsApiError:
            raise
        except Exception as exc:
            raise OcsApiError(f"Failed to fetch computer {hardware_id}: {exc}")

    def get_computer_count(self) -> int:
        try:
            data = self._request("GET", "/api/v1/computers?limit=1")
            if isinstance(data, dict):
                return data.get("total", data.get("count", 0))
            return 0
        except Exception:
            return 0

    def get_software_for_computer(self, hardware_id: str) -> List[Dict]:
        try:
            data = self._request("GET", f"/api/v1/computers/{hardware_id}/softwares")
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return data.get("softwares", data.get("data", []))
            return []
        except Exception as exc:
            logger.warning("Could not get software for %s: %s", hardware_id, exc)
            return []

    def get_users_for_computer(self, hardware_id: str) -> List[Dict]:
        try:
            data = self._request("GET", f"/api/v1/computers/{hardware_id}/users")
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return data.get("users", data.get("data", []))
            return []
        except Exception as exc:
            logger.warning("Could not get users for %s: %s", hardware_id, exc)
            return []

    def get_networks_for_computer(self, hardware_id: str) -> List[Dict]:
        try:
            data = self._request("GET", f"/api/v1/computers/{hardware_id}/networks")
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return data.get("networks", data.get("data", []))
            return []
        except Exception as exc:
            logger.warning("Could not get networks for %s: %s", hardware_id, exc)
            return []

    def get_computers_updated_since(self, since_timestamp: str, offset: int = 0, limit: int = 100) -> List[Dict]:
        try:
            data = self._request(
                "GET",
                f"/api/v1/computers?start={offset}&limit={limit}&filter[lastdate]={since_timestamp}",
            )
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return data.get("computers", data.get("data", []))
            return []
        except Exception as exc:
            logger.warning("Incremental fetch failed, falling back to full: %s", exc)
            return self.get_computers(offset=offset, limit=limit)
