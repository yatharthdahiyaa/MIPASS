"""
RBAC Service — Role-Based Access Control for MIPAAS.

Defines clinical, operational, and administrative roles, granular permissions,
role hierarchies, audit logging for access checks, and user persona stores.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set
import structlog

logger = structlog.get_logger()


class Role(str, Enum):
    """System roles representing distinct clinical and administrative responsibilities."""
    ADMIN = "admin"
    RADIOLOGIST = "radiologist"
    TECHNICIAN = "technician"
    RESEARCHER = "researcher"
    AUDITOR = "auditor"


class Permission(str, Enum):
    """Granular permissions governing operations across MIPAAS services."""
    # Job operations
    JOBS_CREATE = "jobs:create"            # Upload DICOM, request signed URLs, start processing
    JOBS_READ = "jobs:read"                # View own jobs and status
    JOBS_READ_ALL = "jobs:read_all"        # View jobs across all users (system-wide)
    JOBS_DELETE = "jobs:delete"            # Cancel running jobs or delete artifacts

    # Results & Explainable AI
    RESULTS_READ = "results:read"          # View prediction scores and classification probabilities
    XAI_READ = "xai:read"                  # Inspect Grad-CAM++, Occlusion, Integrated Gradients, SHAP
    REPORTS_SIGN = "reports:sign"          # Clinically validate and digitally sign diagnostic reports
    REPORTS_EXPORT = "reports:export"      # Export PDF, DICOM-SR, or DICOM-SEG reports

    # Models & Registry
    MODELS_READ = "models:read"            # View registered models, architectures, and performance stats
    MODELS_MANAGE = "models:manage"        # Configure active models, update checkpoints, toggle registry
    MODELS_BENCHMARK = "models:benchmark"  # Run research benchmark evaluations and sensitivity sweeps

    # Administration & Compliance
    USERS_MANAGE = "users:manage"          # Create users, assign roles, manage accounts
    AUDIT_READ = "audit:read"              # View access logs, security events, HIPAA audit trail
    PHI_READ = "phi:read"                  # Access unmasked Protected Health Information (Patient ID, MRN)


# Complete Role-to-Permissions Mapping
ROLE_PERMISSIONS: Dict[Role, Set[Permission]] = {
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
}

# Role Metadata for UI presentation and documentation
ROLE_METADATA: Dict[Role, Dict[str, Any]] = {
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
    avatar: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def permissions(self) -> Set[Permission]:
        return ROLE_PERMISSIONS.get(self.role, set())

    def to_dict(self) -> Dict[str, Any]:
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


# Initial Predefined Clinical Personas
PREDEFINED_USERS: Dict[str, UserProfile] = {
    "admin-01": UserProfile(
        id="admin-01",
        name="Arthur Davis",
        email="arthur.davis@mipaas.health",
        role=Role.ADMIN,
        department="Hospital IT & Operations",
    ),
    "rad-01": UserProfile(
        id="rad-01",
        name="Dr. Elena Vance",
        email="dr.vance@mipaas.health",
        role=Role.RADIOLOGIST,
        department="Thoracic Imaging",
    ),
    "tech-01": UserProfile(
        id="tech-01",
        name="Marcus Chen",
        email="marcus.chen@mipaas.health",
        role=Role.TECHNICIAN,
        department="Diagnostic Imaging Center",
    ),
    "res-01": UserProfile(
        id="res-01",
        name="Dr. Sarah Lin",
        email="sarah.lin@mipaas.health",
        role=Role.RESEARCHER,
        department="Computational Oncology Lab",
    ),
    "aud-01": UserProfile(
        id="aud-01",
        name="Arthur Pendelton",
        email="a.pendelton@mipaas.health",
        role=Role.AUDITOR,
        department="Clinical Quality & HIPAA Compliance",
    ),
}


class RBACService:
    """Service providing authorization decisions, user management, and security audit logs."""

    def __init__(self, config: Optional[dict] = None):
        import copy
        self._config = config or {}
        # In-memory user registry, seeded with deep copies of demo clinical personas
        self._users: Dict[str, UserProfile] = {
            k: copy.deepcopy(v) for k, v in PREDEFINED_USERS.items()
        }
        # Audit log of security and permission decisions
        self._audit_logs: List[Dict[str, Any]] = []

    def get_user(self, user_id: str) -> Optional[UserProfile]:
        """Fetch user profile by user ID."""
        return self._users.get(user_id)

    def get_or_create_user(
        self,
        user_id: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        role: Optional[Role] = None,
    ) -> UserProfile:
        """Fetch an existing user or create a new profile with the given or default role."""
        if user_id in self._users:
            return self._users[user_id]

        new_user = UserProfile(
            id=user_id,
            name=name or f"User {user_id}",
            email=email or f"{user_id}@mipaas.local",
            role=role or Role.TECHNICIAN,
        )
        self._users[user_id] = new_user
        self.log_audit_event(
            user=new_user,
            action="user:created",
            resource=f"user:{user_id}",
            decision="allow",
            details={"assigned_role": new_user.role.value},
        )
        return new_user

    def list_users(self) -> List[UserProfile]:
        """List all registered users."""
        return list(self._users.values())

    def update_user_role(self, target_user_id: str, new_role: Role, actor: Optional[UserProfile] = None) -> Optional[UserProfile]:
        """Update a user's assigned role."""
        user = self._users.get(target_user_id)
        if not user:
            return None

        old_role = user.role
        user.role = new_role

        self.log_audit_event(
            user=actor or user,
            action="role:updated",
            resource=f"user:{target_user_id}",
            decision="allow",
            details={"target_user": target_user_id, "old_role": old_role.value, "new_role": new_role.value},
        )
        return user

    def has_permission(self, user: UserProfile, permission: Permission | str) -> bool:
        """Check if user profile possesses the required permission."""
        perm_enum = Permission(permission) if isinstance(permission, str) else permission
        if perm_enum in user.permissions:
            return True
        # Super-permission implications
        if perm_enum == Permission.JOBS_READ and Permission.JOBS_READ_ALL in user.permissions:
            return True
        return False

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
        if user.id == job_owner_id:
            return True

        return False

    def log_audit_event(
        self,
        user: Optional[UserProfile],
        action: str,
        resource: str,
        decision: str,  # "allow" | "deny"
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """Record an access decision into the audit trail."""
        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": user.id if user else "unauthenticated",
            "user_name": user.name if user else "Anonymous",
            "role": user.role.value if user else "none",
            "action": action,
            "resource": resource,
            "decision": decision,
            "details": details or {},
            "ip_address": ip_address,
        }
        self._audit_logs.append(event)
        # Cap audit log length in memory
        if len(self._audit_logs) > 1000:
            self._audit_logs.pop(0)

        if decision == "deny":
            logger.warning("access_denied", **event)
        else:
            logger.info("access_allowed", **event)

    def get_audit_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return the most recent audit trail records."""
        return list(reversed(self._audit_logs[-limit:]))


# Global singleton instance for easy service access
_rbac_instance: Optional[RBACService] = None


def get_rbac_service(config: Optional[dict] = None) -> RBACService:
    """Get or create singleton RBACService instance."""
    global _rbac_instance
    if _rbac_instance is None:
        _rbac_instance = RBACService(config)
    return _rbac_instance


def reset_rbac_service() -> None:
    """Reset the singleton instance (useful for test isolation)."""
    global _rbac_instance
    _rbac_instance = None

