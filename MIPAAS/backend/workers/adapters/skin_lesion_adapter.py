"""
Skin Lesion Model Adapter — HAM10000 EfficientNet-B0 Classifier.

Integrated from MODELS/HAM10000-Skin-Lesion-Classifier.
Provides 7-class dermatological diagnosis and malignancy risk assessment.
"""

import os
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import structlog

from workers.adapters.base_adapter import BaseModelAdapter, PredictionResult, XAIConfig
from models.skin_lesion import (
    CLASS_NAMES,
    CLASS_METADATA,
    build_efficientnet,
)

logger = structlog.get_logger()

# ImageNet normalization constants
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


class SkinLesionAdapter(BaseModelAdapter):
    """Adapter for HAM10000 Skin Lesion Classification using EfficientNet-B0."""

    def __init__(self, classes: list[str] | None = None):
        super().__init__()
        self.classes = classes or CLASS_NAMES

    @property
    def disease(self) -> str:
        return "skin_cancer"

    @property
    def model_name(self) -> str:
        return "efficientnet_b0"

    @property
    def modality(self) -> str:
        return "DERMOSCOPY"

    def load_model(self, checkpoint_path: str | None = None) -> nn.Module:
        """Load EfficientNet-B0 weights."""
        self.model = build_efficientnet(num_classes=len(self.classes))

        # Check default location in MODELS if no path given or file not found
        default_local = os.path.join(
            os.path.dirname(__file__),
            "..", "..", "..", "MODELS",
            "HAM10000-Skin-Lesion-Classifier", "models", "efficientnet_inference.pth"
        )

        resolved_path = checkpoint_path if (checkpoint_path and os.path.exists(checkpoint_path)) else default_local

        if os.path.exists(resolved_path):
            try:
                state_dict = torch.load(resolved_path, map_location=self.device, weights_only=False)
                if isinstance(state_dict, dict) and "state_dict" in state_dict:
                    state_dict = state_dict["state_dict"]
                self.model.load_state_dict(state_dict, strict=False)
                logger.info("skin_lesion_weights_loaded", path=resolved_path)
            except Exception as e:
                logger.warning("skin_lesion_weights_failed", error=str(e), path=resolved_path)
        else:
            logger.info("skin_lesion_initialized_default_weights")

        self.model.to(self.device)
        self.model.eval()
        return self.model

    def preprocess(self, volume: np.ndarray) -> torch.Tensor:
        """Convert image array [H, W, C] or [C, H, W] to model tensor [1, 3, 224, 224]."""
        arr = np.asarray(volume, dtype=np.float32)

        # Handle channel dimension
        if arr.ndim == 2:
            # Grayscale -> 3 channel
            arr = np.stack([arr] * 3, axis=0)
        elif arr.ndim == 3 and arr.shape[-1] in (3, 4):
            # [H, W, C] -> [C, H, W]
            arr = arr[:, :, :3].transpose(2, 0, 1)

        # Normalize 0..1
        if arr.max() > 1.0:
            arr = arr / 255.0

        t = torch.from_numpy(arr).unsqueeze(0)  # [1, 3, H, W]
        t = F.interpolate(t, size=(224, 224), mode="bilinear", align_corners=False)

        # Apply ImageNet normalization
        mean = torch.tensor(IMAGENET_MEAN, device=t.device).view(1, 3, 1, 1)
        std = torch.tensor(IMAGENET_STD, device=t.device).view(1, 3, 1, 1)
        t = (t - mean) / std

        return t.to(self.device)

    def predict(self, tensor: torch.Tensor) -> PredictionResult:
        """Run classification forward pass with softmax."""
        model = self.get_model()
        tensor = tensor.to(self.device)

        with torch.no_grad():
            logits = model(tensor)
            probs = F.softmax(logits, dim=1)[0].cpu().numpy()

        class_probs = {
            cls_name: round(float(probs[i]), 4)
            for i, cls_name in enumerate(self.classes)
        }

        top_idx = int(np.argmax(probs))
        top_class = self.classes[top_idx]
        top_conf = float(probs[top_idx])

        # Malignancy score: sum of akiec + bcc + mel
        malignant_prob = sum(
            class_probs.get(c, 0.0) for c in ["mel", "bcc", "akiec"]
        )

        meta = CLASS_METADATA.get(top_class, {})

        return PredictionResult(
            predicted_class=top_class,
            confidence=round(top_conf, 4),
            class_probabilities=class_probs,
            raw_output={
                "class_name_full": meta.get("full_name", top_class),
                "description": meta.get("description", ""),
                "is_malignant": meta.get("malignant", False),
                "malignancy_risk": round(malignant_prob, 4),
                "probabilities": class_probs,
            },
        )

    def get_gradcam_target_layer(self) -> nn.Module:
        """Return the last convolutional layer of EfficientNet-B0."""
        model = self.get_model()
        if hasattr(model, "features"):
            return model.features[-1]
        return list(model.children())[0]

    def get_xai_config(self) -> XAIConfig:
        return XAIConfig(
            gradcam_target_layer="features[-1]",
            supports_occlusion=True,
            supports_integrated_gradients=True,
            supports_shap=False,
            input_requires_grad=True,
        )
