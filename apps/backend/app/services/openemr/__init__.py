"""
OpenEMR Management System Integration Package for MiPAAS.

Ports and extracts core OpenEMR management subsystems:
- Users & Practitioners (users, facility, ACL credentials)
- Patient Demographics & Master Patient Index (patient_data)
- Clinical Encounters & Visits (form_encounter)
- Diagnostic & Procedure Orders (procedure_order, procedure_order_code)
- Diagnostic Reports & AI Findings (procedure_report, procedure_result)
- HL7 FHIR R4 standard resource serialization
"""

from app.services.openemr.schemas import (
    OpenEMRUser,
    OpenEMRPatient,
    OpenEMREncounter,
    OpenEMRProcedureOrder,
    OpenEMRProcedureReport,
    OrderPriority,
    OrderStatus,
    ReportStatus,
)
from app.services.openemr.service import (
    OpenEMRManagementService,
    get_openemr_service,
)
from app.services.openemr.fhir_mapper import OpenEMRFhirMapper

__all__ = [
    "OpenEMRUser",
    "OpenEMRPatient",
    "OpenEMREncounter",
    "OpenEMRProcedureOrder",
    "OpenEMRProcedureReport",
    "OrderPriority",
    "OrderStatus",
    "ReportStatus",
    "OpenEMRManagementService",
    "get_openemr_service",
    "OpenEMRFhirMapper",
]
