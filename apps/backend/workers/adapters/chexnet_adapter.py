"""
CheXNet / Chest X-ray Model Adapter — Multi-Pathology Detection.

Integrates the multi-label Chest X-ray classifier from MODELS/shreya.
Supports DenseNet-121 and ResNet-18 for 14 chest conditions.
"""

import os
from typing import Any
import numpy as np
import torch
import torch.nn as nn
import structlog

from workers.adapters.base_adapter import BaseModelAdapter, PredictionResult, XAIConfig
from models.chest_xray import (
    DISEASE_CLASSES,
    DEFAULT_THRESHOLDS,
    build_densenet121,
    build_resnet18,
    load_thresholds,
)

logger = structlog.get_logger()


class CheXNetAdapter(BaseModelAdapter):
    """Adapter for Chest X-ray Multi-Pathology Classification.

    Detects 14 thoracic conditions simultaneously using calibrated decision thresholds.
    """

    def __init__(self, architecture: str = "densenet121", classes: list[str] | None = None):
        super().__init__()
        self.architecture = architecture.lower()
        self.classes = classes or DISEASE_CLASSES
        self.thresholds = DEFAULT_THRESHOLDS.copy()

    @property
    def disease(self) -> str:
        return "chest_pathology"

    @property
    def model_name(self) -> str:
        return f"chexnet_{self.architecture}"

    @property
    def modality(self) -> str:
        return "XRAY"

    def load_model(self, checkpoint_path: str | None = None) -> nn.Module:
        """Load the model architecture and weights."""
        if "resnet" in self.architecture:
            self.model = build_resnet18(num_classes=len(self.classes))
        else:
            self.model = build_densenet121(num_classes=len(self.classes))

        # Check for local thresholds from MODELS/shreya
        local_thresholds = os.path.join(
            os.path.dirname(__file__), "..", "..", "..", "MODELS", "shreya", "inference", "thresholds.json"
        )
        if os.path.exists(local_thresholds):
            self.thresholds = load_thresholds(local_thresholds, self.architecture)

        # Load weights if checkpoint provided
        if checkpoint_path and os.path.exists(checkpoint_path):
            try:
                ckpt = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
                state_dict = ckpt.get("model_state_dict", ckpt)
                if any(k.startswith("module.") for k in state_dict.keys()):
                    state_dict = {k.replace("module.", "", 1): v for k, v in state_dict.items()}
                self.model.load_state_dict(state_dict, strict=False)
                logger.info("chexnet_checkpoint_loaded", path=checkpoint_path)
            except Exception as e:
                logger.warning("chexnet_checkpoint_load_failed", error=str(e), path=checkpoint_path)
        else:
            logger.info("chexnet_initialized_with_weights", architecture=self.architecture)

        self.model.to(self.device)
        self.model.eval()
        return self.model

    def preprocess(self, volume: np.ndarray) -> torch.Tensor:
        """Preprocess 2D X-ray volume [H, W] or [1, H, W] to [1, 1, 224, 224]."""
        arr = np.asarray(volume, dtype=np.float32)
        # Squeeze down to 2D if needed
        while arr.ndim > 2 and arr.shape[0] == 1:
            arr = arr[0]
        if arr.ndim > 2:
            arr = arr[arr.shape[0] // 2]  # middle slice if 3D

        # Normalize 0..1
        vmin, vmax = float(arr.min()), float(arr.max())
        if vmax > vmin:
            arr = (arr - vmin) / (vmax - vmin)
        else:
            arr = np.zeros_like(arr)

        # Simple bilinear resize to (224, 224) using PyTorch
        t = torch.from_numpy(arr).unsqueeze(0).unsqueeze(0)  # [1, 1, H, W]
        t = nn.functional.interpolate(t, size=(224, 224), mode="bilinear", align_corners=False)

        return t.to(self.device)

    def predict(self, tensor: torch.Tensor) -> PredictionResult:
        """Run multi-label disease prediction with sigmoid and calibrated thresholds."""
        model = self.get_model()
        tensor = tensor.to(self.device)

        with torch.no_grad():
            logits = model(tensor)
            probs = torch.sigmoid(logits)[0].cpu().numpy()

        class_probs: dict[str, float] = {}
        detected_conditions: list[str] = []

        for i, disease_name in enumerate(self.classes):
            prob = float(probs[i]) if i < len(probs) else 0.0
            class_probs[disease_name] = round(prob, 4)
            th = self.thresholds.get(disease_name, 0.5)
            if prob >= th:
                detected_conditions.append(disease_name)

        # Determine primary predicted class (highest probability or primary finding)
        if detected_conditions:
            primary_class = max(detected_conditions, key=lambda c: class_probs[c])
            top_conf = class_probs[primary_class]
        else:
            primary_class = "No Finding"
            top_conf = round(1.0 - max(class_probs.values(), default=0.0), 4)

        return PredictionResult(
            predicted_class=primary_class,
            confidence=top_conf,
            class_probabilities=class_probs,
            raw_output={
                "detected_conditions": detected_conditions,
                "all_probabilities": class_probs,
                "thresholds": self.thresholds,
            },
        )

    def get_gradcam_target_layer(self) -> nn.Module:
        """Return the last convolutional feature block for Grad-CAM++."""
        model = self.get_model()
        if hasattr(model, "features"):
            # DenseNet-121
            return model.features.denseblock4 if hasattr(model.features, "denseblock4") else model.features[-1]
        elif hasattr(model, "layer4"):
            # ResNet-18
            return model.layer4[-1]
        return list(model.children())[0]

    def get_xai_config(self) -> XAIConfig:
        return XAIConfig(
            gradcam_target_layer="denseblock4" if "densenet" in self.architecture else "layer4",
            supports_occlusion=True,
            supports_integrated_gradients=True,
            supports_shap=False,
            input_requires_grad=True,
        )
