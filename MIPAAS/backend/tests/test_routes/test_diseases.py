"""Tests for the diseases/registry endpoint."""
import os
import tempfile
import yaml
import pytest

from app.services.registry import ModelRegistry


@pytest.fixture
def registry_dir(tmp_path):
    """Create a temporary disease config directory with test configs."""
    config = {
        "disease_id": "test_disease",
        "display_name": "Test Disease",
        "modalities": ["CT"],
        "models": [
            {
                "adapter": "ResNet3DAdapter",
                "name": "test_model",
                "version": "1.0",
                "checkpoint": "gs://test/model.pt",
                "task": "classification",
                "output_type": "class_probabilities",
                "classes": ["class_a", "class_b"],
            }
        ],
        "preprocessing": {"target_size": [64, 64, 64], "normalize": True},
        "xai": {"primary": "gradcam_plus_plus"},
        "segmentation": {"enabled": True},
    }

    yaml_path = tmp_path / "test_disease.yaml"
    with open(yaml_path, "w") as f:
        yaml.dump(config, f)

    return str(tmp_path)


def test_registry_loads_configs(registry_dir):
    """Test that registry discovers and loads YAML configs."""
    registry = ModelRegistry(registry_dir)
    diseases = registry.list_diseases()
    assert len(diseases) == 1
    assert diseases[0]["disease_id"] == "test_disease"


def test_registry_get_disease_config(registry_dir):
    """Test getting full disease configuration."""
    registry = ModelRegistry(registry_dir)
    config = registry.get_disease_config("test_disease")
    assert config is not None
    assert config["display_name"] == "Test Disease"
    assert len(config["models"]) == 1


def test_registry_validate_disease_model(registry_dir):
    """Test disease/model validation."""
    registry = ModelRegistry(registry_dir)
    assert registry.validate_disease_model("test_disease", "test_model") is True
    assert registry.validate_disease_model("test_disease", "nonexistent") is False
    assert registry.validate_disease_model("nonexistent", "test_model") is False


def test_registry_get_preprocessing_config(registry_dir):
    """Test getting preprocessing configuration."""
    registry = ModelRegistry(registry_dir)
    config = registry.get_preprocessing_config("test_disease")
    assert config["target_size"] == [64, 64, 64]
    assert config["normalize"] is True


def test_registry_missing_directory():
    """Test that registry handles missing config directory gracefully."""
    registry = ModelRegistry("/nonexistent/path")
    assert registry.list_diseases() == []


def test_diseases_endpoint(client):
    """Test the /api/v1/diseases endpoint returns list of diseases."""
    response = client.get("/api/v1/diseases")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert "diseases" in data["data"]
