"""
MiPAAS Central Database Package.

Exported Models and Utilities:
- Session & Engine: get_db, get_engine, init_db, check_db_health, get_db_stats
- IAM: User, Role, UserSession, AuditLog
- Clinical: ClinicalProvider, ClinicalPatient, ClinicalEncounter, ProcedureOrder, ProcedureReport
- Consumer Health: FamilyMember, Medication, VitalRecord, HealthRecord, ConsumerAppointment
- Imaging AI: DicomStudy, DicomSeries, DiagnosticJob, AgentWorkflowRun
"""

from database.models import (
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
from database.session import (
    check_db_health,
    create_db_engine,
    get_database_url,
    get_db,
    get_db_stats,
    get_engine,
    get_session_factory,
    init_db,
)

__all__ = [
    # Engine & Session
    "Base",
    "get_engine",
    "get_db",
    "get_session_factory",
    "init_db",
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
