"""
Health and readiness.

    GET /health            liveness: always 200 while the process runs
    GET /health?deep=1     + database, installed models, mail and rate-limit backends
    GET /ready             readiness: 503 until the database answers (for load balancers)
"""

import os
from datetime import UTC, datetime

from flask import Blueprint, jsonify, request

health_bp = Blueprint("health", __name__)

VERSION = os.getenv("MIPAAS_VERSION", "0.2.0")


def _deep() -> dict:
    from app.database.session import check_db_health
    from app.services import mailer, study_analysis
    from app.services.security import get_rate_limiter

    db = check_db_health()
    return {
        "database": {"status": db.get("status"), "latency_ms": db.get("latency_ms")},
        "models": [
            {"id": a.id, "name": a.display_name, "modality": a.modality, "available": a.is_available()}
            for a in study_analysis.list_analyzers()
        ],
        "mail_backend": mailer.settings().backend,
        "rate_limiter": get_rate_limiter().backend,
    }


@health_bp.route("/health", methods=["GET"])
def health_check():
    payload = {
        "status": "healthy",
        "service": "mipaas-api",
        "version": VERSION,
        "time": datetime.now(UTC).isoformat(),
    }
    if request.args.get("deep") in ("1", "true"):
        try:
            payload.update(_deep())
            if payload["database"]["status"] != "healthy":
                payload["status"] = "degraded"
        except Exception as exc:  # the deep probe must never take liveness down
            payload["status"] = "degraded"
            payload["error"] = type(exc).__name__
    return jsonify(payload), 200


@health_bp.route("/ready", methods=["GET"])
def readiness():
    from app.database.session import check_db_health

    db = check_db_health()
    ok = bool(db.get("connected"))
    return jsonify({"ready": ok, "database": db.get("status")}), (200 if ok else 503)
