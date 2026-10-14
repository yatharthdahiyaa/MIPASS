# MiPAAS Central Database

Centralized, multi-tenant relational database for **MiPAAS (Medical Image Processing As A Software Service)**.

Unifies data persistence across:
1. **IAM & Role-Based Access Control** (Users, Roles, Sessions, HIPAA Audit Logs)
2. **Clinical Management & OpenEMR** (Master Patient Index, Providers, Encounters with SOAP notes, Procedure Orders, Diagnostic Reports)
3. **Consumer Health & Eka.care Hub** (ABDM Family Graphs, ABHA IDs, Medications & Adherence, Vitals, Encrypted Locker Records, Teleconsult Appointments)
4. **Diagnostic Imaging & 9 Clinical AI Agents** (DICOM Studies & Series, Async Inference Jobs, Grad-CAM++ Overlays, Pipeline Audit Runs)

---

## 📁 Folder Structure

```
database/
├── docker-compose.db.yml     # Standalone Docker stack (PostgreSQL 16 + Adminer GUI)
├── init_db.py                # Database initialization & table generation CLI
├── seed.py                   # Production baseline data seeding CLI
├── schema.sql                # Raw SQL DDL schema (PostgreSQL 16 / ANSI SQL)
├── session.py                # SQLAlchemy 2.0 engine, connection pool, WAL mode, get_db()
├── README.md                 # Documentation and operations guide
└── models/
    ├── __init__.py           # Export all ORM models
    ├── base.py               # Declarative Base, UUID generator & TimestampMixin
    ├── iam.py                # User, Role, UserSession, AuditLog
    ├── clinical.py           # ClinicalProvider, ClinicalPatient, ClinicalEncounter, ProcedureOrder, ProcedureReport
    ├── consumer_health.py    # FamilyMember, Medication, VitalRecord, HealthRecord, ConsumerAppointment
    └── imaging_ai.py         # DicomStudy, DicomSeries, DiagnosticJob, AgentWorkflowRun
```

---

## 🚀 Quick Start

### 1. Local Development (Zero-Config SQLite)
By default, the database runs automatically on SQLite with WAL mode enabled:
```bash
# Initialize all 18 tables
python database/init_db.py

# Initialize and seed with baseline clinical records
python database/init_db.py --seed

# Inspect live table row counts
python database/init_db.py --stats

# Run quick connection health check
python database/init_db.py --health
```

### 2. Standalone Docker Stack (PostgreSQL 16 + Adminer GUI)
Spin up PostgreSQL and the Adminer web management interface:
```bash
docker compose -f database/docker-compose.db.yml up -d
```
- **PostgreSQL**: `localhost:5432` (`user: mipaas`, `password: mipaas_dev_pass`, `db: mipaas_central`)
- **Adminer Web GUI**: [http://localhost:8088](http://localhost:8088)

### 3. Environment Variables
Add to `.env` or system environment:
```env
# PostgreSQL in Docker / Cloud SQL / Supabase:
DATABASE_URL=postgresql://mipaas:mipaas_dev_pass@localhost:5432/mipaas_central

# Or SQLite:
# DATABASE_URL=sqlite:///database/mipaas_central.db

DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20
DATABASE_AUTO_SEED=true
```

---

## 📊 Database Schema Index (18 Tables)

| Domain | Table Name | Purpose | Key Columns |
|--------|------------|---------|-------------|
| **IAM** | `users` | User credentials & roles | `id`, `username`, `email`, `role`, `department`, `is_active` |
| **IAM** | `roles` | RBAC role definitions | `id`, `name`, `title`, `permissions_json` |
| **IAM** | `user_sessions` | Authentication tokens | `id`, `user_id`, `token_hash`, `expires_at` |
| **IAM** | `audit_logs` | HIPAA access audit trail | `id`, `user_id`, `action`, `resource_type`, `status`, `details_json` |
| **Clinical** | `clinical_providers` | Clinicians & Radiologists | `id`, `npi`, `fname`, `lname`, `specialty`, `facility_name` |
| **Clinical** | `clinical_patients` | Master Patient Index (MPI) | `id`, `mrn`, `fname`, `lname`, `dob`, `gender`, `abha_id` |
| **Clinical** | `clinical_encounters` | Visits & SOAP Notes | `id`, `patient_id`, `provider_id`, `subjective`, `objective`, `assessment`, `plan` |
| **Clinical** | `procedure_orders` | Imaging procedure orders | `id`, `order_number`, `patient_id`, `modality`, `priority`, `status`, `linked_job_id` |
| **Clinical** | `procedure_reports` | Signed diagnostic reports | `id`, `report_number`, `order_id`, `findings`, `impression`, `bi_rads_score`, `signed_by` |
| **Consumer** | `family_members` | Eka.care family graph | `id`, `name`, `relation`, `age`, `abha_id`, `blood_group` |
| **Consumer** | `medications` | Medication schedule | `id`, `member_id`, `name`, `dosage`, `frequency`, `taken_today`, `refill_days_left` |
| **Consumer** | `vital_records` | Patient vitals | `id`, `member_id`, `vital_type`, `value`, `unit`, `status`, `recorded_at` |
| **Consumer** | `health_records` | Encrypted health locker | `id`, `member_id`, `title`, `category`, `doctor_or_lab`, `ai_key_summary`, `tags_json` |
| **Consumer** | `consumer_appointments` | OPD & teleconsult visits | `id`, `member_id`, `doctor_name`, `date`, `time`, `token_number`, `status` |
| **Imaging AI** | `dicom_studies` | DICOM studies | `id`, `study_instance_uid`, `patient_id`, `modality`, `num_instances` |
| **Imaging AI** | `dicom_series` | DICOM series | `id`, `study_id`, `series_instance_uid`, `slice_thickness`, `gcs_uri` |
| **Imaging AI** | `diagnostic_jobs` | Asynchronous ML jobs | `id`, `disease_id`, `model_name`, `status`, `progress_pct`, `predictions_json` |
| **Imaging AI** | `agent_workflow_runs` | 9 Clinical AI agent logs | `id`, `job_id`, `agent_id`, `agent_name`, `status`, `execution_time_ms`, `outputs_json` |

---

## 💻 Python Code Usage

```python
from database import get_db, ClinicalPatient, ProcedureOrder

# Query records
with get_db() as db:
    patients = db.query(ClinicalPatient).filter_by(gender="Male").all()
    for pt in patients:
        print(pt.mrn, pt.fname, pt.lname)

# Insert record
with get_db() as db:
    order = ProcedureOrder(
        order_number="ORD-2026-901",
        patient_id="pat-01",
        procedure_code="71250",
        procedure_name="Chest CT Screening",
        modality="CT",
        priority="stat",
        status="pending",
    )
    db.add(order)
    # Automatically committed at the end of the context
```
