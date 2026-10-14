"""
Test Suite for MiPAAS Central Database.

Validates:
- Engine and session configuration
- Table schema generation across IAM, Clinical, Consumer Health, and Imaging AI
- Seeding operations and data integrity
- Cross-subsystem integration (OpenEMR and EkaCare persistence)
- Database Admin API endpoints
"""

import json
import pytest
from sqlalchemy import text

from app import create_app
from app.database import (
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
    check_db_health,
    get_db,
    get_db_stats,
    init_db,
    seed_database,
)
from app.services.openemr.service import OpenEMRManagementService
from app.services.eka_portal import EkaCarePortalService


@pytest.fixture(scope="module")
def app_instance():
    """Create test application configured with SQLite testing database."""
    app = create_app("testing")
    with app.app_context():
        init_db(drop_first=True)
        seed_database(overwrite=True)
        yield app


@pytest.fixture
def client(app_instance):
    return app_instance.test_client()


class TestCentralDatabaseCore:
    """Core database functionality tests."""

    def test_database_health_check(self, app_instance):
        health = check_db_health()
        assert health["status"] == "healthy"
        assert health["connected"] is True
        assert health["dialect"] in ("sqlite", "postgresql")
        assert "latency_ms" in health

    def test_database_stats_reporting(self, app_instance):
        stats = get_db_stats()
        assert stats["total_tables"] >= 15
        assert "users" in stats["tables"]
        assert "clinical_patients" in stats["tables"]
        assert "family_members" in stats["tables"]
        assert "diagnostic_jobs" in stats["tables"]
        assert stats["tables"]["users"] > 0
        assert stats["tables"]["clinical_patients"] > 0

    def test_iam_models_crud(self, app_instance):
        with get_db() as db:
            user = User(
                id="test_user_iam",
                username="test.clinician",
                email="test.clinician@mipaas.health",
                role="radiologist",
                department="Diagnostic Imaging",
            )
            db.add(user)
            db.flush()

            audit = AuditLog(
                id="audit_test_01",
                user_id=user.id,
                username=user.username,
                action="test:login",
                resource_type="auth",
                resource_id="session_01",
                status="success",
            )
            db.add(audit)
            db.flush()

            retrieved = db.query(User).filter_by(id="test_user_iam").first()
            assert retrieved is not None
            assert retrieved.email == "test.clinician@mipaas.health"
            assert len(retrieved.audit_logs) >= 1

    def test_clinical_models_crud(self, app_instance):
        with get_db() as db:
            patient = ClinicalPatient(
                id="test_pt_01",
                mrn="MRN-TEST-999",
                fname="Alexander",
                lname="Fleming",
                dob="1970-01-01",
                gender="Male",
                phone="+1 (555) 999-0000",
            )
            db.add(patient)
            db.flush()

            order = ProcedureOrder(
                id="test_ord_01",
                order_number="ORD-TEST-999",
                patient_id=patient.id,
                procedure_code="71250",
                procedure_name="Chest CT Screening",
                modality="CT",
                priority="urgent",
                status="pending",
            )
            db.add(order)
            db.flush()

            assert order.patient.fname == "Alexander"
            assert len(patient.orders) >= 1

    def test_consumer_health_models_crud(self, app_instance):
        with get_db() as db:
            member = FamilyMember(
                id="test_fam_01",
                name="Aarav Sharma",
                relation="Son",
                age=6,
                gender="Male",
                abha_id="91-9999-8888-7777",
                blood_group="O+",
            )
            db.add(member)
            db.flush()

            vital = VitalRecord(
                id="test_vit_01",
                member_id=member.id,
                vital_type="SpO2",
                value="99",
                unit="%",
                status="Optimal",
                recorded_at="Just now",
            )
            db.add(vital)
            db.flush()

            assert vital.member.name == "Aarav Sharma"
            assert len(member.vitals) >= 1

    def test_imaging_ai_models_crud(self, app_instance):
        with get_db() as db:
            study = DicomStudy(
                id="test_study_01",
                study_instance_uid="1.2.3.4.5.6.7.8.9",
                modality="CT",
                study_description="Thoracic High Resolution CT",
                num_instances=64,
            )
            db.add(study)
            db.flush()

            job = DiagnosticJob(
                id="test_job_01",
                study_id=study.id,
                disease_id="lung_cancer",
                model_name="sybil",
                modality="CT",
                status="preprocessing",
                progress_pct=25,
            )
            db.add(job)
            db.flush()

            agent_run = AgentWorkflowRun(
                id="test_agent_01",
                job_id=job.id,
                agent_id="intake_quality",
                agent_name="DICOM Intake Quality",
                step_order=1,
                status="completed",
                execution_time_ms=120,
            )
            db.add(agent_run)
            db.flush()

            assert len(job.agent_runs) == 1
            assert job.agent_runs[0].agent_id == "intake_quality"


class TestDatabaseServiceIntegration:
    """Tests confirming OpenEMR and EkaCare persist to Central Database."""

    def test_openemr_service_persists_to_central_database(self, app_instance):
        service = OpenEMRManagementService()
        new_patient = service.create_patient({
            "fname": "Clara",
            "lname": "Oswald",
            "dob": "1989-11-23",
            "sex": "Female",
            "phone": "+1 (555) 321-4321",
            "email": "clara@example.com",
        })

        with get_db() as db:
            db_patient = db.query(ClinicalPatient).filter_by(id=new_patient.id).first()
            assert db_patient is not None
            assert db_patient.fname == "Clara"
            assert db_patient.lname == "Oswald"

    def test_eka_portal_service_persists_to_central_database(self, app_instance):
        service = EkaCarePortalService()
        new_member = service.add_member({
            "name": "Devansh Sharma",
            "relation": "Brother",
            "age": 28,
            "gender": "Male",
            "abhaId": "91-1122-3344-5566",
            "bloodGroup": "B+",
        })

        with get_db() as db:
            db_member = db.query(FamilyMember).filter_by(id=new_member.id).first()
            assert db_member is not None
            assert db_member.name == "Devansh Sharma"
            assert db_member.relation == "Brother"


class TestDatabaseAdminAPIEndpoints:
    """Tests for HTTP administration and inspection endpoints."""

    def test_get_database_status_endpoint(self, client):
        res = client.get("/api/v1/database/status")
        assert res.status_code == 200
        data = res.get_json()
        assert data["status"] == "healthy"
        assert data["connected"] is True
        assert "dialect" in data

    def test_get_database_stats_endpoint(self, client):
        res = client.get("/api/v1/database/stats")
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        payload = data["data"]
        assert payload["total_tables"] >= 15
        assert "tables" in payload
        assert payload["tables"]["users"] > 0

    def test_post_database_seed_endpoint(self, client):
        res = client.post("/api/v1/database/seed", json={"overwrite": False})
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True

    def test_post_database_init_endpoint(self, client):
        res = client.post("/api/v1/database/init", json={"drop_first": False})
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
