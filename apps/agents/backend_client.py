"""HTTP client the agents server uses to talk to the MIPAAS backend."""

import os
from typing import Any

import requests

BACKEND_URL = os.getenv("MIPAAS_BACKEND_URL", "http://127.0.0.1:8080").rstrip("/")
API_PREFIX = "/api/v1"
TIMEOUT = float(os.getenv("MIPAAS_BACKEND_TIMEOUT", "10"))


class BackendError(Exception):
    """The backend could not be reached or returned an error."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


class BackendClient:
    def __init__(self, base_url: str = BACKEND_URL, token: str | None = None):
        self.base_url = base_url
        self.session = requests.Session()
        if token:
            self.session.headers["Authorization"] = f"Bearer {token}"

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        url = f"{self.base_url}{API_PREFIX}/{path.lstrip('/')}"
        try:
            resp = self.session.request(method, url, timeout=TIMEOUT, **kwargs)
        except requests.RequestException as exc:
            raise BackendError(f"backend unreachable at {self.base_url}: {exc}") from exc
        if not resp.ok:
            raise BackendError(f"{method} {path} -> {resp.status_code}: {resp.text[:300]}", resp.status_code)
        return resp.json() if resp.content else None

    def get(self, path: str, **kwargs: Any) -> Any:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, json: Any = None, **kwargs: Any) -> Any:
        return self.request("POST", path, json=json, **kwargs)

    def health(self) -> Any:
        return self.get("/health")
