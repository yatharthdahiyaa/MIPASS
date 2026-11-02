"""
Tests for Auth & RBAC Middleware and Decorators.
"""

import pytest
from flask import Flask, jsonify
from app.middleware.auth_middleware import require_auth, require_permission, require_role
from app.services.rbac import Permission, Role


@pytest.fixture
def auth_app():
    """Create a minimal Flask app configured with RBAC test routes."""
    app = Flask("test_auth_app")
    app.config["TESTING"] = True

    @app.route("/protected/auth")
    @require_auth
    def protected_auth():
        return jsonify({"status": "authenticated"})

    @app.route("/protected/sign-report")
    @require_permission(Permission.REPORTS_SIGN)
    def protected_sign():
        return jsonify({"status": "report_signed"})

    @app.route("/protected/admin-only")
    @require_role(Role.ADMIN)
    def protected_admin():
        return jsonify({"status": "admin_access"})

    return app


@pytest.fixture(autouse=True)
def reset_rbac():
    from app.services.rbac import reset_rbac_service
    reset_rbac_service()
    yield
    reset_rbac_service()


@pytest.fixture
def auth_client(auth_app):
    return auth_app.test_client()



def test_unauthenticated_request_returns_401(auth_client):
    """Endpoints require authentication headers."""
    resp = auth_client.get("/protected/auth")
    assert resp.status_code == 401
    assert "Authentication required" in resp.get_json()["error"]["message"]


def test_authenticated_request_via_x_user_id(auth_client):
    """Valid X-User-ID header grants access to auth-only route."""
    resp = auth_client.get("/protected/auth", headers={"X-User-ID": "tech-01"})
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "authenticated"


def test_authenticated_request_via_bearer_token(auth_client):
    """Test token header authenticates user."""
    resp = auth_client.get("/protected/auth", headers={"Authorization": "Bearer test-token-radiologist"})
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "authenticated"


def test_permission_denied_returns_403(auth_client):
    """User without the required permission receives 403 Forbidden."""
    # tech-01 does NOT have REPORTS_SIGN permission
    resp = auth_client.get("/protected/sign-report", headers={"X-User-ID": "tech-01"})
    assert resp.status_code == 403
    assert "Forbidden" in resp.get_json()["error"]["message"]
    assert "reports:sign" in resp.get_json()["error"]["message"]


def test_permission_granted_returns_200(auth_client):
    """User with the required permission receives 200 OK."""
    # rad-01 has REPORTS_SIGN permission
    resp = auth_client.get("/protected/sign-report", headers={"X-User-ID": "rad-01"})
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "report_signed"


def test_role_check_enforced(auth_client):
    """Role restriction permits Admin and blocks non-Admin."""
    # rad-01 is not Admin -> 403
    resp = auth_client.get("/protected/admin-only", headers={"X-User-ID": "rad-01"})
    assert resp.status_code == 403

    # admin-01 is Admin -> 200
    resp_admin = auth_client.get("/protected/admin-only", headers={"X-User-ID": "admin-01"})
    assert resp_admin.status_code == 200
    assert resp_admin.get_json()["status"] == "admin_access"
