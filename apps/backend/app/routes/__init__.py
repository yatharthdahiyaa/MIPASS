"""
Routes package.

Every blueprint declares paths relative to the API root (e.g. ``/jobs``) and is
mounted exactly once, under ``API_PREFIX``, by :func:`register_routes`.
Add new blueprints to ``_BLUEPRINTS`` only.
"""

from importlib import import_module

from flask import Flask

API_PREFIX = "/api/v1"

# (module, blueprint attribute) in registration order.
_BLUEPRINTS = (
    ("app.routes.health", "health_bp"),
    ("app.routes.upload", "upload_bp"),
    ("app.routes.jobs", "jobs_bp"),
    ("app.routes.results", "results_bp"),
    ("app.routes.diseases", "diseases_bp"),
    ("app.routes.auth_rbac", "rbac_bp"),
    ("app.routes.inference", "inference_bp"),
    ("app.routes.agents_and_workflows", "workflows_bp"),
    ("app.routes.openemr", "openemr_bp"),
    ("app.routes.eka_portal", "eka_bp"),
    ("app.routes.abdm", "abdm_bp"),
    ("app.routes.database_admin", "database_bp"),
)


def register_routes(app: Flask, prefix: str = API_PREFIX) -> None:
    """Mount all API blueprints under a single versioned prefix."""
    for module_name, attr in _BLUEPRINTS:
        app.register_blueprint(getattr(import_module(module_name), attr), url_prefix=prefix)
