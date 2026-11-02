"""
Model Registry Service — Dynamic disease/model discovery from YAML configs.

Scans the config/diseases/ directory for YAML files and builds a registry
of all supported diseases, models, and their configurations. Adding a new
disease or model is as simple as adding a new YAML file.
"""

import os
from pathlib import Path
from functools import lru_cache

import yaml
import structlog

logger = structlog.get_logger()


class ModelRegistry:
    """Registry of diseases and their associated models.

    Discovers disease configurations from YAML files in the config directory.
    Each YAML file defines a disease with its models, preprocessing, XAI, and
    segmentation configuration.
    """

    def __init__(self, config_dir: str):
        """Initialize the model registry.

        Args:
            config_dir: Path to the directory containing disease YAML configs.
        """
        self._config_dir = Path(config_dir)
        self._diseases: dict[str, dict] = {}
        self._load_configs()

    def _load_configs(self) -> None:
        """Load all disease YAML configs from the config directory."""
        if not self._config_dir.exists():
            logger.warning("disease_config_dir_missing", path=str(self._config_dir))
            return

        for yaml_file in sorted(self._config_dir.glob("*.yaml")):
            try:
                with open(yaml_file, "r") as f:
                    config = yaml.safe_load(f)

                if not config or "disease_id" not in config:
                    logger.warning("invalid_disease_config", file=yaml_file.name)
                    continue

                disease_id = config["disease_id"]
                self._diseases[disease_id] = config

                model_count = len(config.get("models", []))
                logger.info(
                    "disease_config_loaded",
                    disease_id=disease_id,
                    models=model_count,
                    file=yaml_file.name,
                )

            except yaml.YAMLError as e:
                logger.error("yaml_parse_error", file=yaml_file.name, error=str(e))
            except Exception as e:
                logger.error("config_load_error", file=yaml_file.name, error=str(e))

        logger.info(
            "registry_initialized",
            total_diseases=len(self._diseases),
            total_models=sum(
                len(d.get("models", [])) for d in self._diseases.values()
            ),
        )

    def list_diseases(self) -> list[dict]:
        """List all supported diseases with their available models.

        Returns:
            List of disease summaries with model info.
        """
        diseases = []
        for disease_id, config in self._diseases.items():
            diseases.append({
                "disease_id": disease_id,
                "display_name": config.get("display_name", disease_id),
                "modalities": config.get("modalities", []),
                "models": [
                    {
                        "name": m.get("name"),
                        "adapter": m.get("adapter"),
                        "task": m.get("task"),
                        "version": m.get("version"),
                        "output_type": m.get("output_type"),
                    }
                    for m in config.get("models", [])
                ],
            })
        return diseases

    def get_disease_config(self, disease_id: str) -> dict | None:
        """Get full configuration for a disease.

        Args:
            disease_id: Disease identifier.

        Returns:
            Full disease config dict or None.
        """
        return self._diseases.get(disease_id)

    def get_model_config(self, disease_id: str, model_name: str) -> dict | None:
        """Get configuration for a specific model within a disease.

        Args:
            disease_id: Disease identifier.
            model_name: Model name within the disease.

        Returns:
            Model config dict or None.
        """
        disease = self._diseases.get(disease_id)
        if not disease:
            return None

        for model in disease.get("models", []):
            if model.get("name") == model_name:
                return model

        return None

    def validate_disease_model(self, disease_id: str, model_name: str) -> bool:
        """Check if a disease/model combination is valid.

        Args:
            disease_id: Disease identifier.
            model_name: Model name.

        Returns:
            True if the combination exists in the registry.
        """
        return self.get_model_config(disease_id, model_name) is not None

    def get_preprocessing_config(self, disease_id: str) -> dict:
        """Get preprocessing configuration for a disease.

        Args:
            disease_id: Disease identifier.

        Returns:
            Preprocessing config dict (empty dict if not found).
        """
        disease = self._diseases.get(disease_id)
        if not disease:
            return {}
        return disease.get("preprocessing", {})

    def get_xai_config(self, disease_id: str) -> dict:
        """Get XAI configuration for a disease.

        Args:
            disease_id: Disease identifier.

        Returns:
            XAI config dict.
        """
        disease = self._diseases.get(disease_id)
        if not disease:
            return {}
        return disease.get("xai", {})

    def get_segmentation_config(self, disease_id: str) -> dict:
        """Get segmentation configuration for a disease.

        Args:
            disease_id: Disease identifier.

        Returns:
            Segmentation config dict.
        """
        disease = self._diseases.get(disease_id)
        if not disease:
            return {}
        return disease.get("segmentation", {})

    def get_adapter_class_name(self, disease_id: str, model_name: str) -> str | None:
        """Get the adapter class name for a model.

        Args:
            disease_id: Disease identifier.
            model_name: Model name.

        Returns:
            Adapter class name string or None.
        """
        model = self.get_model_config(disease_id, model_name)
        if not model:
            return None
        return model.get("adapter")
