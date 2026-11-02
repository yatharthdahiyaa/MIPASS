"""
Pytest configuration and shared fixtures for MIPAAS backend tests.
"""

import pytest
from app import create_app


@pytest.fixture
def app():
    """Create a Flask app configured for testing."""
    app = create_app("testing")
    app.config["TESTING"] = True
    yield app


@pytest.fixture
def client(app):
    """Create a test client for the Flask app."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Create a CLI test runner."""
    return app.test_cli_runner()


@pytest.fixture
def sample_job_data():
    """Sample job creation payload."""
    return {
        "disease_id": "lung_cancer",
        "model_name": "sybil",
        "modality": "CT",
        "filename": "series_001.dcm",
        "content_type": "application/dicom",
    }


@pytest.fixture
def sample_job_record():
    """Sample job Firestore document."""
    from datetime import datetime
    return {
        "job_id": "test-job-001",
        "user_id": "test-user",
        "status": "complete",
        "disease_id": "lung_cancer",
        "model_name": "sybil",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "input": {
            "gcs_prefix": "gs://mipaas-test-data/raw/test-user/test-job-001/",
            "filename": "series.dcm",
            "modality": "CT",
        },
        "predictions": {
            "predicted_class": "risk_3yr",
            "confidence": 0.78,
            "class_probabilities": {
                "1yr": 0.12, "2yr": 0.35, "3yr": 0.78,
                "4yr": 0.82, "5yr": 0.85, "6yr": 0.88,
            },
        },
        "xai": {
            "gradcam": {"status": "complete", "gcs_uri": "xai/test-job-001/heatmap_gradcam.npy"},
            "occlusion": {"status": "complete"},
            "integrated_gradients": {"status": "complete"},
        },
        "segmentation": {
            "status": "complete",
            "lesion_count": 2,
            "lesion_volumes_mm3": [145.5, 23.8],
        },
        "error": None,
    }
