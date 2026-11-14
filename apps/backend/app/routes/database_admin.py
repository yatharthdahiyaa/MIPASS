"""
Central database administration routes.

- GET  /api/v1/database/status   reachability only (no credentials or error text)
- GET  /api/v1/database/stats    table row counts (administrators)
- POST /api/v1/database/init     create missing tables (administrators)

Dropping tables is deliberately not available over HTTP. Use the CLI
(`python scripts/init_db.py --drop`) on a machine with shell access.
"""

import structlog
from flask import Blueprint, jsonify

from app.database import check_db_health, get_db_stats, init_db
from app.middleware.auth_middleware import require_permission
from app.services.rbac import Permission
from app.utils.response import api_error, api_response

logger = structlog.get_logger()
database_bp = Blueprint("database_admin", __name__)


@database_bp.route("/database/status", methods=["GET"])
def database_status():
    """Whether the central database is reachable."""
    health = check_db_health()
    connected = bool(health.get("connected"))
    return jsonify({"status": "healthy" if connected else "unhealthy", "connected": connected}), (
        200 if connected else 503
    )


@database_bp.route("/database/stats", methods=["GET"])
@require_permission(Permission.USERS_MANAGE)
def database_stats():
    """Row counts for every table in the central database."""
    try:
        return api_response(get_db_stats())
    except Exception as exc:
        logger.error("database_stats_error", error=str(exc))
        return api_error("Could not read database statistics.", 500)


@database_bp.route("/database/init", methods=["POST"])
@require_permission(Permission.USERS_MANAGE)
def database_init():
    """Create any missing tables from the models (never drops). Development only."""
    from flask import current_app

    if not (current_app.debug or current_app.testing):
        # Staging and production change the schema through migrations only.
        return api_error("The schema is managed by migrations here: run `alembic upgrade head`.", 409)
    try:
        init_db(drop_first=False)
        return api_response({"message": "Database tables are up to date."})
    except Exception as exc:
        logger.error("database_init_error", error=str(exc))
        return api_error("Could not initialise the database.", 500)
