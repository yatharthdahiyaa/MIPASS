"""
Tests for RBAC Service and domain model.
"""

import pytest
from app.services.rbac import (
    Permission,
    Role,
    ROLE_PERMISSIONS,
    ROLE_METADATA,
    UserProfile,
    RBACService,
    PREDEFINED_USERS,
    get_rbac_service,
)


def test_role_permissions_definitions():
    """Verify all roles have distinct, valid permission sets."""
    assert Role.ADMIN in ROLE_PERMISSIONS
    assert Role.RADIOLOGIST in ROLE_PERMISSIONS
    assert Role.TECHNICIAN in ROLE_PERMISSIONS
    assert Role.RESEARCHER in ROLE_PERMISSIONS
    assert Role.AUDITOR in ROLE_PERMISSIONS

    # Admin has all permissions
    admin_perms = ROLE_PERMISSIONS[Role.ADMIN]
    assert Permission.USERS_MANAGE in admin_perms
    assert Permission.JOBS_DELETE in admin_perms
    assert Permission.MODELS_MANAGE in admin_perms
    assert Permission.REPORTS_SIGN in admin_perms
    assert Permission.AUDIT_READ in admin_perms

    # Radiologist can sign reports, create jobs, read XAI, but cannot manage users
    rad_perms = ROLE_PERMISSIONS[Role.RADIOLOGIST]
    assert Permission.REPORTS_SIGN in rad_perms
    assert Permission.XAI_READ in rad_perms
    assert Permission.JOBS_CREATE in rad_perms
    assert Permission.USERS_MANAGE not in rad_perms

    # Technician can create jobs and read results, cannot sign reports or view audit
    tech_perms = ROLE_PERMISSIONS[Role.TECHNICIAN]
    assert Permission.JOBS_CREATE in tech_perms
    assert Permission.RESULTS_READ in tech_perms
    assert Permission.REPORTS_SIGN not in tech_perms
    assert Permission.AUDIT_READ not in tech_perms

    # Researcher has no PHI access and cannot sign reports or create clinical jobs
    res_perms = ROLE_PERMISSIONS[Role.RESEARCHER]
    assert Permission.MODELS_BENCHMARK in res_perms
    assert Permission.XAI_READ in res_perms
    assert Permission.PHI_READ not in res_perms
    assert Permission.REPORTS_SIGN not in res_perms

    # Auditor has read_all and audit_read
    aud_perms = ROLE_PERMISSIONS[Role.AUDITOR]
    assert Permission.AUDIT_READ in aud_perms
    assert Permission.JOBS_READ_ALL in aud_perms
    assert Permission.JOBS_CREATE not in aud_perms


def test_user_profile_to_dict():
    """Verify UserProfile serialization."""
    user = UserProfile(
        id="rad-01",
        name="Dr. Vance",
        email="vance@mipaas.health",
        role=Role.RADIOLOGIST,
    )
    d = user.to_dict()
    assert d["id"] == "rad-01"
    assert d["role"] == "radiologist"
    assert d["role_title"] == "Thoracic Radiologist"
    assert "reports:sign" in d["permissions"]
    assert "jobs:create" in d["permissions"]


def test_rbac_service_has_permission():
    """Verify permission check method on RBACService."""
    service = RBACService()
    admin = service.get_user("admin-01")
    rad = service.get_user("rad-01")
    tech = service.get_user("tech-01")
    res = service.get_user("res-01")

    assert service.has_permission(admin, Permission.USERS_MANAGE)
    assert service.has_permission(rad, Permission.REPORTS_SIGN)
    assert not service.has_permission(tech, Permission.REPORTS_SIGN)
    assert not service.has_permission(res, Permission.PHI_READ)
    assert service.has_permission(res, Permission.MODELS_BENCHMARK)


def test_rbac_service_job_access_control():
    """Verify job access rules for owner, admin, and auditor."""
    service = RBACService()
    admin = service.get_user("admin-01")
    rad = service.get_user("rad-01")
    tech = service.get_user("tech-01")
    aud = service.get_user("aud-01")

    # Own job access
    assert service.can_access_job(rad, job_owner_id="rad-01", action="read")
    assert service.can_access_job(rad, job_owner_id="rad-01", action="delete")

    # Accessing someone else's job
    assert not service.can_access_job(tech, job_owner_id="rad-01", action="read")
    assert not service.can_access_job(tech, job_owner_id="rad-01", action="delete")

    # Admin can access any job
    assert service.can_access_job(admin, job_owner_id="rad-01", action="read")
    assert service.can_access_job(admin, job_owner_id="rad-01", action="delete")

    # Auditor can read any job, but cannot delete
    assert service.can_access_job(aud, job_owner_id="rad-01", action="read")
    assert not service.can_access_job(aud, job_owner_id="rad-01", action="delete")


def test_rbac_service_audit_logging():
    """Verify audit log records events."""
    service = RBACService()
    rad = service.get_user("rad-01")

    service.log_audit_event(
        user=rad,
        action="report:sign",
        resource="job:job-123",
        decision="allow",
        details={"status": "confirmed"},
    )

    logs = service.get_audit_logs(limit=10)
    assert len(logs) >= 1
    recent = logs[0]
    assert recent["user_id"] == "rad-01"
    assert recent["action"] == "report:sign"
    assert recent["decision"] == "allow"


def test_rbac_service_role_update():
    """Verify user role updates and audit logging."""
    service = RBACService()
    user = service.get_or_create_user(user_id="dynamic-user-01", role=Role.TECHNICIAN)
    assert user.role == Role.TECHNICIAN

    updated = service.update_user_role("dynamic-user-01", Role.RADIOLOGIST)
    assert updated.role == Role.RADIOLOGIST
    assert service.has_permission(updated, Permission.REPORTS_SIGN)
