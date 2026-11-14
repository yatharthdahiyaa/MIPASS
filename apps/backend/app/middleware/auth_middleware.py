"""
Authentication and RBAC middleware.

The only way to be authenticated is a session issued by ``/api/v1/auth/login`` (or
``/auth/register``): either the HttpOnly ``mipaas_session`` cookie (web) or the same
token sent as ``Authorization: Bearer`` (desktop app). Sessions are checked against the
central PostgreSQL database on every request; there are no header-based identities.
"""

from collections.abc import Callable
from functools import wraps
from typing import Union

import structlog
from flask import g, request

from app.services.rbac import Permission, Role, UserProfile, get_rbac_service
from app.utils.response import api_error

logger = structlog.get_logger()


def _session_token() -> str | None:
    from app.services import accounts

    token = request.cookies.get(accounts.SESSION_COOKIE)
    if token:
        return token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip() or None
    return None


def get_authenticated_user() -> UserProfile | None:
    """The signed-in user for this request, or None. Cached on ``g`` for the request."""
    if getattr(g, "current_user", None) is not None:
        return g.current_user

    from app.database.session import get_db
    from app.services import accounts
    from app.services.rbac import profile_from_user

    token = _session_token()
    user = None
    if token:
        try:
            with get_db() as db:
                resolved = accounts.resolve_session(db, token)
                if resolved is not None:
                    user = profile_from_user(resolved[0])
        except Exception as exc:  # database unavailable: treat as signed out, never as signed in
            logger.warning("session_lookup_failed", error=str(exc))
            user = None

    g.current_user = user
    return user


def require_auth(f: Callable) -> Callable:
    """Decorator requiring a valid authenticated user."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_authenticated_user()
        if not user:
            get_rbac_service().log_audit_event(
                user=None,
                action="auth:authenticate",
                resource=request.path,
                decision="deny",
                details={"reason": "Missing or invalid session"},
                ip_address=request.remote_addr,
            )
            return api_error("Authentication required. Please sign in.", 401)
        return f(*args, **kwargs)

    return decorated_function


def require_permission(permission: Union[Permission, str]) -> Callable:
    """Decorator enforcing that the authenticated user possesses a specific permission."""
    perm_enum = Permission(permission) if isinstance(permission, str) else permission

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_authenticated_user()
            rbac_service = get_rbac_service()

            if not user:
                rbac_service.log_audit_event(
                    user=None,
                    action=f"perm:{perm_enum.value}",
                    resource=request.path,
                    decision="deny",
                    details={"reason": "Unauthenticated access attempt"},
                    ip_address=request.remote_addr,
                )
                return api_error("Authentication required", 401)

            if not rbac_service.has_permission(user, perm_enum):
                rbac_service.log_audit_event(
                    user=user,
                    action=f"perm:{perm_enum.value}",
                    resource=request.path,
                    decision="deny",
                    details={"required_permission": perm_enum.value, "user_role": user.role.value},
                    ip_address=request.remote_addr,
                )
                return api_error(
                    f"Forbidden: Your role '{user.role.value}' does not possess the required permission '{perm_enum.value}' for this action.",
                    403,
                )

            # Audit allowed sensitive operations
            if perm_enum in (
                Permission.JOBS_DELETE,
                Permission.USERS_MANAGE,
                Permission.MODELS_MANAGE,
                Permission.REPORTS_SIGN,
            ):
                rbac_service.log_audit_event(
                    user=user,
                    action=f"perm:{perm_enum.value}",
                    resource=request.path,
                    decision="allow",
                    details={"role": user.role.value},
                    ip_address=request.remote_addr,
                )

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def require_role(*roles: Union[Role, str]) -> Callable:
    """Decorator enforcing that the user has at least one of the specified roles."""
    allowed_roles = {Role(r) if isinstance(r, str) else r for r in roles}

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_authenticated_user()
            rbac_service = get_rbac_service()

            if not user:
                return api_error("Authentication required", 401)

            if user.role not in allowed_roles:
                rbac_service.log_audit_event(
                    user=user,
                    action="role_check",
                    resource=request.path,
                    decision="deny",
                    details={
                        "user_role": user.role.value,
                        "allowed_roles": [r.value for r in allowed_roles],
                    },
                    ip_address=request.remote_addr,
                )
                return api_error(
                    f"Forbidden: Action restricted to roles: {', '.join(r.value for r in allowed_roles)}. Your active role is '{user.role.value}'.",
                    403,
                )

            return f(*args, **kwargs)

        return decorated_function

    return decorator
