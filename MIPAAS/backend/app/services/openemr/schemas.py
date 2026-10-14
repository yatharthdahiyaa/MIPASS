"""
OpenEMR Schema Definitions for MiPAAS.

Extracted directly from OpenEMR database architecture:
- users table: Practitioners, clinicians, staff, and facilities
- patient_data table: Demographics and Master Patient Index (MPI)
- form_encounter table: Clinical encounters and visits
- procedure_order table: Diagnostic imaging and laboratory orders
- procedure_report table: Signed reports, diagnostic impressions, and AI results
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class OrderPriority(str, Enum):
    """OpenEMR procedure order priority levels."""
    ROUTINE = "routine"
    URGENT = "urgent"
    STAT = "stat"
    ASAP = "asap"


class OrderStatus(str, Enum):
    """OpenEMR procedure order lifecycle states."""
    PENDING = "pending"
    ROUTED = "routed"
    IN_PROCESS = "in_process"
    COMPLETE = "complete"
    CANCELED = "canceled"


class ReportStatus(str, Enum):
    """OpenEMR diagnostic report statuses."""
    PRELIMINARY = "preliminary"
    FINAL = "final"
    CORRECTED = "corrected"
    SIGNED = "signed"


class EncounterStatus(str, Enum):
    """OpenEMR encounter lifecycle states."""
    PLANNED = "planned"
    ARRIVED = "arrived"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class OpenEMRUser:
    """Represents an OpenEMR practitioner, physician, technician, or staff member.
    
    Directly reflects OpenEMR's `users` table.
    """
    id: str                                  # users.id
    username: str                            # users.username
    fname: str                               # users.fname
    lname: str                               # users.lname
    email: str                               # users.email
    authorized: bool = True                  # users.authorized (1 = physician/signing provider)
    active: bool = True                      # users.active
    npi: Optional[str] = None                # users.npi (10-digit National Provider Identifier)
    specialty: str = "Diagnostic Radiology"  # users.specialty
    facility_id: str = "fac-01"              # users.facility_id
    facility_name: str = "Main Medical Center"
    title: str = "MD"                        # users.title
    phone: Optional[str] = None              # users.phone
    federaldrugid: Optional[str] = None      # DEA license number
    taxonomy: Optional[str] = None           # Healthcare provider taxonomy code
    calendar: bool = True                    # Whether provider appears on scheduling calendar
    role_mapping: str = "radiologist"        # Maps to MiPAAS Role (radiologist, technician, admin, auditor)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def full_name(self) -> str:
        return f"{self.title} {self.fname} {self.lname}".strip()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "username": self.username,
            "fname": self.fname,
            "lname": self.lname,
            "full_name": self.full_name,
            "email": self.email,
            "authorized": self.authorized,
            "active": self.active,
            "npi": self.npi,
            "specialty": self.specialty,
            "facility_id": self.facility_id,
            "facility_name": self.facility_name,
            "title": self.title,
            "phone": self.phone,
            "federaldrugid": self.federaldrugid,
            "taxonomy": self.taxonomy,
            "calendar": self.calendar,
            "role_mapping": self.role_mapping,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class OpenEMRPatient:
    """Represents an OpenEMR patient record and master demographics.
    
    Directly reflects OpenEMR's `patient_data` table.
    """
    id: str                                  # patient_data.id (Internal ID)
    pid: str                                 # patient_data.pid
    pubpid: str                              # patient_data.pubpid (Medical Record Number / MRN)
    fname: str                               # patient_data.fname
    lname: str                               # patient_data.lname
    dob: str                                 # patient_data.DOB (YYYY-MM-DD)
    sex: str                                 # patient_data.sex ('Male', 'Female', 'Other')
    phone: Optional[str] = None              # patient_data.phone_contact
    email: Optional[str] = None              # patient_data.email
    street: Optional[str] = None             # patient_data.street
    city: Optional[str] = None               # patient_data.city
    state: Optional[str] = None              # patient_data.state
    postal_code: Optional[str] = None        # patient_data.postal_code
    country_code: str = "US"                 # patient_data.country_code
    status: str = "active"                   # patient_data.status
    allergies: List[str] = field(default_factory=list)
    chronic_conditions: List[str] = field(default_factory=list)
    insurance_provider: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def full_name(self) -> str:
        return f"{self.fname} {self.lname}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "pid": self.pid,
            "mrn": self.pubpid,
            "pubpid": self.pubpid,
            "fname": self.fname,
            "lname": self.lname,
            "full_name": self.full_name,
            "dob": self.dob,
            "sex": self.sex,
            "phone": self.phone,
            "email": self.email,
            "street": self.street,
            "city": self.city,
            "state": self.state,
            "postal_code": self.postal_code,
            "country_code": self.country_code,
            "status": self.status,
            "allergies": self.allergies,
            "chronic_conditions": self.chronic_conditions,
            "insurance_provider": self.insurance_provider,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class OpenEMREncounter:
    """Represents a clinical encounter or visit in OpenEMR.
    
    Directly reflects OpenEMR's `form_encounter` table.
    """
    id: str                                  # form_encounter.id
    encounter: str                           # form_encounter.encounter
    pid: str                                 # form_encounter.pid (Patient ID)
    date: datetime                           # form_encounter.date
    reason: str                              # form_encounter.reason (Chief complaint)
    provider_id: str                         # form_encounter.provider_id
    provider_name: str
    facility_id: str = "fac-01"              # form_encounter.facility_id
    facility_name: str = "Main Medical Center"
    status: EncounterStatus = EncounterStatus.IN_PROGRESS
    sensitivity: str = "normal"              # form_encounter.sensitivity
    clinical_notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "encounter": self.encounter,
            "pid": self.pid,
            "date": self.date.isoformat(),
            "reason": self.reason,
            "provider_id": self.provider_id,
            "provider_name": self.provider_name,
            "facility_id": self.facility_id,
            "facility_name": self.facility_name,
            "status": self.status.value,
            "sensitivity": self.sensitivity,
            "clinical_notes": self.clinical_notes,
        }


@dataclass
class OpenEMRProcedureOrder:
    """Represents an imaging or diagnostic procedure order in OpenEMR.
    
    Directly reflects OpenEMR's `procedure_order` and `procedure_order_code` tables.
    """
    procedure_order_id: str                  # procedure_order.procedure_order_id
    provider_id: str                         # Ordering physician
    provider_name: str
    patient_id: str                          # Patient ID
    patient_name: str
    patient_mrn: str                         # Medical Record Number
    encounter_id: str                        # Associated clinical encounter
    date_ordered: datetime
    procedure_code: str                      # CPT or LOINC code (e.g. CPT 71250)
    procedure_name: str                      # Description (e.g. "CT Chest Low Dose Screening")
    modality: str                            # 'CT', 'MRI', 'CXR', 'DERM', 'IR'
    order_priority: OrderPriority = OrderPriority.ROUTINE
    order_status: OrderStatus = OrderStatus.PENDING
    clinical_notes: str = ""
    patient_history: str = ""
    linked_job_id: Optional[str] = None      # MiPAAS processing job ID
    dicom_study_instance_uid: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "procedure_order_id": self.procedure_order_id,
            "provider_id": self.provider_id,
            "provider_name": self.provider_name,
            "patient_id": self.patient_id,
            "patient_name": self.patient_name,
            "patient_mrn": self.patient_mrn,
            "encounter_id": self.encounter_id,
            "date_ordered": self.date_ordered.isoformat(),
            "procedure_code": self.procedure_code,
            "procedure_name": self.procedure_name,
            "modality": self.modality,
            "order_priority": self.order_priority.value,
            "order_status": self.order_status.value,
            "clinical_notes": self.clinical_notes,
            "patient_history": self.patient_history,
            "linked_job_id": self.linked_job_id,
            "dicom_study_instance_uid": self.dicom_study_instance_uid,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class OpenEMRProcedureReport:
    """Represents a finalized diagnostic report with AI findings in OpenEMR.
    
    Directly reflects OpenEMR's `procedure_report` and `procedure_result` tables.
    """
    procedure_report_id: str                 # procedure_report.procedure_report_id
    procedure_order_id: str                  # Associated procedure_order
    date_report: datetime
    report_status: ReportStatus
    report_notes: str                        # Radiologist's diagnostic impression
    ai_prediction_summary: Dict[str, Any]    # AI confidence scores, risk metrics
    gradcam_heatmap_url: Optional[str] = None # Link to 3D XAI interactive viewer
    dicom_study_instance_uid: Optional[str] = None
    signed_by_provider_id: Optional[str] = None
    signed_by_provider_name: Optional[str] = None
    signed_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "procedure_report_id": self.procedure_report_id,
            "procedure_order_id": self.procedure_order_id,
            "date_report": self.date_report.isoformat(),
            "report_status": self.report_status.value,
            "report_notes": self.report_notes,
            "ai_prediction_summary": self.ai_prediction_summary,
            "gradcam_heatmap_url": self.gradcam_heatmap_url,
            "dicom_study_instance_uid": self.dicom_study_instance_uid,
            "signed_by_provider_id": self.signed_by_provider_id,
            "signed_by_provider_name": self.signed_by_provider_name,
            "signed_at": self.signed_at.isoformat() if self.signed_at else None,
            "created_at": self.created_at.isoformat(),
        }
