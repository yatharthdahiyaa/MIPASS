"""
Request hygiene applied to every response.

* A request id (``X-Request-ID``: honoured from a trusted proxy, otherwise generated) bound to
  the structured log context so one request can be followed across services.
* Standard security headers. HSTS only outside development.
* ``TRUST_PROXY=1`` enables Werkzeug's ProxyFix so ``request.remote_addr`` and the scheme reflect
  the client behind a load balancer (and rate limits key on the real address).
"""

import os
import re
import uuid

import structlog
from flask import Flask, g, request

_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def register_security(app: Flask) -> None:
    if os.getenv("TRUST_PROXY", "0") in ("1", "true", "yes"):
        from werkzeug.middleware.proxy_fix import ProxyFix

        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)  # type: ignore[assignment]

    production = not (app.debug or app.testing)

    @app.before_request
    def _bind_request_id():
        incoming = request.headers.get("X-Request-ID", "")
        g.request_id = incoming if _REQUEST_ID_RE.match(incoming) else uuid.uuid4().hex
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=g.request_id, path=request.path)

    @app.after_request
    def _headers(response):
        response.headers.setdefault("X-Request-ID", getattr(g, "request_id", ""))
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("Cache-Control", "no-store")
        if production:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response
