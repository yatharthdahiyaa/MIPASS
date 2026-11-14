"""
RBAC Service — Role-Based Access Control for MIPAAS.

Defines clinical, operational, and administrative roles, granular permissions,
role hierarchies, audit logging for access checks, and user persona stores.
"""

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any

import structlog

logger = structlog.get_logger()


class Role(str, Enum):
    """System roles representing distinct clinical and administrative responsibilities."""

    ADMIN = "admin"
    RADIOLOGIST = "radiologist"
    TECHNICIAN = "technician"
    RESEARCHER = "researcher"
    AUDITOR = "auditor"
    PATIENT = "patient"
    DOCTOR = "doctor"
    # Self-registered clinician awaiting licence verification: no clinical access yet.
    DOCTOR_PENDING = "doctor_pending"


class Permission(str, Enum):
    """Granular permissions governing operations across MIPAAS services."""

    # Job operations
    JOBS_CREATE = "jobs:create"  # Upload DICOM, request signed URLs, start processing
    JOBS_READ = "jobs:read"  # View own jobs and status
    JOBS_READ_ALL = "jobs:read_all"  # View jobs across all users (system-wide)
    JOBS_DELETE = "jobs:delete"  # Cancel running jobs or delete artifacts

    # Results & Explainable AI
    RESULTS_READ = "results:read"  # View prediction scores and classification probabilities
    XAI_READ = "xai:read"  # Inspect Grad-CAM++, Occlusion, Integrated Gradients, SHAP
    REPORTS_SIGN = "reports:sign"  # Clinically validate and digitally sign diagnostic reports
    REPORTS_EXPORT = "reports:export"  # Export PDF, DICOM-SR, or DICOM-SEG reports

    # Models & Registry
    MODELS_READ = "models:read"  # View registered models, architectures, and performance stats
    MODELS_MANAGE = "models:manage"  # Configure active models, update checkpoints, toggle registry
    MODELS_BENCHMARK = (
        "models:benchmark"  # Run research benchmark evaluations and sensitivity sweeps
    )

    # Administration & Compliance
    USERS_MANAGE = "users:manage"  # Create users, assign roles, manage accounts
    AUDIT_READ = "audit:read"  # View access logs, security events, HIPAA audit trail
    PHI_READ = "phi:read"  # Access unmasked Protected Health Information (Patient ID, MRN)

    # Patient self-service
    EHR_SELF = "ehr:self"  # Read and write one's own health record, uploads and X-rays


# Complete Role-to-Permissions Mapping
ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.ADMIN: {
        Permission.JOBS_CREATE,
        Permission.JOBS_READ,
        Permission.JOBS_READ_ALL,
        Permission.JOBS_DELETE,
        Permission.RESULTS_READ,
        Permission.XAI_READ,
        Permission.REPORTS_SIGN,
        Permission.REPORTS_EXPORT,
        Permission.MODELS_READ,
        Permission.MODELS_MANAGE,
        Permission.MODELS_BENCHMARK,
        Permission.USERS_MANAGE,
        Permission.AUDIT_READ,
        Permission.PHI_READ,
    },
    Role.RADIOLOGIST: {
        Permission.JOBS_CREATE,
        Permission.JOBS_READ,
        Permission.RESULTS_READ,
        Permission.XAI_READ,
        Permission.REPORTS_SIGN,
        Permission.REPORTS_EXPORT,
        Permission.MODELS_READ,
        Permission.PHI_READ,
    },
    Role.TECHNICIAN: {
        Permission.JOBS_CREATE,
        Permission.JOBS_READ,
        Permission.RESULTS_READ,
        Permission.MODELS_READ,
        Permission.PHI_READ,
    },
    Role.RESEARCHER: {
        Permission.JOBS_READ,
        Permission.RESULTS_READ,
        Permission.XAI_READ,
        Permission.MODELS_READ,
        Permission.MODELS_BENCHMARK,
    },
    Role.AUDITOR: {
        Permission.JOBS_READ,
        Permission.JOBS_READ_ALL,
        Permission.AUDIT_READ,
        Permission.MODELS_READ,
    },
    Role.PATIENT: {
        Permission.EHR_SELF,
    },
    Role.DOCTOR: {
        Permission.JOBS_CREATE,
        Permission.JOBS_READ,
        Permission.RESULTS_READ,
        Permission.XAI_READ,
        Permission.REPORTS_SIGN,
        Permission.REPORTS_EXPORT,
        Permission.MODELS_READ,
        Permission.PHI_READ,
    },
    Role.DOCTOR_PENDING: set(),
}

# Role Metadata for UI presentation and documentation
ROLE_METADATA: dict[Role, dict[str, Any]] = {
    Role.ADMIN: {
        "title": "System Administrator",
        "description": "Full access to platform configuration, user roles, audit trails, and model governance.",
        "badge_color": "#F5A623",
        "badge_bg": "rgba(245, 166, 35, 0.15)",
        "icon": "ShieldCheck",
    },
    Role.RADIOLOGIST: {
        "title": "Thoracic Radiologist",
        "description": "Clinical specialist. Uploads studies, reviews Grad-CAM++ heatmaps, validates diagnoses, and signs reports.",
        "badge_color": "#7C5CFC",
        "badge_bg": "rgba(124, 92, 252, 0.15)",
        "icon": "Stethoscope",
    },
    Role.TECHNICIAN: {
        "title": "Imaging Technologist",
        "description": "Scan ingestion lead. Uploads DICOMs, verifies scan acquisition parameters, and initiates inference.",
        "badge_color": "#00DCCE",
        "badge_bg": "rgba(0, 220, 206, 0.15)",
        "icon": "Activity",
    },
    Role.RESEARCHER: {
        "title": "Medical AI Researcher",
        "description": "Algorithm evaluator. Investigates feature attributions and benchmark metrics on de-identified data.",
        "badge_color": "#FF7869",
        "badge_bg": "rgba(255, 120, 105, 0.15)",
        "icon": "Cpu",
    },
    Role.AUDITOR: {
        "title": "Compliance Auditor",
        "description": "HIPAA oversight officer. Read-only review of system activities, access events, and data lifecycle.",
        "badge_color": "#98AED9",
        "badge_bg": "rgba(152, 174, 217, 0.15)",
        "icon": "FileCheck2",
    },
    Role.PATIENT: {
        "title": "Patient",
        "description": "Keeps a personal health record, logs daily vitals and medicines, and uploads X-rays for AI screening.",
        "badge_color": "#5FD3A8",
        "badge_bg": "rgba(95, 211, 168, 0.15)",
        "icon": "HeartPulse",
    },
    Role.DOCTOR: {
        "title": "Doctor",
        "description": "Verified clinician. Uploads studies, reviews AI findings and explanations, and signs reports.",
        "badge_color": "#7C5CFC",
        "badge_bg": "rgba(124, 92, 252, 0.15)",
        "icon": "Stethoscope",
    },
    Role.DOCTOR_PENDING: {
        "title": "Doctor (verification pending)",
        "description": "Clinician account awaiting licence verification. Clinical tools unlock once verified.",
        "badge_color": "#98AED9",
        "badge_bg": "rgba(152, 174, 217, 0.15)",
        "icon": "Clock",
    },
}


@dataclass
class UserProfile:
    """Represents an authenticated user and their active role."""

    id: str
    name: str
    email: str
    role: Role
    organization: str = "MiPAAS Health System"
    department: str = "Diagnostic Radiology"
    avatar: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def permissions(self) -> set[Permission]:
        return ROLE_PERMISSIONS.get(self.role, set())

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role.value,
            "role_title": ROLE_METADATA.get(self.role, {}).get("title", self.role.value),
            "organization": self.organization,
            "department": self.department,
            "avatar": self.avatar,
            "permissions": sorted([p.value for p in self.permissions]),
        }


class RBACService:
    """Authorization decisions, user management and the security audit trail.

    Users and audit events live in the central PostgreSQL database; nothing is held in memory.
    """

    def __init__(self, config: dict | None = None):
        self._config = config or {}

    def get_user(self, user_id: str) -> UserProfile | None:
        """The active user with this ID, or None."""
        from app.database.models.iam import User
        from app.database.session import get_db

        with get_db() as db:
            row = db.get(User, user_id)
            if row is None or not row.is_active:
                return None
            return profile_from_user(row)

    def list_users(self) -> list[UserProfile]:
        """All user accounts, oldest first."""
        from app.database.models.iam import User
        from app.database.session import get_db

        with get_db() as db:
            rows = db.query(User).order_by(User.created_at).all()
            return [profile_from_user(r) for r in rows]

    def update_user_role(
        self, target_user_id: str, new_role: Role, actor: UserProfile | None = None
    ) -> UserProfile | None:
        """Change a user's role and record the change in the audit trail."""
        from app.database.models.iam import User
        from app.database.session import get_db

        with get_db() as db:
            row = db.get(User, target_user_id)
            if row is None:
                return None
            old_role = row.role
            row.role = new_role.value
            profile = profile_from_user(row)
            db.flush()

        self.log_audit_event(
            user=actor or profile,
            action="role:updated",
            resource=f"user:{target_user_id}",
            decision="allow",
            details={
                "target_user": target_user_id,
                "old_role": old_role,
                "new_role": new_role.value,
            },
        )
        return profile

    def has_permission(self, user: UserProfile, permission: Permission | str) -> bool:
        """Check if user profile possesses the required permission."""
        perm_enum = Permission(permission) if isinstance(permission, str) else permission
        if perm_enum in user.permissions:
            return True
        # Super-permission implications
        return perm_enum == Permission.JOBS_READ and Permission.JOBS_READ_ALL in user.permissions

    def has_role(self, user: UserProfile, role: Role | str) -> bool:
        """Check if user has a specific role."""
        role_enum = Role(role) if isinstance(role, str) else role
        return user.role == role_enum

    def can_access_job(self, user: UserProfile, job_owner_id: str, action: str = "read") -> bool:
        """Determine whether user can access/modify a job based on ownership and role."""
        # Admins can access and modify any job
        if self.has_role(user, Role.ADMIN):
            return True

        # Auditors can view all jobs
        if self.has_role(user, Role.AUDITOR) and action == "read":
            return True

        # Users can access their own jobs
        return user.id == job_owner_id

    def log_audit_event(
        self,
        user: UserProfile | None,
        action: str,
        resource: str,
        decision: str,  # "allow" | "deny"
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Append an access decision to the audit trail (central database)."""
        from app.database.models.iam import AuditLog
        from app.database.session import get_db

        event_details = dict(details or {})
        if user is not None:
            event_details.setdefault("role", user.role.value)
        with get_db() as db:
            db.add(
                AuditLog(
                    user_id=user.id if user else None,
                    username=(user.email if user else None),
                    action=action[:100],
                    resource_type="rbac",
                    resource_id=resource[:100],
                    status="success" if decision == "allow" else "denied",
                    ip_address=ip_address,
                    details_json=json.dumps(event_details, default=str)[:4000],
                )
            )

        if decision == "deny":
            logger.warning(
                "access_denied", action=action, resource=resource, user_id=user.id if user else None
            )
        else:
            logger.info(
                "access_allowed",
                action=action,
                resource=resource,
                user_id=user.id if user else None,
            )

    def get_audit_logs(self, limit: int = 50) -> list[dict[str, Any]]:
        """The most recent audit trail records, newest first."""
        from app.database.models.iam import AuditLog
        from app.database.session import get_db

        with get_db() as db:
            rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
            out = []
            for r in rows:
                details = json.loads(r.details_json) if r.details_json else {}
                out.append(
                    {
                        "timestamp": r.created_at.isoformat() if r.created_at else None,
                        "user_id": r.user_id or "unauthenticated",
                        "user_name": r.username or "Anonymous",
                        "role": details.get("role", "none"),
                        "action": r.action,
                        "resource": r.resource_id,
                        "decision": "allow" if r.status == "success" else "deny",
                        "details": details,
                        "ip_address": r.ip_address,
                    }
                )
            return out


def profile_from_user(row) -> UserProfile:
    """Map a central ``users`` row to the authorization profile used by the middleware."""
    try:
        role = Role(row.role)
    except ValueError:
        role = Role.PATIENT
    name = " ".join(p for p in (row.first_name, row.last_name) if p) or row.username
    return UserProfile(
        id=row.id,
        name=name,
        email=row.email,
        role=role,
        organization=row.organization or "MiPAAS Health System",
        department=row.department or "",
    )


_rbac_instance: RBACService | None = None


def get_rbac_service(config: dict | None = None) -> RBACService:
    """Get or create the shared RBACService (stateless: data lives in the database)."""
    global _rbac_instance
    if _rbac_instance is None:
        _rbac_instance = RBACService(config)
    return _rbac_instance
