"""
Base Model Adapter — Abstract interface for all pre-trained models.

Every pre-trained model from any GitHub repository must be wrapped in
an adapter that implements this interface. This normalizes the wildly
different APIs across models (Sybil, MONAI, TorchXRayVision, etc.)
into a consistent predict → explain → segment pipeline.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import torch
import torch.nn as nn


@dataclass
class PredictionResult:
    """Standardized prediction output from any model adapter."""
    predicted_class: str
    confidence: float
    class_probabilities: dict[str, float]
    raw_output: Any = None  # Original model output for XAI
    feature_maps: torch.Tensor | None = None  # Intermediate activations

    def to_dict(self) -> dict:
        return {
            "predicted_class": self.predicted_class,
            "confidence": self.confidence,
            "class_probabilities": self.class_probabilities,
        }


@dataclass
class XAIConfig:
    """XAI configuration specific to a model adapter."""
    gradcam_target_layer: str | None = None  # Layer name for Grad-CAM++
    supports_occlusion: bool = True
    supports_integrated_gradients: bool = True
    supports_shap: bool = True
    input_requires_grad: bool = True  # Whether input tensor needs grad for IG


class BaseModelAdapter(ABC):
    """Abstract base class for model adapters.

    To add a new model:
    1. Subclass BaseModelAdapter
    2. Implement all abstract methods
    3. Register in the adapter factory (workers/adapters/__init__.py)
    4. Create a disease YAML config referencing this adapter
    """

    def __init__(self):
        self.model: nn.Module | None = None
        self.device: torch.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

    @property
    @abstractmethod
    def disease(self) -> str:
        """Disease identifier this adapter serves."""
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Unique model name within the disease."""
        ...

    @property
    @abstractmethod
    def modality(self) -> str:
        """Expected input modality (CT, MRI, XRAY, etc.)."""
        ...

    @abstractmethod
    def load_model(self, checkpoint_path: str) -> nn.Module:
        """Load model weights from a checkpoint file.

        Args:
            checkpoint_path: Local path to the model checkpoint.

        Returns:
            Loaded PyTorch model in eval mode.
        """
        ...

    @abstractmethod
    def preprocess(self, volume: np.ndarray) -> torch.Tensor:
        """Convert preprocessed numpy volume to model-specific input tensor.

        The BaseWorker preprocessing already handles DICOM → numpy conversion
        and basic normalization. This method handles model-specific transforms
        (e.g., Sybil's custom data pipeline, MONAI transforms).

        Args:
            volume: Preprocessed numpy array from the preprocessing worker.

        Returns:
            PyTorch tensor ready for model forward pass.
        """
        ...

    @abstractmethod
    def predict(self, tensor: torch.Tensor) -> PredictionResult:
        """Run model inference.

        Args:
            tensor: Model-ready input tensor.

        Returns:
            Standardized prediction result.
        """
        ...

    @abstractmethod
    def get_gradcam_target_layer(self) -> nn.Module:
        """Return the target layer for Grad-CAM++ visualization.

        For 3D ResNet: typically layer4[-1]
        For DenseNet: typically the last DenseBlock
        For U-Net: typically the bottleneck

        Returns:
            PyTorch module to hook for Grad-CAM++.
        """
        ...

    @abstractmethod
    def get_xai_config(self) -> XAIConfig:
        """Return XAI configuration for this model.

        Returns:
            XAIConfig with method-specific settings.
        """
        ...

    def postprocess(self, raw_output: Any) -> dict:
        """Optional: custom postprocessing of raw model output.

        Override for models with non-standard outputs (e.g., Sybil's
        temporal risk scores, segmentation masks).

        Args:
            raw_output: Raw model output tensor/dict.

        Returns:
            Formatted result dict.
        """
        return {}

    def get_model(self) -> nn.Module:
        """Get the loaded model (raises if not loaded).

        Returns:
            The loaded PyTorch model.

        Raises:
            RuntimeError: If model hasn't been loaded yet.
        """
        if self.model is None:
            raise RuntimeError(
                f"Model {self.model_name} not loaded. Call load_model() first."
            )
        return self.model
