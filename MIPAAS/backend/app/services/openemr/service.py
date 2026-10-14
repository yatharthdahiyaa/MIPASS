"""
OpenEMR Management Service for MiPAAS.

Implements the business logic, master patient index (MPI), clinical encounters,
imaging procedure order worklist, practitioner management, and report generation
modeled directly on OpenEMR's PHP services.
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import structlog

from app.services.openemr.schemas import (
    EncounterStatus,
    OpenEMREncounter,
    OpenEMRPatient,
    OpenEMRProcedureOrder,
    OpenEMRProcedureReport,
    OpenEMRUser,
    OrderPriority,
    OrderStatus,
    ReportStatus,
)

logger = structlog.get_logger()


class OpenEMRManagementService:
    """Core Clinical & Practice Management Engine for OpenEMR integration in MiPAAS."""

    def __init__(self):
        self._users: Dict[str, OpenEMRUser] = {}
        self._patients: Dict[str, OpenEMRPatient] = {}
        self._encounters: Dict[str, OpenEMREncounter] = {}
        self._orders: Dict[str, OpenEMRProcedureOrder] = {}
        self._reports: Dict[str, OpenEMRProcedureReport] = {}
        self._seed_initial_data()

    # ─────────────────────────────────────────────────────────────
    # Initial Pre-seeded Clinical Data (OpenEMR Standard Defaults)
    # ─────────────────────────────────────────────────────────────

    def _seed_initial_data(self) -> None:
        """Seed initial practitioners, patients, and imaging orders."""
        now = datetime.now(timezone.utc)

        # 1. Practitioners (OpenEMR users table)
        users = [
            OpenEMRUser(
                id="emr-user-01",
                username="elena.vance",
                fname="Elena",
                lname="Vance",
                email="elena.vance@mipaas.health",
                npi="1942058192",
                specialty="Thoracic & Diagnostic Radiology",
                title="Dr.",
                phone="+1 (555) 234-5678",
                role_mapping="radiologist",
                facility_name="Memorial Diagnostic Pavilion",
            ),
            OpenEMRUser(
                id="emr-user-02",
                username="marcus.chen",
                fname="Marcus",
                lname="Chen",
                email="marcus.chen@mipaas.health",
                npi="1083920194",
                specialty="Interventional Neuroradiology",
                title="Dr.",
                phone="+1 (555) 345-6789",
                role_mapping="radiologist",
                facility_name="Comprehensive Stroke Center",
            ),
            OpenEMRUser(
                id="emr-user-03",
                username="arthur.davis",
                fname="Arthur",
                lname="Davis",
                email="arthur.davis@mipaas.health",
                npi="1492019284",
                specialty="Health Informatics & Administration",
                title="Mr.",
                phone="+1 (555) 456-7890",
                role_mapping="admin",
                facility_name="Main Medical Center",
            ),
            OpenEMRUser(
                id="emr-user-04",
                username="sarah.lin",
                fname="Sarah",
                lname="Lin",
                email="sarah.lin@mipaas.health",
                npi="1839201942",
                specialty="Clinical Imaging Technologist",
                title="Ms.",
                phone="+1 (555) 567-8901",
                role_mapping="technician",
                facility_name="Advanced CT/MRI Core",
            ),
        ]
        for u in users:
            self._users[u.id] = u

        # 2. Patients (OpenEMR patient_data table)
        patients = [
            OpenEMRPatient(
                id="pat-01",
                pid="1001",
                pubpid="MRN-89421",
                fname="John",
                lname="Doe",
                dob="1968-04-12",
                sex="Male",
                phone="+1 (555) 789-0123",
                email="john.doe@example.com",
                street="742 Evergreen Terrace",
                city="Springfield",
                state="IL",
                postal_code="62704",
                allergies=["Iodine Contrast (Mild)", "Penicillin"],
                chronic_conditions=["COPD", "Former Smoker (40 pack-years)"],
                insurance_provider="Blue Cross Blue Shield",
            ),
            OpenEMRPatient(
                id="pat-02",
                pid="1002",
                pubpid="MRN-64812",
                fname="Eleanor",
                lname="Rigby",
                dob="1975-09-28",
                sex="Female",
                phone="+1 (555) 890-1234",
                email="eleanor.rigby@example.com",
                street="18 Abbey Road",
                city="Boston",
                state="MA",
                postal_code="02115",
                allergies=["None known"],
                chronic_conditions=["Hypertension", "Recent Acute Headache"],
                insurance_provider="Aetna Health",
            ),
            OpenEMRPatient(
                id="pat-03",
                pid="1003",
                pubpid="MRN-53109",
                fname="Robert",
                lname="Paulson",
                dob="1954-11-03",
                sex="Male",
                phone="+1 (555) 901-2345",
                email="robert.paulson@example.com",
                street="420 Pine Street",
                city="Seattle",
                state="WA",
                postal_code="98101",
                allergies=["Sulfa drugs"],
                chronic_conditions=["Type 2 Diabetes", "Peripheral Neuropathy"],
                insurance_provider="Medicare Part B",
            ),
        ]
        for p in patients:
            self._patients[p.id] = p

        # 3. Encounters (OpenEMR form_encounter table)
        encounters = [
            OpenEMREncounter(
                id="enc-01",
                encounter="5001",
                pid="pat-01",
                date=now - timedelta(days=1),
                reason="Annual High-Risk Low-Dose CT Lung Cancer Screening",
                provider_id="emr-user-01",
                provider_name="Dr. Elena Vance",
                status=EncounterStatus.IN_PROGRESS,
                clinical_notes="Patient presents for scheduled screening. 40 pack-year smoking history. Denies acute hemoptysis or dyspnea.",
            ),
            OpenEMREncounter(
                id="enc-02",
                encounter="5002",
                pid="pat-02",
                date=now - timedelta(hours=4),
                reason="Sudden-onset severe cranial headache with visual disturbances",
                provider_id="emr-user-02",
                provider_name="Dr. Marcus Chen",
                status=EncounterStatus.IN_PROGRESS,
                clinical_notes="STAT rule out intracranial hemorrhage or vascular lesion. NIHSS score 3.",
            ),
        ]
        for e in encounters:
            self._encounters[e.id] = e

        # 4. Procedure Orders (OpenEMR procedure_order table)
        orders = [
            OpenEMRProcedureOrder(
                procedure_order_id="ord-7001",
                provider_id="emr-user-01",
                provider_name="Dr. Elena Vance",
                patient_id="pat-01",
                patient_name="John Doe",
                patient_mrn="MRN-89421",
                encounter_id="enc-01",
                date_ordered=now - timedelta(hours=6),
                procedure_code="71250",
                procedure_name="CT Thorax Low-Dose Screening",
                modality="CT",
                order_priority=OrderPriority.ROUTINE,
                order_status=OrderStatus.PENDING,
                clinical_notes="Routine lung nodule surveillance. NLST protocol.",
                patient_history="40 pack-year smoking history. Prior baseline clear 12 months ago.",
            ),
            OpenEMRProcedureOrder(
                procedure_order_id="ord-7002",
                provider_id="emr-user-02",
                provider_name="Dr. Marcus Chen",
                patient_id="pat-02",
                patient_name="Eleanor Rigby",
                patient_mrn="MRN-64812",
                encounter_id="enc-02",
                date_ordered=now - timedelta(hours=2),
                procedure_code="70553",
                procedure_name="MRI Brain Multi-Sequence (T1, T2, FLAIR, T1CE)",
                modality="MRI",
                order_priority=OrderPriority.STAT,
                order_status=OrderStatus.PENDING,
                clinical_notes="STAT rule out intracranial mass or acute ischemia.",
                patient_history="Acute persistent headache, left temporal localization.",
            ),
        ]
        for o in orders:
            self._orders[o.procedure_order_id] = o
        self._sync_with_central_db()

    def _sync_with_central_db(self) -> None:
        """Hydrate memory cache and sync with central relational database."""
        try:
            from app.database.session import get_db
            from app.database.models.clinical import ClinicalPatient
            with get_db() as db:
                for db_p in db.query(ClinicalPatient).all():
                    if db_p.id not in self._patients:
                        self._patients[db_p.id] = OpenEMRPatient(
                            id=db_p.id,
                            pid=db_p.mrn.replace("MRN-", ""),
                            pubpid=db_p.mrn,
                            fname=db_p.fname,
                            lname=db_p.lname,
                            dob=db_p.dob,
                            sex=db_p.gender,
                            phone=db_p.phone,
                            email=db_p.email,
                            street=db_p.street,
                            city=db_p.city,
                            state=db_p.state,
                            postal_code=db_p.postal_code,
                            insurance_provider=db_p.insurance_provider,
                        )
        except Exception as exc:
            logger.debug("openemr_db_sync_deferred", error=str(exc))

    def _save_patient_to_db(self, patient: OpenEMRPatient) -> None:
        try:
            from app.database.session import get_db
            from app.database.models.clinical import ClinicalPatient
            with get_db() as db:
                existing = db.query(ClinicalPatient).filter_by(id=patient.id).first()
                if not existing:
                    db.add(ClinicalPatient(
                        id=patient.id,
                        mrn=patient.pubpid,
                        fname=patient.fname,
                        lname=patient.lname,
                        dob=patient.dob,
                        gender=patient.sex,
                        phone=patient.phone,
                        email=patient.email,
                        street=patient.street,
                        city=patient.city,
                        state=patient.state,
                        postal_code=patient.postal_code,
                        insurance_provider=patient.insurance_provider,
                    ))
        except Exception as exc:
            logger.debug("openemr_patient_db_save_deferred", error=str(exc))

    def _save_order_to_db(self, order: OpenEMRProcedureOrder) -> None:
        try:
            from app.database.session import get_db
            from app.database.models.clinical import ProcedureOrder
            with get_db() as db:
                existing = db.query(ProcedureOrder).filter_by(id=order.procedure_order_id).first()
                if not existing:
                    db.add(ProcedureOrder(
                        id=order.procedure_order_id,
                        order_number=order.procedure_order_id.upper(),
                        patient_id=order.patient_id,
                        encounter_id=order.encounter_id,
                        procedure_code=order.procedure_code,
                        procedure_name=order.procedure_name,
                        modality=order.modality,
                        priority=order.order_priority.value if hasattr(order.order_priority, 'value') else str(order.order_priority),
                        status=order.order_status.value if hasattr(order.order_status, 'value') else str(order.order_status),
                        clinical_indication=order.clinical_notes,
                    ))
        except Exception as exc:
            logger.debug("openemr_order_db_save_deferred", error=str(exc))

    def _save_report_to_db(self, report: OpenEMRProcedureReport) -> None:
        try:
            from app.database.session import get_db
            from app.database.models.clinical import ProcedureReport, ProcedureOrder
            with get_db() as db:
                existing = db.query(ProcedureReport).filter_by(id=report.procedure_report_id).first()
                if not existing:
                    order_obj = self.get_order(report.procedure_order_id)
                    patient_id = order_obj.patient_id if order_obj else "unknown"
                    db.add(ProcedureReport(
                        id=report.procedure_report_id,
                        report_number=report.procedure_report_id.upper(),
                        order_id=report.procedure_order_id,
                        patient_id=patient_id,
                        status=report.report_status.value if hasattr(report.report_status, 'value') else str(report.report_status),
                        findings=report.report_notes,
                        impression=report.ai_prediction_summary,
                        signed_by=report.signed_by_provider_name,
                        signed_at=report.signed_at,
                    ))
                db_order = db.query(ProcedureOrder).filter_by(id=report.procedure_order_id).first()
                if db_order:
                    db_order.status = "completed"
        except Exception as exc:
            logger.debug("openemr_report_db_save_deferred", error=str(exc))


    # ─────────────────────────────────────────────────────────────
    # Practitioner & User Management (users table)
    # ─────────────────────────────────────────────────────────────

    def list_users(self, role: Optional[str] = None) -> List[OpenEMRUser]:
        """List all OpenEMR practitioners and staff."""
        users = list(self._users.values())
        if role:
            users = [u for u in users if u.role_mapping == role]
        return users

    def get_user(self, user_id: str) -> Optional[OpenEMRUser]:
        """Get an OpenEMR practitioner by ID or username."""
        if user_id in self._users:
            return self._users[user_id]
        for u in self._users.values():
            if u.username == user_id or u.email == user_id:
                return u
        return None

    def create_user(self, data: Dict[str, Any]) -> OpenEMRUser:
        """Create a new OpenEMR practitioner."""
        user_id = data.get("id") or f"emr-user-{len(self._users) + 1:02d}"
        new_user = OpenEMRUser(
            id=user_id,
            username=data["username"],
            fname=data["fname"],
            lname=data["lname"],
            email=data["email"],
            authorized=data.get("authorized", True),
            npi=data.get("npi"),
            specialty=data.get("specialty", "Diagnostic Radiology"),
            title=data.get("title", "Dr."),
            role_mapping=data.get("role_mapping", "radiologist"),
            facility_name=data.get("facility_name", "Main Medical Center"),
        )
        self._users[user_id] = new_user
        logger.info("openemr_user_created", user_id=user_id, username=new_user.username)
        return new_user

    # ─────────────────────────────────────────────────────────────
    # Patient Demographics & Master Patient Index (patient_data table)
    # ─────────────────────────────────────────────────────────────

    def list_patients(self, search: Optional[str] = None) -> List[OpenEMRPatient]:
        """List or search patient demographics."""
        patients = list(self._patients.values())
        if search:
            s = search.lower()
            patients = [
                p for p in patients
                if s in p.full_name.lower() or s in p.pubpid.lower() or s in p.dob
            ]
        return patients

    def get_patient(self, patient_id: str) -> Optional[OpenEMRPatient]:
        """Get patient by internal ID, PID, or MRN."""
        if patient_id in self._patients:
            return self._patients[patient_id]
        for p in self._patients.values():
            if p.pubpid == patient_id or p.pid == patient_id:
                return p
        return None

    def create_patient(self, data: Dict[str, Any]) -> OpenEMRPatient:
        """Register a new patient into OpenEMR demographics."""
        pid = data.get("pid") or str(1000 + len(self._patients) + 1)
        pat_id = data.get("id") or f"pat-{len(self._patients) + 1:02d}"
        mrn = data.get("pubpid") or data.get("mrn") or f"MRN-{pid.zfill(5)}"
        new_patient = OpenEMRPatient(
            id=pat_id,
            pid=pid,
            pubpid=mrn,
            fname=data["fname"],
            lname=data["lname"],
            dob=data["dob"],
            sex=data.get("sex", "Other"),
            phone=data.get("phone"),
            email=data.get("email"),
            street=data.get("street"),
            city=data.get("city"),
            state=data.get("state"),
            postal_code=data.get("postal_code"),
            allergies=data.get("allergies", []),
            chronic_conditions=data.get("chronic_conditions", []),
            insurance_provider=data.get("insurance_provider"),
        )
        self._patients[pat_id] = new_patient
        self._save_patient_to_db(new_patient)
        logger.info("openemr_patient_registered", patient_id=pat_id, mrn=mrn)
        return new_patient

    def reconcile_dicom_patient(
        self,
        patient_id_tag: Optional[str] = None,
        patient_name_tag: Optional[str] = None,
        dob_tag: Optional[str] = None,
    ) -> Optional[OpenEMRPatient]:
        """Reconcile incoming DICOM tags with an existing OpenEMR patient record.
        
        Attempts matching in priority order:
        1. Exact MRN / Patient ID match (0010, 0020)
        2. Last name + First name + DOB match
        """
        if patient_id_tag:
            match = self.get_patient(patient_id_tag)
            if match:
                return match

        if patient_name_tag:
            # DICOM name format is often "Doe^John^^^" or "John Doe"
            cleaned_name = patient_name_tag.replace("^", " ").strip().lower()
            for p in self._patients.values():
                if p.full_name.lower() in cleaned_name or (p.lname.lower() in cleaned_name and p.fname.lower() in cleaned_name):
                    if dob_tag:
                        # Normalize DICOM DOB format (YYYYMMDD to YYYY-MM-DD)
                        norm_dob = f"{dob_tag[:4]}-{dob_tag[4:6]}-{dob_tag[6:]}" if len(dob_tag) == 8 else dob_tag
                        if p.dob == norm_dob:
                            return p
                    else:
                        return p

        return None

    # ─────────────────────────────────────────────────────────────
    # Encounters & Visits (form_encounter table)
    # ─────────────────────────────────────────────────────────────

    def list_encounters(self, patient_id: Optional[str] = None) -> List[OpenEMREncounter]:
        """List clinical encounters, optionally filtered by patient."""
        encounters = list(self._encounters.values())
        if patient_id:
            encounters = [e for e in encounters if e.pid == patient_id]
        return encounters

    def get_encounter(self, encounter_id: str) -> Optional[OpenEMREncounter]:
        """Get an encounter by ID."""
        return self._encounters.get(encounter_id)

    def create_encounter(self, data: Dict[str, Any]) -> OpenEMREncounter:
        """Create a new clinical encounter."""
        enc_id = data.get("id") or f"enc-{len(self._encounters) + 1:02d}"
        seq = data.get("encounter") or str(5000 + len(self._encounters) + 1)
        encounter = OpenEMREncounter(
            id=enc_id,
            encounter=seq,
            pid=data["pid"],
            date=datetime.now(timezone.utc),
            reason=data["reason"],
            provider_id=data["provider_id"],
            provider_name=data.get("provider_name", "Attending Physician"),
            facility_name=data.get("facility_name", "Main Medical Center"),
            clinical_notes=data.get("clinical_notes"),
        )
        self._encounters[enc_id] = encounter
        logger.info("openemr_encounter_created", encounter_id=enc_id, patient_id=encounter.pid)
        return encounter

    # ─────────────────────────────────────────────────────────────
    # Procedure Orders & Radiology Worklist (procedure_order table)
    # ─────────────────────────────────────────────────────────────

    def list_orders(
        self,
        status: Optional[str] = None,
        modality: Optional[str] = None,
        patient_id: Optional[str] = None,
    ) -> List[OpenEMRProcedureOrder]:
        """List procedure orders with filtering for the radiology worklist."""
        orders = list(self._orders.values())
        if status:
            orders = [o for o in orders if o.order_status.value == status]
        if modality:
            orders = [o for o in orders if o.modality.upper() == modality.upper()]
        if patient_id:
            orders = [o for o in orders if o.patient_id == patient_id]
        return orders

    def get_order(self, order_id: str) -> Optional[OpenEMRProcedureOrder]:
        """Get an order by ID."""
        return self._orders.get(order_id)

    def create_order(self, data: Dict[str, Any]) -> OpenEMRProcedureOrder:
        """Place an imaging procedure order in OpenEMR."""
        order_id = data.get("procedure_order_id") or f"ord-{7000 + len(self._orders) + 1}"
        patient = self.get_patient(data["patient_id"])
        patient_name = patient.full_name if patient else data.get("patient_name", "Unknown Patient")
        patient_mrn = patient.pubpid if patient else data.get("patient_mrn", "MRN-UNKNOWN")

        order = OpenEMRProcedureOrder(
            procedure_order_id=order_id,
            provider_id=data["provider_id"],
            provider_name=data.get("provider_name", "Ordering Physician"),
            patient_id=data["patient_id"],
            patient_name=patient_name,
            patient_mrn=patient_mrn,
            encounter_id=data.get("encounter_id", "enc-01"),
            date_ordered=datetime.now(timezone.utc),
            procedure_code=data["procedure_code"],
            procedure_name=data["procedure_name"],
            modality=data["modality"],
            order_priority=OrderPriority(data.get("order_priority", "routine")),
            order_status=OrderStatus.PENDING,
            clinical_notes=data.get("clinical_notes", ""),
            patient_history=data.get("patient_history", ""),
        )
        self._orders[order_id] = order
        self._save_order_to_db(order)
        logger.info("openemr_order_created", order_id=order_id, code=order.procedure_code)
        return order

    def link_job_to_order(
        self,
        procedure_order_id: str,
        job_id: str,
        dicom_study_instance_uid: Optional[str] = None,
    ) -> Optional[OpenEMRProcedureOrder]:
        """Link an asynchronous MiPAAS AI processing job to an OpenEMR procedure order."""
        order = self.get_order(procedure_order_id)
        if not order:
            return None
        order.linked_job_id = job_id
        order.dicom_study_instance_uid = dicom_study_instance_uid
        order.order_status = OrderStatus.IN_PROCESS
        logger.info("openemr_order_linked_to_job", order_id=procedure_order_id, job_id=job_id)
        return order

    # ─────────────────────────────────────────────────────────────
    # Procedure Reports & AI Results (procedure_report table)
    # ─────────────────────────────────────────────────────────────

    def file_diagnostic_report(
        self,
        procedure_order_id: str,
        report_notes: str,
        ai_prediction_summary: Dict[str, Any],
        signed_by_provider_id: str,
        signed_by_provider_name: str,
        gradcam_heatmap_url: Optional[str] = None,
        dicom_study_instance_uid: Optional[str] = None,
    ) -> OpenEMRProcedureReport:
        """File and finalize an AI diagnostic report in OpenEMR.
        
        This completes the loop:
        1. Creates procedure_report in OpenEMR
        2. Transitions procedure_order status to COMPLETE
        3. Records timestamp and digital signature
        """
        report_id = f"rep-{len(self._reports) + 1:04d}"
        now = datetime.now(timezone.utc)

        report = OpenEMRProcedureReport(
            procedure_report_id=report_id,
            procedure_order_id=procedure_order_id,
            date_report=now,
            report_status=ReportStatus.FINAL,
            report_notes=report_notes,
            ai_prediction_summary=ai_prediction_summary,
            gradcam_heatmap_url=gradcam_heatmap_url,
            dicom_study_instance_uid=dicom_study_instance_uid,
            signed_by_provider_id=signed_by_provider_id,
            signed_by_provider_name=signed_by_provider_name,
            signed_at=now,
        )
        self._reports[report_id] = report
        self._save_report_to_db(report)

        # Update order status
        order = self.get_order(procedure_order_id)
        if order:
            order.order_status = OrderStatus.COMPLETE

        logger.info(
            "openemr_diagnostic_report_finalized",
            report_id=report_id,
            order_id=procedure_order_id,
            signed_by=signed_by_provider_name,
        )
        return report

    def get_report(self, report_id: str) -> Optional[OpenEMRProcedureReport]:
        """Get a diagnostic report by ID."""
        return self._reports.get(report_id)

    def get_report_for_order(self, order_id: str) -> Optional[OpenEMRProcedureReport]:
        """Get the report attached to a specific order."""
        for r in self._reports.values():
            if r.procedure_order_id == order_id:
                return r
        return None


# Global singleton instance
_openemr_service: Optional[OpenEMRManagementService] = None


def get_openemr_service() -> OpenEMRManagementService:
    """Get or create singleton instance of OpenEMRManagementService."""
    global _openemr_service
    if _openemr_service is None:
        _openemr_service = OpenEMRManagementService()
    return _openemr_service
