"""
Tests for RBAC API routes.
"""

import pytest


def test_get_roles_matrix(client):
    """GET /api/v1/rbac/roles returns the complete roles/permissions matrix."""
    resp = client.get("/api/v1/rbac/roles")
    assert resp.status_code == 200
    data = resp.get_json()["data"]

    assert "roles" in data
    assert "admin" in data["roles"]
    assert "radiologist" in data["roles"]
    assert "technician" in data["roles"]
    assert "researcher" in data["roles"]
    assert "auditor" in data["roles"]

    # Check radiologist has reports:sign
    rad_perms = data["roles"]["radiologist"]["permissions"]
    assert "reports:sign" in rad_perms
    assert "xai:read" in rad_perms

    # Check all_permissions array
    assert "all_permissions" in data
    assert "reports:sign" in data["all_permissions"]


def test_get_current_user_unauthenticated(client):
    """GET /api/v1/auth/me returns 401 when no auth headers."""
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_get_current_user_authenticated(client):
    """GET /api/v1/auth/me returns user profile and permissions."""
    resp = client.get("/api/v1/auth/me", headers={"X-User-ID": "rad-01"})
    assert resp.status_code == 200
    user = resp.get_json()["data"]["user"]
    assert user["id"] == "rad-01"
    assert user["role"] == "radiologist"
    assert "reports:sign" in user["permissions"]


def test_switch_role(client):
    """POST /api/v1/auth/switch-role switches persona role."""
    resp = client.post(
        "/api/v1/auth/switch-role",
        headers={"X-User-ID": "rad-01"},
        json={"role": "admin"},
    )
    assert resp.status_code == 200
    user = resp.get_json()["data"]["user"]
    assert user["role"] == "admin"
    assert "users:manage" in user["permissions"]


def test_list_users_admin_only(client):
    """GET /api/v1/rbac/users is restricted to users:manage (Admin)."""
    # Non-admin (tech-01) should get 403
    resp_tech = client.get("/api/v1/rbac/users", headers={"X-User-ID": "tech-01"})
    assert resp_tech.status_code == 403

    # Admin (admin-01) should get 200
    resp_admin = client.get("/api/v1/rbac/users", headers={"X-User-ID": "admin-01"})
    assert resp_admin.status_code == 200
    users = resp_admin.get_json()["data"]["users"]
    assert len(users) >= 5


def test_update_user_role(client):
    """PUT /api/v1/rbac/users/<id>/role updates role (Admin only)."""
    # Technician cannot update role
    resp_denied = client.put(
        "/api/v1/rbac/users/tech-01/role",
        headers={"X-User-ID": "tech-01"},
        json={"role": "radiologist"},
    )
    assert resp_denied.status_code == 403

    # Admin can update role
    resp_allowed = client.put(
        "/api/v1/rbac/users/tech-01/role",
        headers={"X-User-ID": "admin-01"},
        json={"role": "radiologist"},
    )
    assert resp_allowed.status_code == 200
    updated = resp_allowed.get_json()["data"]["user"]
    assert updated["role"] == "radiologist"


def test_get_audit_logs(client):
    """GET /api/v1/rbac/audit-logs returns access trail (Admin & Auditor only)."""
    # Tech cannot view audit logs
    resp_tech = client.get("/api/v1/rbac/audit-logs", headers={"X-User-ID": "tech-01"})
    assert resp_tech.status_code == 403

    # Auditor can view audit logs
    resp_aud = client.get("/api/v1/rbac/audit-logs", headers={"X-User-ID": "aud-01"})
    assert resp_aud.status_code == 200
    logs = resp_aud.get_json()["data"]["audit_logs"]
    assert isinstance(logs, list)
