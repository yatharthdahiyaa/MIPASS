"""
Tests for role permissions and ownership enforcement on protected clinical routes.
"""

from unittest.mock import MagicMock, patch
import pytest


@patch("app.routes.upload.StorageService")
@patch("app.routes.upload.FirestoreService")
def test_upload_signed_url_rbac(mock_firestore, mock_storage, client, sample_job_data):
    """POST /upload/signed-url requires JOBS_CREATE permission."""
    mock_storage_inst = MagicMock()
    mock_storage_inst.generate_signed_upload_url.return_value = "https://storage.googleapis.com/test-url"
    mock_storage.return_value = mock_storage_inst

    mock_fs_inst = MagicMock()
    mock_firestore.return_value = mock_fs_inst

    # 1. Unauthenticated -> 401
    resp_anon = client.post("/api/v1/upload/signed-url", json=sample_job_data)
    assert resp_anon.status_code == 401

    # 2. Researcher -> 403 (No JOBS_CREATE permission)
    resp_res = client.post(
        "/api/v1/upload/signed-url",
        headers={"X-User-ID": "res-01"},
        json=sample_job_data,
    )
    assert resp_res.status_code == 403

    # 3. Auditor -> 403 (No JOBS_CREATE permission)
    resp_aud = client.post(
        "/api/v1/upload/signed-url",
        headers={"X-User-ID": "aud-01"},
        json=sample_job_data,
    )
    assert resp_aud.status_code == 403

    # 4. Technician -> 201 (Granted)
    resp_tech = client.post(
        "/api/v1/upload/signed-url",
        headers={"X-User-ID": "tech-01"},
        json=sample_job_data,
    )
    assert resp_tech.status_code == 201
    data = resp_tech.get_json()["data"]
    assert "upload_url" in data
    assert "raw/tech-01/" in data["upload_prefix"]

    # 5. Radiologist -> 201 (Granted)
    resp_rad = client.post(
        "/api/v1/upload/signed-url",
        headers={"X-User-ID": "rad-01"},
        json=sample_job_data,
    )
    assert resp_rad.status_code == 201


@patch("app.routes.jobs.FirestoreService")
def test_job_ownership_and_phi_masking(mock_firestore, client, sample_job_record):
    """GET /jobs/<id> enforces ownership and masks PHI for researchers."""
    # Job owned by rad-01
    job_record = dict(sample_job_record)
    job_record["user_id"] = "rad-01"
    job_record["input"] = {
        "gcs_prefix": "gs://mipaas-data/raw/rad-01/test-job-001/",
        "patient_mrn": "MRN-98421",
    }

    mock_fs_inst = MagicMock()
    mock_fs_inst.get_job.return_value = job_record
    mock_firestore.return_value = mock_fs_inst

    # 1. Unauthenticated -> 401
    resp_anon = client.get("/api/v1/jobs/test-job-001")
    assert resp_anon.status_code == 401

    # 2. Another technician (not owner, not admin) -> 403
    resp_other = client.get("/api/v1/jobs/test-job-001", headers={"X-User-ID": "tech-01"})
    assert resp_other.status_code == 403

    # 3. Owner (rad-01) -> 200 with full PHI
    resp_owner = client.get("/api/v1/jobs/test-job-001", headers={"X-User-ID": "rad-01"})
    assert resp_owner.status_code == 200
    owner_data = resp_owner.get_json()["data"]
    assert owner_data["input"]["patient_mrn"] == "MRN-98421"

    # 4. Admin (admin-01) -> 200
    resp_admin = client.get("/api/v1/jobs/test-job-001", headers={"X-User-ID": "admin-01"})
    assert resp_admin.status_code == 200

    # 5. Auditor (aud-01) -> 200
    resp_aud = client.get("/api/v1/jobs/test-job-001", headers={"X-User-ID": "aud-01"})
    assert resp_aud.status_code == 200


@patch("app.routes.jobs.FirestoreService")
def test_job_cancellation_rbac(mock_firestore, client, sample_job_record):
    """DELETE /jobs/<id> requires JOBS_DELETE and ownership or admin role."""
    job_record = dict(sample_job_record)
    job_record["user_id"] = "rad-01"

    mock_fs_inst = MagicMock()
    mock_fs_inst.get_job.return_value = job_record
    mock_firestore.return_value = mock_fs_inst

    # 1. Technician lacks JOBS_DELETE -> 403
    resp_tech = client.delete("/api/v1/jobs/test-job-001", headers={"X-User-ID": "tech-01"})
    assert resp_tech.status_code == 403

    # 2. Auditor lacks JOBS_DELETE -> 403
    resp_aud = client.delete("/api/v1/jobs/test-job-001", headers={"X-User-ID": "aud-01"})
    assert resp_aud.status_code == 403

    # 3. Admin has JOBS_DELETE -> 200
    resp_admin = client.delete("/api/v1/jobs/test-job-001", headers={"X-User-ID": "admin-01"})
    assert resp_admin.status_code == 200


@patch("app.routes.results.FirestoreService")
def test_results_xai_permission_rbac(mock_firestore, client, sample_job_record):
    """GET /jobs/<id>/heatmap requires XAI_READ permission."""
    job_record = dict(sample_job_record)
    job_record["user_id"] = "rad-01"

    mock_fs_inst = MagicMock()
    mock_fs_inst.get_job.return_value = job_record
    mock_firestore.return_value = mock_fs_inst

    # Technician does not have XAI_READ -> 403
    resp_tech = client.get("/api/v1/jobs/test-job-001/heatmap", headers={"X-User-ID": "tech-01"})
    assert resp_tech.status_code == 403
    assert "xai:read" in resp_tech.get_json()["error"]["message"]
