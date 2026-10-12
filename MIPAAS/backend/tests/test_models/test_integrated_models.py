"""Tests for newly integrated models from MODELS folder."""
import pytest
import numpy as np
import torch

from workers.adapters.factory import get_adapter
from workers.adapters.chexnet_adapter import CheXNetAdapter
from workers.adapters.skin_lesion_adapter import SkinLesionAdapter
from workers.adapters.diabetic_foot_adapter import DiabeticFootAdapter
from workers.adapters.sybil_adapter import SybilAdapter


def test_chexnet_adapter_pipeline():
    """Test CheXNetAdapter loads, preprocesses, and predicts 14 conditions."""
    adapter = get_adapter("CheXNetAdapter")
    assert adapter.disease == "chest_pathology"
    assert adapter.modality == "XRAY"

    adapter.load_model()
    dummy_xray = np.random.uniform(50, 200, size=(256, 256)).astype(np.float32)
    tensor = adapter.preprocess(dummy_xray)

    assert tensor.shape == (1, 1, 224, 224)

    result = adapter.predict(tensor)
    assert result.predicted_class is not None
    assert len(result.class_probabilities) == 14
    assert "Atelectasis" in result.class_probabilities
    assert "Pneumonia" in result.class_probabilities
    assert hasattr(adapter.get_gradcam_target_layer(), "forward")


def test_skin_lesion_adapter_pipeline():
    """Test SkinLesionAdapter loads, preprocesses, and predicts 7 skin lesion types."""
    adapter = get_adapter("SkinLesionAdapter")
    assert adapter.disease == "skin_cancer"
    assert adapter.modality == "DERMOSCOPY"

    adapter.load_model()
    dummy_dermoscopy = np.random.uniform(0, 255, size=(224, 224, 3)).astype(np.float32)
    tensor = adapter.preprocess(dummy_dermoscopy)

    assert tensor.shape == (1, 3, 224, 224)

    result = adapter.predict(tensor)
    assert result.predicted_class in ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]
    assert len(result.class_probabilities) == 7
    assert "mel" in result.class_probabilities
    assert "malignancy_risk" in result.raw_output
    assert hasattr(adapter.get_gradcam_target_layer(), "forward")


def test_diabetic_foot_adapter_pipeline():
    """Test DiabeticFootAdapter loads, processes thermal data, and predicts DM risk."""
    adapter = get_adapter("DiabeticFootAdapter")
    assert adapter.disease == "diabetic_foot"
    assert adapter.modality == "THERMAL"

    adapter.load_model()
    dummy_thermal = np.random.uniform(25.0, 34.0, size=(128, 128)).astype(np.float32)
    tensor = adapter.preprocess(dummy_thermal)

    result = adapter.predict(tensor)
    assert result.predicted_class in ["DM", "Control"]
    assert "DM" in result.class_probabilities
    assert "Control" in result.class_probabilities
    assert "bilateral_asymmetry" in result.raw_output


def test_sybil_adapter_initialization():
    """Test SybilAdapter initializes properly."""
    adapter = get_adapter("SybilAdapter")
    assert adapter.disease == "lung_cancer"
    assert adapter.modality == "CT"
    adapter.load_model("")
    assert adapter.model is not None


def test_inference_routes(client):
    """Test inference API endpoints."""
    # List models
    res = client.get("/api/v1/inference/models")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["total_diseases"] >= 4

    # Direct predict chest_pathology
    res = client.post("/api/v1/inference/predict", data={"disease_id": "chest_pathology"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "class_probabilities" in data["data"]
    assert len(data["data"]["class_probabilities"]) == 14

    # Direct predict skin_cancer
    res = client.post("/api/v1/inference/predict", data={"disease_id": "skin_cancer"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["predicted_class"] in ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]

    # Direct predict diabetic_foot
    res = client.post("/api/v1/inference/predict", data={"disease_id": "diabetic_foot"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["predicted_class"] in ["DM", "Control"]
