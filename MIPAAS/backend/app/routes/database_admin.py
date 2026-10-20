"""
Database Administration and Health Routes.

Provides observability endpoints for the central database:
- GET /api/v1/database/status
- GET /api/v1/database/stats
- POST /api/v1/database/init
"""

import structlog
from flask import Blueprint, jsonify, request

from app.database import (
    check_db_health,
    get_db_stats,
    init_db,
)
from app.utils.response import api_error, api_response

logger = structlog.get_logger()
database_bp = Blueprint("database_admin", __name__)


@database_bp.route("/database/status", methods=["GET"])
def database_status():
    """Health check for central database."""
    health = check_db_health()
    status_code = 200 if health.get("connected") else 503
    return jsonify(health), status_code


@database_bp.route("/database/stats", methods=["GET"])
def database_stats():
    """Returns row counts and schema information across all central tables."""
    try:
        stats = get_db_stats()
        return api_response(stats)
    except Exception as exc:
        logger.error("database_stats_error", error=str(exc))
        return api_error(f"Failed to retrieve database stats: {exc}", 500)


@database_bp.route("/database/init", methods=["POST"])
def database_init():
    """Initialize or recreate central database tables."""
    try:
        data = request.get_json(silent=True) or {}
        drop_first = data.get("drop_first", False)
        init_db(drop_first=drop_first)
        return api_response({"message": "Database tables initialized successfully."})
    except Exception as exc:
        logger.error("database_init_error", error=str(exc))
        return api_error(f"Failed to initialize database: {exc}", 500)
