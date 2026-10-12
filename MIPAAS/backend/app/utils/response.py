"""
Standardized API response helpers.

All API responses follow a consistent envelope format:
{
    "success": true/false,
    "data": { ... },      // on success
    "error": { ... }      // on failure
}
"""

from flask import jsonify


def api_response(data: dict, status_code: int = 200):
    """Create a standardized success response.

    Args:
        data: Response payload.
        status_code: HTTP status code (default 200).

    Returns:
        Flask JSON response tuple.
    """
    return jsonify({
        "success": True,
        "data": data,
    }), status_code


def api_error(message: str, status_code: int = 400, error_type: str | None = None):
    """Create a standardized error response.

    Args:
        message: Error message.
        status_code: HTTP status code (default 400).
        error_type: Error type identifier (auto-generated from status code if not provided).

    Returns:
        Flask JSON response tuple.
    """
    type_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
        500: "INTERNAL_ERROR",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
    }

    return jsonify({
        "success": False,
        "error": {
            "code": status_code,
            "type": error_type or type_map.get(status_code, "ERROR"),
            "message": message,
        },
    }), status_code
