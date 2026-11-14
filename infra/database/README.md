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
infra/database/
├── docker-compose.db.yml     # Standalone Docker stack (PostgreSQL 16 + Adminer GUI + Redis 7)
└── README.md                 # This guide

apps/backend/app/database/    # ORM package (the single source of truth)
├── session.py                # SQLAlchemy engine, pool, WAL mode, get_db()
└── models/                   # base, iam, clinical, consumer_health, imaging_ai, abdm

apps/backend/scripts/init_db.py   # Initialization / stats / health CLI
```

---

## 🚀 Quick Start

### 1. Initialise the schema
The models are the single source of truth. Tables are created (never dropped) on startup, or explicitly:
```bash
python apps/backend/scripts/init_db.py          # create missing tables
python apps/backend/scripts/init_db.py --stats  # row counts
python apps/backend/scripts/init_db.py --health # connectivity
python apps/backend/scripts/init_db.py --drop   # DESTRUCTIVE: drops every table (CLI only, never over HTTP)
```

### 2. Standalone Docker Stack (PostgreSQL 16 + Adminer GUI)
Spin up PostgreSQL and the Adminer web management interface:
```bash
docker compose -f infra/database/docker-compose.db.yml up -d
```
- **PostgreSQL**: `localhost:5432` (`user: mipaas`, `password: mipaas_dev_pass`, `db: mipaas_central`)
- **Adminer Web GUI**: [http://localhost:8088](http://localhost:8088)

### 3. Environment Variables
Add to `.env` or system environment:
```env
# PostgreSQL only (Docker stack above, Cloud SQL, Supabase, ...)
DATABASE_URL=postgresql://mipaas:mipaas_dev_pass@127.0.0.1:5432/mipaas_central

DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20
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
from app.database import get_db, ClinicalPatient, ProcedureOrder

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
    