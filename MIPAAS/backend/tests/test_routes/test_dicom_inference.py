"""
Tests for the strict DICOM inference endpoint (/api/v1/inference/dicom-predict).
Verifies zero-fallback policy and strict DICOM-only validation.
"""
import io
import os
import pytest


def test_dicom_inference_rejects_missing_file(client):
    """Test that missing file part returns 400."""
    response = client.post("/api/v1/inference/dicom-predict")
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert any(term in data["error"]["message"].lower() for term in ["image file is required", "dicom file is required"])


def test_dicom_inference_rejects_non_dicom_extension(client):
    """Test that non-DICOM extensions (.png, .jpg, .txt) with unreadable content are rejected."""
    fake_txt = (io.BytesIO(b"fake plain text content"), "scan.txt")
    response = client.post(
        "/api/v1/inference/dicom-predict",
        data={"file": fake_txt},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert any(term in data["error"]["message"].lower() for term in ["invalid", "cannot identify", "not a supported format", "supported format", "valid dicom"])


def test_dicom_inference_rejects_corrupted_file_with_dcm_ext(client):
    """Test that corrupted/arbitrary file named .dcm is rejected by pydicom parser."""
    fake_dcm = (io.BytesIO(b"This is not a real dicom file at all"), "fake.dcm")
    response = client.post(
        "/api/v1/inference/dicom-predict",
        data={"file": fake_dcm},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert any(term in data["error"]["message"].lower() for term in ["not a supported format", "cannot identify", "valid dicom", "invalid"])


def test_dicom_inference_with_real_dicom_file(client):
    """Test real DICOM inference with trained DenseNet-121 model and zero fallbacks."""
    sample_dcm_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "sample_cxr.dcm")
    assert os.path.exists(sample_dcm_path), f"Sample DICOM file must exist at {sample_dcm_path}"

    with open(sample_dcm_path, "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/v1/inference/dicom-predict",
        data={"file": (io.BytesIO(file_bytes), "sample_cxr.dcm")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.data}"
    body = response.get_json()

    assert body["success"] is True
    data = body["data"]

    assert data["is_fallback"] is False
    assert data["checkpoint_verified"] is True
    assert data["model_architecture"] == "DenseNet-121"

    # Verify clinical findings
    assert "primary_diagnosis" in data
    assert "confidence" in data
    assert "severity" in data
    assert "pathologies" in data
    assert len(data["pathologies"]) == 14
    assert "heatmap_image" in data
    assert data["heatmap_image"] is not None
    assert "preview_image" in data
    assert len(data["preview_image"]) > 100
    assert "recommended_actions" in data
    assert len(data["recommended_actions"]) > 0

    # Verify DICOM metadata
    metadata = data["dicom_metadata"]
    assert metadata["modality"] in ("DX", "CR")
    assert metadata["body_part_examined"] == "CHEST"
    assert metadata["patient_id"] == "MIPAAS-CXR-001"
    assert metadata["rows"] == 224
    assert metadata["columns"] == 224
