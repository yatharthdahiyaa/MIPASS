"""
RBAC & Authentication Routes.

Endpoints for inspecting current user credentials, dynamic role switching,
administering user roles, viewing the RBAC permission matrix, and querying
HIPAA/security audit logs.
"""

import structlog
from flask import Blueprint, g, request

from app.middleware.auth_middleware import (
    get_authenticated_user,
    require_auth,
    require_permission,
    require_role,
)
from app.services.rbac import (
    ROLE_METADATA,
    ROLE_PERMISSIONS,
    Permission,
    Role,
    get_rbac_service,
)
from app.utils.response import api_error, api_response

logger = structlog.get_logger()
rbac_bp = Blueprint("rbac", __name__)


@rbac_bp.route("/auth/me", methods=["GET"])
@require_auth
def get_current_user():
    """Retrieve current authenticated user profile, active role, and granted permissions."""
    user = g.current_user
    return api_response({
        "user": user.to_dict(),
        "roles_available": [r.value for r in Role],
    })


@rbac_bp.route("/auth/switch-role", methods=["POST"])
def switch_active_role():
    """Switch active user persona or role for testing and demo purposes.

    Request Body:
        {
            "role": "radiologist"   // or "admin", "technician", "researcher", "auditor"
            // OR
            "user_id": "rad-01"
        }

    Returns:
        Updated user profile with newly active role and permissions.
    """
    data = request.get_json() or {}
    rbac_service = get_rbac_service()

    target_role_str = data.get("role")
    target_user_id = data.get("user_id")

    # If user_id is provided, switch to that pre-seeded persona
    if target_user_id:
        user = rbac_service.get_user(target_user_id)
        if not user:
            return api_error(f"User '{target_user_id}' not found", 404)
        return api_response({
            "message": f"Switched to user {user.name} ({user.role.value})",
            "user": user.to_dict(),
        })

    if not target_role_str:
        return api_error("Must specify 'role' or 'user_id'", 400)

    try:
        new_role = Role(target_role_str.lower())
    except ValueError:
        valid_roles = [r.value for r in Role]
        return api_error(f"Invalid role '{target_role_str}'. Valid roles: {valid_roles}", 400)

    # Determine user to update
    user = get_authenticated_user()
    if not user:
        # Default to switching on the persona matching the role or tech-01
        persona_id = f"{new_role.value[:4]}-01"
        user = rbac_service.get_user(persona_id) or rbac_service.get_or_create_user(
            user_id="default-user",
            role=new_role,
        )

    updated_user = rbac_service.update_user_role(user.id, new_role)
    return api_response({
        "message": f"Role successfully switched to {new_role.value}",
        "user": updated_user.to_dict(),
    })


@rbac_bp.route("/rbac/roles", methods=["GET"])
def get_roles_matrix():
    """Retrieve the system-wide RBAC role matrix with permissions and metadata."""
    matrix = {}
    for role in Role:
        perms = sorted([p.value for p in ROLE_PERMISSIONS.get(role, set())])
        meta = ROLE_METADATA.get(role, {})
        matrix[role.value] = {
            "title": meta.get("title", role.value),
            "description": meta.get("description", ""),
            "badge_color": meta.get("badge_color", "#7B8FA0"),
            "badge_bg": meta.get("badge_bg", "rgba(255,255,255,0.1)"),
            "icon": meta.get("icon", "Shield"),
            "permissions_count": len(perms),
            "permissions": perms,
        }

    all_permissions = sorted([p.value for p in Permission])

    return api_response({
        "roles": matrix,
        "all_permissions": all_permissions,
    })


@rbac_bp.route("/rbac/users", methods=["GET"])
@require_permission(Permission.USERS_MANAGE)
def list_users():
    """List all registered users and their role assignments (Admin only)."""
    rbac_service = get_rbac_service()
    users = rbac_service.list_users()
    return api_response({
        "users": [u.to_dict() for u in users],
        "count": len(users),
    })


@rbac_bp.route("/rbac/users/<user_id>/role", methods=["PUT"])
@require_permission(Permission.USERS_MANAGE)
def update_user_role(user_id: str):
    """Update a user's assigned role (Admin only).

    Request Body:
        {
            "role": "radiologist"
        }
    """
    data = request.get_json()
    if not data or "role" not in data:
        return api_error("Missing 'role' in request body", 400)

    try:
        new_role = Role(data["role"].lower())
    except ValueError:
        return api_error(f"Invalid role. Valid options: {[r.value for r in Role]}", 400)

    rbac_service = get_rbac_service()
    updated = rbac_service.update_user_role(user_id, new_role, actor=g.current_user)
    if not updated:
        return api_error(f"User '{user_id}' not found", 404)

    return api_response({
        "message": f"User {user_id} updated to role {new_role.value}",
        "user": updated.to_dict(),
    })


@rbac_bp.route("/rbac/audit-logs", methods=["GET"])
@require_permission(Permission.AUDIT_READ)
def get_audit_logs():
    """Query recent security and permission audit logs (Admin & Auditor only)."""
    limit = min(int(request.args.get("limit", 50)), 200)
    rbac_service = get_rbac_service()
    logs = rbac_service.get_audit_logs(limit=limit)
    return api_response({
        "audit_logs": logs,
        "count": len(logs),
    })
