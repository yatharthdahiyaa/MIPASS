"""
Unit and integration tests for OpenEMR Management System extraction in MiPAAS.
"""

import pytest
from datetime import datetime, timezone
from app.services.openemr.service import OpenEMRManagementService, get_openemr_service
from app.services.openemr.fhir_mapper import OpenEMRFhirMapper
from app.services.openemr.schemas import OrderPriority, OrderStatus, ReportStatus


class TestOpenEMRManagementService:
    """Test suite for OpenEMR native management service extraction."""

    @pytest.fixture
    def emr_service(self):
        return OpenEMRManagementService()

    def test_preseeded_practitioners(self, emr_service):
        """Verify pre-seeded OpenEMR practitioners exist with valid NPI and credentials."""
        users = emr_service.list_users()
        assert len(users) >= 4
        usernames = [u.username for u in users]
        assert "elena.vance" in usernames
        assert "marcus.chen" in usernames
        assert "arthur.davis" in usernames

        elena = emr_service.get_user("elena.vance")
        assert elena is not None
        assert elena.npi == "1942058192"
        assert elena.specialty == "Thoracic & Diagnostic Radiology"
        assert elena.role_mapping == "radiologist"

    def test_create_and_filter_practitioners(self, emr_service):
        """Test creating a new OpenEMR practitioner and role filtering."""
        new_doc = emr_service.create_user({
            "username": "sarah.connor",
            "fname": "Sarah",
            "lname": "Connor",
            "email": "sarah.connor@mipaas.health",
            "npi": "1234567890",
            "specialty": "Trauma & Emergency Care",
            "role_mapping": "radiologist",
        })
        assert new_doc.id is not None
        assert new_doc.full_name == "Dr. Sarah Connor"

        radiologists = emr_service.list_users(role="radiologist")
        assert any(r.username == "sarah.connor" for r in radiologists)

    def test_patient_demographics_and_search(self, emr_service):
        """Test patient demographics, MRN generation, and search."""
        patients = emr_service.list_patients()
        assert len(patients) >= 3

        # Search by MRN
        john = emr_service.get_patient("MRN-89421")
        assert john is not None
        assert john.fname == "John"
        assert john.lname == "Doe"
        assert john.dob == "1968-04-12"

        # Search query
        results = emr_service.list_patients(search="Rigby")
        assert len(results) == 1
        assert results[0].pubpid == "MRN-64812"

    def test_reconcile_dicom_tags(self, emr_service):
        """Test reconciling incoming DICOM header tags with OpenEMR patient records."""
        # Exact MRN match
        match1 = emr_service.reconcile_dicom_patient(patient_id_tag="MRN-89421")
        assert match1 is not None
        assert match1.fname == "John"

        # Caret formatted DICOM name match
        match2 = emr_service.reconcile_dicom_patient(patient_name_tag="Rigby^Eleanor^^^", dob_tag="19750928")
        assert match2 is not None
        assert match2.pubpid == "MRN-64812"

        # No match
        match3 = emr_service.reconcile_dicom_patient(patient_id_tag="NONEXISTENT-999")
        assert match3 is None

    def test_clinical_encounters(self, emr_service):
        """Test encounter creation and patient encounter listing."""
        encounters = emr_service.list_encounters(patient_id="pat-01")
        assert len(encounters) >= 1
        assert "Low-Dose CT" in encounters[0].reason

        new_enc = emr_service.create_encounter({
            "pid": "pat-03",
            "reason": "Diabetic Plantar Foot Thermography Evaluation",
            "provider_id": "emr-user-01",
            "provider_name": "Dr. Elena Vance",
        })
        assert new_enc.id is not None
        assert new_enc.pid == "pat-03"

    def test_procedure_order_worklist_and_job_linking(self, emr_service):
        """Test imaging procedure orders and linking an active MiPAAS AI processing job."""
        orders = emr_service.list_orders(status="pending")
        assert len(orders) >= 2

        # Filter by modality
        ct_orders = emr_service.list_orders(modality="CT")
        assert len(ct_orders) >= 1
        order = ct_orders[0]
        assert order.procedure_code == "71250"

        # Link active job
        linked = emr_service.link_job_to_order(
            procedure_order_id=order.procedure_order_id,
            job_id="job-uuid-1042",
            dicom_study_instance_uid="1.2.840.113619.2.55.3.60468132",
        )
        assert linked is not None
        assert linked.linked_job_id == "job-uuid-1042"
        assert linked.order_status == OrderStatus.IN_PROCESS

    def test_closed_loop_diagnostic_report_finalization(self, emr_service):
        """Test filing an AI diagnostic report, digital sign-off, and closing the order loop."""
        order = emr_service.create_order({
            "patient_id": "pat-01",
            "provider_id": "emr-user-01",
            "procedure_code": "71250",
            "procedure_name": "CT Thorax Lung Nodule Screening",
            "modality": "CT",
            "order_priority": "urgent",
        })

        # Radiologist reviews AI metrics and signs report
        report = emr_service.file_diagnostic_report(
            procedure_order_id=order.procedure_order_id,
            report_notes="Low-dose CT reveals single 6mm ground-glass nodule in RUL. Sybil risk score 18.2%. Follow-up recommended in 6 months.",
            ai_prediction_summary={"sybil_6yr_risk": 0.182, "nodule_volume_mm3": 113.1, "density": "ground_glass"},
            signed_by_provider_id="emr-user-01",
            signed_by_provider_name="Dr. Elena Vance",
            gradcam_heatmap_url="https://mipaas.ai/viewer/xai/rep-001",
            dicom_study_instance_uid="1.2.840.113619.2.55.3.60468132",
        )

        assert report.report_status == ReportStatus.FINAL
        assert report.signed_at is not None
        assert report.signed_by_provider_name == "Dr. Elena Vance"

        # Verify order transitioned to complete
        updated_order = emr_service.get_order(order.procedure_order_id)
        assert updated_order.order_status == OrderStatus.COMPLETE

    def test_hl7_fhir_r4_serialization(self, emr_service):
        """Verify HL7 FHIR R4 standard serialization for all extracted resources."""
        patient = emr_service.get_patient("pat-01")
        fhir_patient = OpenEMRFhirMapper.patient_to_fhir(patient)
        assert fhir_patient["resourceType"] == "Patient"
        assert fhir_patient["id"] == "pat-01"
        assert fhir_patient["name"][0]["family"] == "Doe"
        assert fhir_patient["identifier"][0]["value"] == "MRN-89421"

        practitioner = emr_service.get_user("emr-user-01")
        fhir_practitioner = OpenEMRFhirMapper.practitioner_to_fhir(practitioner)
        assert fhir_practitioner["resourceType"] == "Practitioner"
        assert fhir_practitioner["name"][0]["family"] == "Vance"
        assert any(i["value"] == "1942058192" for i in fhir_practitioner["identifier"])

        encounter = emr_service.get_encounter("enc-01")
        fhir_encounter = OpenEMRFhirMapper.encounter_to_fhir(encounter)
        assert fhir_encounter["resourceType"] == "Encounter"
        assert fhir_encounter["subject"]["reference"] == "Patient/pat-01"

        order = emr_service.get_order("ord-7001")
        fhir_order = OpenEMRFhirMapper.order_to_fhir(order)
        assert fhir_order["resourceType"] == "ServiceRequest"
        assert fhir_order["code"]["coding"][0]["code"] == "71250"


class TestOpenEMRBlueprintRoutes:
    """Test suite for Flask API routes under /api/v1/emr/..."""

    def test_list_and_get_users(self, client):
        res = client.get("/api/v1/emr/users")
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["count"] >= 4

        res_single = client.get("/api/v1/emr/users/emr-user-01")
        assert res_single.status_code == 200
        user = res_single.get_json()["data"]["user"]
        assert user["username"] == "elena.vance"

    def test_sync_rbac_sso(self, client):
        res = client.post("/api/v1/emr/sync-rbac")
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert "Successfully synchronized" in data["message"]
        assert len(data["synced_users"]) >= 4

    def test_patients_and_dicom_reconciliation(self, client):
        res = client.get("/api/v1/emr/patients?search=John")
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data["patients"]) >= 1

        reconcile_res = client.post("/api/v1/emr/patients/reconcile-dicom", json={
            "patient_id": "MRN-89421",
        })
        assert reconcile_res.status_code == 200
        rec_data = reconcile_res.get_json()["data"]
        assert rec_data["matched"] is True
        assert rec_data["patient"]["fname"] == "John"

    def test_orders_worklist_and_report_file(self, client):
        res = client.get("/api/v1/emr/orders?status=pending")
        assert res.status_code == 200
        orders = res.get_json()["data"]["orders"]
        assert len(orders) >= 1
        order_id = orders[0]["procedure_order_id"]

        # File diagnostic report
        report_res = client.post(f"/api/v1/emr/orders/{order_id}/file-report", json={
            "report_notes": "Diagnostic validation complete. Verified nodule segmentation.",
            "ai_prediction_summary": {"confidence": 0.94},
            "signed_by_provider_id": "rad-01",
            "signed_by_provider_name": "Dr. Elena Vance",
        })
        assert report_res.status_code == 201
        rep_data = report_res.get_json()["data"]
        assert rep_data["order"]["order_status"] == "complete"

    def test_fhir_r4_endpoints(self, client):
        res = client.get("/api/v1/emr/fhir/Patient/pat-01")
        assert res.status_code == 200
        fhir_pat = res.get_json()
        assert fhir_pat["resourceType"] == "Patient"
        assert fhir_pat["id"] == "pat-01"

        res_practitioner = client.get("/api/v1/emr/fhir/Practitioner/emr-user-01")
        assert res_practitioner.status_code == 200
        fhir_pract = res_practitioner.get_json()
        assert fhir_pract["resourceType"] == "Practitioner"
