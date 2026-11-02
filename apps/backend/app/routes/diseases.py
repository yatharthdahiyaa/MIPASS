"""
Diseases routes — List supported diseases and available models.

The Model Registry dynamically discovers disease configs from YAML files,
so adding a new disease/model requires no code changes.
"""

import structlog
from flask import Blueprint, current_app

from app.services.registry import ModelRegistry
from app.utils.response import api_response, api_error

logger = structlog.get_logger()
diseases_bp = Blueprint("diseases", __name__)


@diseases_bp.route("/diseases", methods=["GET"])
def list_diseases():
    """List all supported diseases with their available models.

    Returns:
        {
            "diseases": [
                {
                    "disease_id": "lung_cancer",
                    "display_name": "Lung Cancer Detection & Risk",
                    "modalities": ["CT"],
                    "models": [
                        {
                            "name": "sybil",
                            "task": "risk_prediction",
                            "version": "1.0"
                        },
                        ...
                    ]
                },
                ...
            ]
        }
    """
    registry = ModelRegistry(current_app.config["DISEASE_CONFIG_DIR"])
    diseases = registry.list_diseases()

    return api_response({"diseases": diseases})


@diseases_bp.route("/diseases/<disease_id>/models", methods=["GET"])
def list_models_for_disease(disease_id: str):
    """List available models for a specific disease.

    Returns detailed model information including preprocessing
    requirements, XAI configuration, and supported output types.
    """
    registry = ModelRegistry(current_app.config["DISEASE_CONFIG_DIR"])
    disease_config = registry.get_disease_config(disease_id)

    if not disease_config:
        available = [d["disease_id"] for d in registry.list_diseases()]
        return api_error(
            f"Unknown disease: {disease_id}. Available: {available}",
            404,
        )

    return api_response({
        "disease_id": disease_id,
        "display_name": disease_config.get("display_name"),
        "modalities": disease_config.get("modalities", []),
        "models": disease_config.get("models", []),
        "preprocessing": disease_config.get("preprocessing", {}),
        "xai": disease_config.get("xai", {}),
        "segmentation": disease_config.get("segmentation", {}),
    })
