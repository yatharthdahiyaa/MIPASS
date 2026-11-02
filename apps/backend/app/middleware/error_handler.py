"""
Global error handler middleware for the Flask API.

Catches all exceptions and returns consistent JSON error responses.
Logs structured error information for Cloud Logging.
"""

import traceback
import structlog
from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

logger = structlog.get_logger()


def register_error_handlers(app: Flask) -> None:
    """Register global error handlers on the Flask app.

    Args:
        app: Flask application instance.
    """

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            "success": False,
            "error": {
                "code": 400,
                "type": "BAD_REQUEST",
                "message": str(error.description) if hasattr(error, "description") else str(error),
            },
        }), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({
            "success": False,
            "error": {
                "code": 401,
                "type": "UNAUTHORIZED",
                "message": "Authentication required",
            },
        }), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            "success": False,
            "error": {
                "code": 403,
                "type": "FORBIDDEN",
                "message": "Insufficient permissions",
            },
        }), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "success": False,
            "error": {
                "code": 404,
                "type": "NOT_FOUND",
                "message": str(error.description) if hasattr(error, "description") else "Resource not found",
            },
        }), 404

    @app.errorhandler(409)
    def conflict(error):
        return jsonify({
            "success": False,
            "error": {
                "code": 409,
                "type": "CONFLICT",
                "message": str(error.description) if hasattr(error, "description") else str(error),
            },
        }), 409

    @app.errorhandler(429)
    def rate_limited(error):
        return jsonify({
            "success": False,
            "error": {
                "code": 429,
                "type": "RATE_LIMITED",
                "message": "Too many requests. Please try again later.",
            },
        }), 429

    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        return jsonify({
            "success": False,
            "error": {
                "code": error.code,
                "type": error.name.upper().replace(" ", "_"),
                "message": error.description,
            },
        }), error.code

    @app.errorhandler(Exception)
    def handle_unhandled_exception(error):
        """Catch-all for unhandled exceptions — prevents stack traces from leaking."""
        tb = traceback.format_exc()
        logger.error(
            "unhandled_exception",
            error_type=type(error).__name__,
            message=str(error),
            traceback=tb,
        )

        # Don't expose internal errors in production
        if app.config.get("DEBUG"):
            message = f"{type(error).__name__}: {str(error)}"
        else:
            message = "An internal error occurred. Please try again."

        return jsonify({
            "success": False,
            "error": {
                "code": 500,
                "type": "INTERNAL_ERROR",
                "message": message,
            },
        }), 500
