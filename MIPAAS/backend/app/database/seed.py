"""
Central Database Seed Script for MiPAAS.

Populates initial production-grade data for:
- IAM Roles and Clinical Personas
- OpenEMR Master Patient Index (MPI), Providers, Encounters, and Orders
- Eka.care ABHA Family Graph, Medications, Vitals, Locker Records, and Appointments
- Diagnostic DICOM Studies and AI Pipeline Jobs
"""

from datetime import datetime, timezone, timedelta
import json
import structlog

from app.database.models import (
    AgentWorkflowRun,
    AuditLog,
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
    VitalRecord,
)
from app.database.session import get_db

logger = structlog.get_logger()


def seed_database(overwrite: bool = False) -> dict:
    """Seed central database with standard initial data.

    Args:
        overwrite: If True, clears existing records in target tables first.

    Returns:
        Summary counts of seeded records.
    """
    now = datetime.now(timezone.utc)
    seeded_counts = {}

    with get_db() as db:
        # Check if already seeded and overwrite is False
        user_count = db.query(User).count()
        if user_count > 0 and not overwrite:
            logger.info("database_already_seeded", user_count=user_count)
            return {"status": "skipped", "message": "Database already contains data."}

        # ─────────────────────────────────────────────────────────────
        # 1. IAM Roles & System Users
        # ─────────────────────────────────────────────────────────────
        roles_data = [
            ("admin", "Hospital Administrator", "Full administrative control over users, config, and audit logs"),
            ("radiologist", "Consultant Radiologist", "Review imaging studies, sign diagnostic reports, evaluate AI"),
            ("technician", "Imaging Technician", "Upload DICOM studies, register patients, queue processing jobs"),
            ("researcher", "Medical AI Researcher", "Evaluate feature attributions, run benchmark pipelines"),
            ("auditor", "Compliance Auditor", "Read-only review of system activities, access events, and HIPAA logs"),
        ]
        for name, title, desc in roles_data:
            existing = db.query(Role).filter_by(name=name).first()
            if not existing:
                db.add(Role(id=f"role_{name}", name=name, title=title, description=desc, is_system=True))

        users_data = [
            User(
                id="admin-01",
                username="arthur.davis",
                email="arthur.davis@mipaas.health",
                first_name="Arthur",
                last_name="Davis",
                role="admin",
                department="Hospital IT & Operations",
                organization="MiPAAS Health System",
            ),
            User(
                id="rad-01",
                username="elena.vance",
                email="elena.vance@mipaas.health",
                first_name="Elena",
                last_name="Vance",
                role="radiologist",
                department="Diagnostic Radiology",
                organization="Memorial Diagnostic Pavilion",
            ),
            User(
                id="rad-02",
                username="marcus.chen",
                email="marcus.chen@mipaas.health",
                first_name="Marcus",
                last_name="Chen",
                role="radiologist",
                department="Neuroradiology",
                organization="Comprehensive Stroke Center",
            ),
            User(
                id="tech-01",
                username="sarah.lin",
                email="sarah.lin@mipaas.health",
                first_name="Sarah",
                last_name="Lin",
                role="technician",
                department="Radiology Operations",
                organization="Outpatient Imaging Suites",
            ),
            User(
                id="user-yatharth",
                username="yatharth.sharma",
                email="yatharth@eka.care",
                first_name="Yatharth",
                last_name="Sharma",
                role="patient",
                department="Consumer Health",
                organization="Eka.care Health Network",
            ),
        ]
        for u in users_data:
            if not db.query(User).filter_by(id=u.id).first():
                db.add(u)
        db.flush()
        seeded_counts["users"] = len(users_data)

        # ─────────────────────────────────────────────────────────────
        # 2. Clinical Providers (OpenEMR Directory)
        # ─────────────────────────────────────────────────────────────
        providers_data = [
            ClinicalProvider(
                id="emr-user-01",
                user_id="rad-01",
                username="elena.vance",
                fname="Elena",
                lname="Vance",
                email="elena.vance@mipaas.health",
                npi="1942058192",
                specialty="Thoracic & Diagnostic Radiology",
                title="Dr.",
                phone="+1 (555) 234-5678",
                facility_name="Memorial Diagnostic Pavilion",
                role_mapping="radiologist",
            ),
            ClinicalProvider(
                id="emr-user-02",
                user_id="rad-02",
                username="marcus.chen",
                fname="Marcus",
                lname="Chen",
                email="marcus.chen@mipaas.health",
                npi="1083920194",
                specialty="Interventional Neuroradiology",
                title="Dr.",
                phone="+1 (555) 345-6789",
                facility_name="Comprehensive Stroke Center",
                role_mapping="radiologist",
            ),
            ClinicalProvider(
                id="emr-user-03",
                user_id="admin-01",
                username="arthur.davis",
                fname="Arthur",
                lname="Davis",
                email="arthur.davis@mipaas.health",
                npi="1492019284",
                specialty="Health Informatics & Administration",
                title="Mr.",
                phone="+1 (555) 456-7890",
                facility_name="Main Medical Center",
                role_mapping="admin",
            ),
            ClinicalProvider(
                id="emr-user-04",
                user_id="tech-01",
                username="sarah.lin",
                fname="Sarah",
                lname="Lin",
                email="sarah.lin@mipaas.health",
                npi="1839201948",
                specialty="Advanced Diagnostic Radiologic Technology",
                title="Ms.",
                phone="+1 (555) 567-8901",
                facility_name="Outpatient Imaging Suites",
                role_mapping="technician",
            ),
        ]
        for p in providers_data:
            if not db.query(ClinicalProvider).filter_by(id=p.id).first():
                db.add(p)
        db.flush()
        seeded_counts["providers"] = len(providers_data)

        # ─────────────────────────────────────────────────────────────
        # 3. Master Patient Index (OpenEMR Patients)
        # ─────────────────────────────────────────────────────────────
        patients_data = [
            ClinicalPatient(
                id="emr-pt-01",
                mrn="MRN-100291",
                fname="John",
                lname="Doe",
                dob="1978-04-12",
                gender="Male",
                blood_group="O+",
                phone="+1 (555) 123-4567",
                email="john.doe@example.com",
                street="742 Evergreen Terrace",
                city="Springfield",
                state="OR",
                postal_code="97477",
                insurance_provider="BlueCross BlueShield Comprehensive",
                insurance_id="BCBS-99482104",
                allergies_json=json.dumps(["Penicillin", "Intravenous Contrast (mild flush)"]),
                conditions_json=json.dumps(["Solitary Pulmonary Nodule", "Essential Hypertension"]),
                abha_id="91-8842-1940-2219",
            ),
            ClinicalPatient(
                id="emr-pt-02",
                mrn="MRN-100292",
                fname="Maria",
                lname="Garcia",
                dob="1965-09-23",
                gender="Female",
                blood_group="A+",
                phone="+1 (555) 234-5678",
                email="maria.garcia@example.com",
                street="128 Paseo de Gracia",
                city="San Jose",
                state="CA",
                postal_code="95113",
                insurance_provider="Kaiser Permanente Senior Advantage",
                insurance_id="KP-48291039",
                allergies_json=json.dumps(["Sulfa drugs"]),
                conditions_json=json.dumps(["Acute Ischemic Stroke workup", "Atrial Fibrillation"]),
                abha_id="91-7731-9021-4410",
            ),
            ClinicalPatient(
                id="emr-pt-03",
                mrn="MRN-100293",
                fname="Robert",
                lname="Taylor",
                dob="1982-11-05",
                gender="Male",
                blood_group="B+",
                phone="+1 (555) 345-6789",
                email="robert.taylor@example.com",
                street="45 Beacon Street",
                city="Boston",
                state="MA",
                postal_code="02108",
                insurance_provider="Aetna Choice POS II",
                insurance_id="AET-84920194",
                allergies_json=json.dumps([]),
                conditions_json=json.dumps(["Persistent Headache", "Suspected Glioblastoma"]),
                abha_id="91-4420-1193-8822",
            ),
        ]
        for pt in patients_data:
            if not db.query(ClinicalPatient).filter_by(id=pt.id).first():
                db.add(pt)
        db.flush()
        seeded_counts["patients"] = len(patients_data)

        # ─────────────────────────────────────────────────────────────
        # 4. Clinical Encounters (SOAP Notes)
        # ─────────────────────────────────────────────────────────────
        encounters_data = [
            ClinicalEncounter(
                id="emr-enc-01",
                patient_id="emr-pt-01",
                provider_id="emr-user-01",
                encounter_date=now - timedelta(days=2),
                encounter_type="diagnostic_imaging",
                facility_name="Memorial Diagnostic Pavilion",
                reason_for_visit="Low-Dose Chest CT for indeterminate solitary pulmonary nodule",
                status="completed",
                subjective="48 y/o male with history of 15 pack-year smoking history. Reports mild non-productive cough.",
                objective="Vital signs stable. Prior radiograph noted 1.2 cm opacity in right upper lobe.",
                assessment="Indeterminate solitary pulmonary nodule RUL. Correlates with Sybil lung risk model.",
                plan="Diagnostic LDCT completed. AI analysis initiated. Review findings in multidisciplinary board.",
            ),
            ClinicalEncounter(
                id="emr-enc-02",
                patient_id="emr-pt-02",
                provider_id="emr-user-02",
                encounter_date=now - timedelta(days=1),
                encounter_type="emergency_diagnostic",
                facility_name="Comprehensive Stroke Center",
                reason_for_visit="Emergency Non-Contrast Brain CT for acute focal neurological deficit",
                status="completed",
                subjective="61 y/o female presented with sudden-onset left facial droop and right arm weakness.",
                objective="NIHSS score 9. Non-contrast head CT acquired within 22 minutes of door time.",
                assessment="Early ischemic changes in right MCA territory. Dense MCA sign noted.",
                plan="Rapid CT perfusion requested. Automated LVO detection alert triggered.",
            ),
        ]
        for enc in encounters_data:
            if not db.query(ClinicalEncounter).filter_by(id=enc.id).first():
                db.add(enc)
        db.flush()
        seeded_counts["encounters"] = len(encounters_data)

        # ─────────────────────────────────────────────────────────────
        # 5. Procedure Orders & Reports
        # ─────────────────────────────────────────────────────────────
        orders_data = [
            ProcedureOrder(
                id="emr-ord-01",
                order_number="ORD-2026-001",
                patient_id="emr-pt-01",
                encounter_id="emr-enc-01",
                ordering_provider_id="emr-user-01",
                procedure_code="71250",
                procedure_name="CT Chest without Contrast (Diagnostic Screening)",
                modality="CT",
                body_site="Chest / Thorax",
                clinical_indication="Solitary pulmonary nodule follow-up, RUL",
                priority="urgent",
                status="completed",
                order_date=now - timedelta(days=2),
                linked_job_id="job_demo_chest_01",
                accession_number="ACC-992019",
            ),
            ProcedureOrder(
                id="emr-ord-02",
                order_number="ORD-2026-002",
                patient_id="emr-pt-02",
                encounter_id="emr-enc-02",
                ordering_provider_id="emr-user-02",
                procedure_code="70450",
                procedure_name="CT Head / Brain without Contrast",
                modality="CT",
                body_site="Head / Brain",
                clinical_indication="Suspected acute ischemic stroke, LVO alert protocol",
                priority="stat",
                status="completed",
                order_date=now - timedelta(days=1),
                linked_job_id="job_demo_stroke_02",
                accession_number="ACC-992020",
            ),
        ]
        for ord_obj in orders_data:
            if not db.query(ProcedureOrder).filter_by(id=ord_obj.id).first():
                db.add(ord_obj)
        db.flush()
        seeded_counts["procedure_orders"] = len(orders_data)

        reports_data = [
            ProcedureReport(
                id="emr-rep-01",
                report_number="REP-2026-001",
                order_id="emr-ord-01",
                patient_id="emr-pt-01",
                radiologist_id="emr-user-01",
                status="final",
                findings="12 mm solid spiculated nodule in the anterior segment of the right upper lobe. No pleural effusion or mediastinal lymphadenopathy.",
                impression="Solitary 12 mm RUL nodule, suspicious for primary bronchogenic malignancy. Sybil AI 1-year malignancy score: 0.78.",
                recommendations="Recommend PET-CT and CT-guided transthoracic needle biopsy.",
                bi_rads_score="Lung-RADS 4B",
                critical_findings_alert=True,
                signed_by="Dr. Elena Vance, MD",
                signed_at=now - timedelta(days=1),
                signature_hash="sha256:4a8b9f10c2e3d4...",
            ),
        ]
        for rep in reports_data:
            if not db.query(ProcedureReport).filter_by(id=rep.id).first():
                db.add(rep)
        db.flush()
        seeded_counts["procedure_reports"] = len(reports_data)

        # ─────────────────────────────────────────────────────────────
        # 6. Eka.care Family Graph & Health Hub
        # ─────────────────────────────────────────────────────────────
        members_data = [
            FamilyMember(
                id="fam_1",
                user_id="user-yatharth",
                name="Yatharth Sharma",
                relation="Self",
                age=32,
                gender="Male",
                abha_id="91-8842-1940-2219",
                blood_group="O+",
                avatar_color="from-teal-500 to-emerald-600",
                primary_condition="Preventive Health & Vital Optimization",
            ),
            FamilyMember(
                id="fam_2",
                user_id="user-yatharth",
                name="Priya Sharma",
                relation="Spouse",
                age=30,
                gender="Female",
                abha_id="91-7731-9021-4410",
                blood_group="B+",
                avatar_color="from-purple-500 to-indigo-600",
                primary_condition="Prenatal & Metabolic Care",
            ),
            FamilyMember(
                id="fam_3",
                user_id="user-yatharth",
                name="Ramesh Sharma",
                relation="Father",
                age=64,
                gender="Male",
                abha_id="91-4420-1193-8822",
                blood_group="O+",
                avatar_color="from-amber-500 to-orange-600",
                primary_condition="Type 2 Diabetes & Hypertension",
            ),
            FamilyMember(
                id="fam_4",
                user_id="user-yatharth",
                name="Sunita Sharma",
                relation="Mother",
                age=60,
                gender="Female",
                abha_id="91-3319-8472-0019",
                blood_group="A+",
                avatar_color="from-rose-500 to-pink-600",
                primary_condition="Osteoarthritis & Thyroid Care",
            ),
        ]
        for fam in members_data:
            if not db.query(FamilyMember).filter_by(id=fam.id).first():
                db.add(fam)
        db.flush()
        seeded_counts["family_members"] = len(members_data)

        # ─────────────────────────────────────────────────────────────
        # 7. Eka.care Medications
        # ─────────────────────────────────────────────────────────────
        meds_data = [
            Medication(
                id="med_1",
                member_id="fam_1",
                name="Metformin 500mg",
                dosage="1 Tablet",
                frequency="Twice daily",
                timing="Morning",
                instruction="After Food",
                prescribed_by="Dr. Anurag Verma",
                refill_days_left=6,
                time_slot="08:00 AM",
                taken_today=True,
            ),
            Medication(
                id="med_2",
                member_id="fam_1",
                name="Telmisartan 40mg",
                dosage="1 Tablet",
                frequency="Once daily",
                timing="Morning",
                instruction="After Food",
                prescribed_by="Dr. Anurag Verma",
                refill_days_left=18,
                time_slot="08:30 AM",
                taken_today=True,
            ),
            Medication(
                id="med_3",
                member_id="fam_1",
                name="Vitamin D3 60K IU",
                dosage="1 Capsule",
                frequency="Weekly",
                timing="Morning",
                instruction="With Food",
                prescribed_by="Dr. Meera Nambiar",
                refill_days_left=22,
                time_slot="09:00 AM",
                taken_today=True,
            ),
            Medication(
                id="med_4",
                member_id="fam_1",
                name="Atorvastatin 10mg",
                dosage="1 Tablet",
                frequency="Once daily (Night)",
                timing="Night",
                instruction="After Food",
                prescribed_by="Dr. Anurag Verma",
                refill_days_left=14,
                time_slot="09:30 PM",
                taken_today=False,
            ),
        ]
        for med in meds_data:
            if not db.query(Medication).filter_by(id=med.id).first():
                db.add(med)
        db.flush()
        seeded_counts["medications"] = len(meds_data)

        # ─────────────────────────────────────────────────────────────
        # 8. Eka.care Vitals
        # ─────────────────────────────────────────────────────────────
        vitals_data = [
            VitalRecord(
                id="vit_1",
                member_id="fam_1",
                vital_type="Blood Pressure",
                value="122 / 80",
                unit="mmHg",
                status="Normal",
                recorded_at="Today, 08:15 AM",
                trend="stable",
                target_range="< 120/80 mmHg",
            ),
            VitalRecord(
                id="vit_2",
                member_id="fam_1",
                vital_type="Blood Sugar (Fasting)",
                value="104",
                unit="mg/dL",
                status="Normal",
                recorded_at="Today, 07:45 AM",
                trend="down",
                target_range="70 - 100 mg/dL",
            ),
            VitalRecord(
                id="vit_3",
                member_id="fam_1",
                vital_type="Heart Rate",
                value="72",
                unit="BPM",
                status="Optimal",
                recorded_at="Today, 08:15 AM",
                trend="stable",
                target_range="60 - 100 BPM",
            ),
            VitalRecord(
                id="vit_4",
                member_id="fam_1",
                vital_type="SpO2",
                value="99",
                unit="%",
                status="Optimal",
                recorded_at="Today, 08:15 AM",
                trend="stable",
                target_range="95 - 100 %",
            ),
            VitalRecord(
                id="vit_5",
                member_id="fam_1",
                vital_type="Weight & BMI",
                value="71.5 kg (BMI 22.8)",
                unit="kg",
                status="Normal",
                recorded_at="11 Oct 2026",
                trend="down",
                target_range="18.5 - 24.9 BMI",
            ),
            VitalRecord(
                id="vit_6",
                member_id="fam_1",
                vital_type="Body Temp",
                value="98.4",
                unit="°F",
                status="Normal",
                recorded_at="Today, 08:15 AM",
                trend="stable",
                target_range="97.0 - 99.0 °F",
            ),
        ]
        for v in vitals_data:
            if not db.query(VitalRecord).filter_by(id=v.id).first():
                db.add(v)
        db.flush()
        seeded_counts["vitals"] = len(vitals_data)

        # ─────────────────────────────────────────────────────────────
        # 9. Eka.care Health Locker Records
        # ─────────────────────────────────────────────────────────────
        records_data = [
            HealthRecord(
                id="rec_1",
                member_id="fam_1",
                title="Comprehensive Metabolic & Lipid Panel",
                category="Lab Reports",
                doctor_or_lab="Max PathLabs · Dr. Lal Reference",
                record_date="10 Oct 2026",
                file_type="PDF",
                file_size="1.4 MB",
                ai_key_summary="HbA1c 5.6% within optimal range (<5.7%). Fasting blood sugar 104 mg/dL. Total cholesterol at 178 mg/dL with healthy HDL/LDL ratio.",
                tags_json=json.dumps(["Lipid", "Metabolic", "Diabetes Screen"]),
                extracted_parameters_json=json.dumps([
                    {"name": "HbA1c", "value": "5.6", "unit": "%", "flag": "Normal"},
                    {"name": "Fasting Glucose", "value": "104", "unit": "mg/dL", "flag": "Normal"},
                    {"name": "Total Cholesterol", "value": "178", "unit": "mg/dL", "flag": "Normal"},
                    {"name": "Triglycerides", "value": "142", "unit": "mg/dL", "flag": "Normal"},
                    {"name": "Creatinine", "value": "0.9", "unit": "mg/dL", "flag": "Normal"},
                ]),
            ),
            HealthRecord(
                id="rec_2",
                member_id="fam_1",
                title="Cardiology Follow-Up Consultation Rx",
                category="Prescriptions",
                doctor_or_lab="Dr. Anurag Verma · Apollo Hospital",
                record_date="28 Sep 2026",
                file_type="PDF",
                file_size="840 KB",
                ai_key_summary="Prescribed Telmisartan 40mg (AM) and Atorvastatin 10mg (PM). Advised 30 mins aerobic walking 5 days/week. Follow-up scheduled in 3 months.",
                tags_json=json.dumps(["Cardiology", "Prescription", "Dr. Verma"]),
                extracted_parameters_json=json.dumps([
                    {"name": "Systolic BP", "value": "124", "unit": "mmHg", "flag": "Normal"},
                    {"name": "Diastolic BP", "value": "82", "unit": "mmHg", "flag": "Normal"},
                ]),
            ),
            HealthRecord(
                id="rec_3",
                member_id="fam_1",
                title="Chest Radiograph (PA View) Digital Study",
                category="Scans & Imaging",
                doctor_or_lab="Metro Radiology Center · Dr. S. K. Gupta",
                record_date="15 Sep 2026",
                file_type="DICOM / PDF",
                file_size="4.2 MB",
                ai_key_summary="Bilateral lung fields clear. No focal consolidation, pneumothorax, or pleural effusion detected. Cardiothoracic ratio normal (< 0.50).",
                tags_json=json.dumps(["CXR", "Radiology", "AI Checked"]),
            ),
            HealthRecord(
                id="rec_4",
                member_id="fam_1",
                title="Complete Blood Count (CBC) Routine",
                category="Lab Reports",
                doctor_or_lab="Thyrocare National Diagnostics",
                record_date="12 Aug 2026",
                file_type="PDF",
                file_size="920 KB",
                ai_key_summary="Hemoglobin at 14.8 g/dL (optimal). Platelet count 240,000 /µL. Total WBC count 6,800 /µL without left shift.",
                tags_json=json.dumps(["CBC", "Hemogram"]),
                extracted_parameters_json=json.dumps([
                    {"name": "Hemoglobin", "value": "14.8", "unit": "g/dL", "flag": "Normal"},
                    {"name": "Platelets", "value": "240,000", "unit": "/µL", "flag": "Normal"},
                    {"name": "WBC Count", "value": "6,800", "unit": "/µL", "flag": "Normal"},
                ]),
            ),
            HealthRecord(
                id="rec_5",
                member_id="fam_1",
                title="COVID-19 Booster Vaccination Certificate",
                category="Vaccinations",
                doctor_or_lab="CoWIN / Ministry of Health & Family Welfare",
                record_date="22 Apr 2025",
                file_type="PDF",
                file_size="410 KB",
                ai_key_summary="Corbevax Precautionary Dose administered. Beneficiary ABHA linked and verified.",
                tags_json=json.dumps(["Vaccine", "CoWIN", "Verified"]),
            ),
        ]
        for r in records_data:
            if not db.query(HealthRecord).filter_by(id=r.id).first():
                db.add(r)
        db.flush()
        seeded_counts["health_records"] = len(records_data)

        # ─────────────────────────────────────────────────────────────
        # 10. Eka.care Appointments
        # ─────────────────────────────────────────────────────────────
        apts_data = [
            ConsumerAppointment(
                id="apt_1",
                member_id="fam_1",
                doctor_name="Dr. Anurag Verma",
                specialty="Senior Interventional Cardiologist",
                hospital="Apollo Heart Institute, Room 204",
                appointment_date="Tomorrow, 14 Oct 2026",
                appointment_time="10:30 AM",
                token_number=14,
                appointment_type="In-Clinic",
                status="Confirmed",
                queue_wait_mins=15,
            ),
            ConsumerAppointment(
                id="apt_2",
                member_id="fam_1",
                doctor_name="Dr. Meera Nambiar",
                specialty="General Physician & Metabolic Specialist",
                hospital="Eka Care Telemedicine Portal",
                appointment_date="Fri, 24 Oct 2026",
                appointment_time="05:00 PM",
                token_number=5,
                appointment_type="Video Teleconsult",
                status="Confirmed",
                queue_wait_mins=0,
            ),
        ]
        for a in apts_data:
            if not db.query(ConsumerAppointment).filter_by(id=a.id).first():
                db.add(a)
        db.flush()
        seeded_counts["appointments"] = len(apts_data)

        # ─────────────────────────────────────────────────────────────
        # 11. DICOM Study & Diagnostic Job
        # ─────────────────────────────────────────────────────────────
        demo_study = DicomStudy(
            id="study_demo_01",
            patient_id="emr-pt-01",
            study_instance_uid="1.2.840.113619.2.55.3.2819284.10291.992019",
            study_date="20261012",
            accession_number="ACC-992019",
            modality="CT",
            study_description="Low Dose CT Chest with Sybil AI Screening",
            num_series=1,
            num_instances=128,
            patient_age="048Y",
            patient_gender="M",
        )
        if not db.query(DicomStudy).filter_by(id=demo_study.id).first():
            db.add(demo_study)
            db.flush()

            demo_series = DicomSeries(
                id="series_demo_01",
                study_id=demo_study.id,
                series_instance_uid="1.2.840.113619.2.55.3.2819284.10291.992019.1",
                series_number=1,
                modality="CT",
                series_description="Axial 1.25mm Lung Reconstructions",
                num_instances=128,
                slice_thickness=1.25,
                pixel_spacing_x=0.68,
                pixel_spacing_y=0.68,
                gcs_uri="gs://mipaas-dev-data/processed/job_demo_chest_01/volume.npy",
            )
            db.add(demo_series)

            demo_job = DiagnosticJob(
                id="job_demo_chest_01",
                user_id="rad-01",
                patient_id="emr-pt-01",
                study_id=demo_study.id,
                disease_id="lung_cancer",
                model_name="sybil",
                modality="CT",
                status="complete",
                progress_pct=100,
                input_gcs_uri="gs://mipaas-dev-data/raw/rad-01/job_demo_chest_01/",
                preprocessed_uri="gs://mipaas-dev-data/processed/job_demo_chest_01/volume.npy",
                predictions_json=json.dumps({
                    "predicted_class": "malignant_risk_elevated",
                    "confidence": 0.78,
                    "probabilities": {"benign": 0.22, "malignant_risk_elevated": 0.78},
                }),
                xai_json=json.dumps({
                    "gradcam_uri": "gs://mipaas-dev-data/xai/job_demo_chest_01/heatmap_gradcam.npy",
                    "overlay_uris": [
                        "gs://mipaas-dev-data/xai/job_demo_chest_01/overlays/axial_064.png",
                    ],
                }),
            )
            db.add(demo_job)
            db.flush()

            # Seed agent run log
            agent_run = AgentWorkflowRun(
                id="run_agent_01",
                job_id=demo_job.id,
                agent_id="intake_quality",
                agent_name="Agent 1: DICOM Intake Quality Evaluator",
                step_order=1,
                status="completed",
                execution_time_ms=180,
                inputs_json=json.dumps({"slices": 128, "thickness_mm": 1.25, "modality": "CT"}),
                outputs_json=json.dumps({"qa_status": "PASSED", "artifacts_detected": False}),
                logs_json=json.dumps(["Slice thickness 1.25mm meets isotropic standard", "Pixel intensity checked"]),
            )
            db.add(agent_run)
            seeded_counts["dicom_studies"] = 1
            seeded_counts["diagnostic_jobs"] = 1

        # Audit log for the seed action
        audit = AuditLog(
            id="audit_seed_init",
            username="system.init",
            action="database:seed",
            resource_type="system",
            resource_id="central_database",
            status="success",
            details_json=json.dumps(seeded_counts),
        )
        db.add(audit)

    logger.info("database_seeded_successfully", counts=seeded_counts)
    return {"status": "success", "counts": seeded_counts}
