"""Health check route."""

from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__)


@health_bp.route("/api/v1/health", methods=["GET"])
def health_check():
    """Health check endpoint for Cloud Run liveness/readiness probes."""
    return jsonify({
        "status": "healthy",
        "service": "mipaas-api",
        "version": "0.1.0",
    }), 200
