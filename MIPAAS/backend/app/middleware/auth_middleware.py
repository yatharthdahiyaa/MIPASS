"""
Authentication and RBAC Authorization Middleware.

Provides request decorators for enforcing authentication, role requirements,
granular permission checks, resource ownership checks, and audit logging.
"""

from functools import wraps
from typing import Callable, Optional, Sequence, Union

from flask import current_app, g, request
import structlog

from app.services.auth import AuthService
from app.services.rbac import (
    Permission,
    Role,
    UserProfile,
    get_rbac_service,
)
from app.utils.response import api_error

logger = structlog.get_logger()


def get_authenticated_user() -> Optional[UserProfile]:
    """Resolve the currently authenticated user from request headers.

    Supports:
    1. 'Authorization: Bearer <token>' (Google/Firebase OAuth2 token or test token)
    2. 'X-User-ID' header for local development, CLI, and integration testing
    3. 'X-User-Role' header to override role for testing/switching personas
    """
    if hasattr(g, "current_user") and g.current_user is not None:
        return g.current_user

    rbac_service = get_rbac_service(getattr(current_app, "config", {}))
    auth_service = AuthService(getattr(current_app, "config", {}))

    user_id = None
    override_role = request.headers.get("X-User-Role")

    # 1. Check Bearer Token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        # Check if it's a test token like "test-token-admin" or "test-token-rad"
        if token.startswith("test-token-"):
            role_part = token.replace("test-token-", "")
            user_id = f"{role_part}-01"
            override_role = role_part
        else:
            try:
                claims = auth_service.verify_token(token)
                if claims:
                    user_id = claims.get("sub") or claims.get("user_id")
                    if not override_role:
                        override_role = claims.get("role")
            except Exception as e:
                logger.warning("token_verification_error", error=str(e))

    # 2. Check X-User-ID header if no valid bearer token
    if not user_id:
        user_id = request.headers.get("X-User-ID")

    if not user_id:
        g.current_user = None
        return None

    # Resolve or create UserProfile
    user = rbac_service.get_user(user_id)
    if not user:
        # Determine initial role from override or default to TECHNICIAN
        role_enum = Role.TECHNICIAN
        if override_role:
            try:
                role_enum = Role(override_role.lower())
            except ValueError:
                role_enum = Role.TECHNICIAN

        user = rbac_service.get_or_create_user(
            user_id=user_id,
            role=role_enum,
        )
    elif override_role:
        # Allow testing persona role switching via header
        try:
            role_enum = Role(override_role.lower())
            if user.role != role_enum:
                user = rbac_service.update_user_role(user.id, role_enum)
        except ValueError:
            pass

    g.current_user = user
    return user


def require_auth(f: Callable) -> Callable:
    """Decorator requiring a valid authenticated user."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_authenticated_user()
        if not user:
            rbac_service = get_rbac_service()
            rbac_service.log_audit_event(
                user=None,
                action="auth:authenticate",
                resource=request.path,
                decision="deny",
                details={"reason": "Missing or invalid authentication token"},
                ip_address=request.remote_addr,
            )
            return api_error("Authentication required. Please provide a valid Authorization Bearer token or credentials.", 401)
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
                    details={
                        "required_permission": perm_enum.value,
                        "user_role": user.role.value,
                    },
                    ip_address=request.remote_addr,
                )
                return api_error(
                    f"Forbidden: Your role '{user.role.value}' does not possess the required permission '{perm_enum.value}' for this action.",
                    403,
                )

            # Audit log allow for sensitive operations
            if perm_enum in (Permission.JOBS_DELETE, Permission.USERS_MANAGE, Permission.MODELS_MANAGE, Permission.REPORTS_SIGN):
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
                    f"Forbidden: Action restricted to roles: {', '.join([r.value for r in allowed_roles])}. Your active role is '{user.role.value}'.",
                    403,
                )

            return f(*args, **kwargs)
        return decorated_function
    return decorator
