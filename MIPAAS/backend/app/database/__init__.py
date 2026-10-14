"""
MiPAAS Central Database Package.

Provides unified database access across all MiPAAS subsystems:
- IAM, Multi-tenant, and HIPAA Audit Logging
- OpenEMR Master Patient Index, Encounters, and Orders
- Eka.care ABHA Family Health Graphs, Vitals, Medications, and Records
- DICOM Studies, Async ML Jobs, XAI Heatmaps, and Agent Pipeline Logs
"""

from app.database.models import (
    AgentWorkflowRun,
    AuditLog,
    Base,
    ClinicalEncounter,
    ClinicalPatient,
    ClinicalProvider,
    ConsumerAppointment,
    DiagnosticJob,
    DicomSeries,
    DicomStudy,
    FamilyMember,
    HealthRecord,
    Medication,
    ProcedureOrder,
    ProcedureReport,
    Role,
    User,
    UserSession,
    VitalRecord,
)
from app.database.session import (
    check_db_health,
    create_db_engine,
    get_database_url,
    get_db,
    get_db_stats,
    get_engine,
    get_session_factory,
    init_db,
)
from app.database.seed import seed_database

__all__ = [
    # Database Core
    "Base",
    "get_engine",
    "get_db",
    "get_session_factory",
    "init_db",
    "seed_database",
    "check_db_health",
    "get_db_stats",
    "get_database_url",
    "create_db_engine",
    # IAM Models
    "User",
    "Role",
    "UserSession",
    "AuditLog",
    # Clinical OpenEMR Models
    "ClinicalProvider",
    "ClinicalPatient",
    "ClinicalEncounter",
    "ProcedureOrder",
    "ProcedureReport",
    # Consumer Health Models
    "FamilyMember",
    "Medication",
    "VitalRecord",
    "HealthRecord",
    "ConsumerAppointment",
    # Imaging AI Models
    "DicomStudy",
    "DicomSeries",
    "DiagnosticJob",
    "AgentWorkflowRun",
]
