"""
3D DenseNet Adapter — Volumetric classification for MRI.

Wraps 3D DenseNet models for brain tumor grading and similar
volumetric classification tasks.
"""

import numpy as np
import torch
import torch.nn as nn
import structlog

from workers.adapters.base_adapter import BaseModelAdapter, PredictionResult, XAIConfig

logger = structlog.get_logger()


class DenseNet3DAdapter(BaseModelAdapter):
    """Adapter for 3D DenseNet classification models."""

    def __init__(self, classes: list[str] | None = None):
        super().__init__()
        self.classes = classes or ["low_grade_glioma", "high_grade_glioma"]

    @property
    def disease(self) -> str:
        return "brain_tumor"

    @property
    def model_name(self) -> str:
        return "densenet3d_grade"

    @property
    def modality(self) -> str:
        return "MRI"

    def load_model(self, checkpoint_path: str) -> nn.Module:
        """Load 3D DenseNet model weights."""
        try:
            from monai.networks.nets import DenseNet121
            self.model = DenseNet121(
                spatial_dims=3,
                in_channels=1,
                out_channels=len(self.classes),
            )
        except ImportError:
            from models.densenet3d import DenseNet3D
            self.model = DenseNet3D(
                in_channels=1,
                num_classes=len(self.classes),
            )

        checkpoint = torch.load(checkpoint_path, map_location=self.device)
        if isinstance(checkpoint, dict):
            state_dict = checkpoint.get("state_dict", checkpoint.get("model", checkpoint))
        else:
            state_dict = checkpoint

        cleaned = {}
        for k, v in state_dict.items():
            key = k.replace("module.", "").replace("model.", "")
            cleaned[key] = v

        self.model.load_state_dict(cleaned, strict=False)
        self.model.to(self.device)
        self.model.eval()

        logger.info("densenet3d_loaded", checkpoint=checkpoint_path)
        return self.model

    def preprocess(self, volume: np.ndarray) -> torch.Tensor:
        """Convert preprocessed volume to model input."""
        if volume.ndim == 3:
            volume = np.expand_dims(volume, axis=0)
        tensor = torch.from_numpy(volume).float().unsqueeze(0)
        return tensor.to(self.device)

    def predict(self, tensor: torch.Tensor) -> PredictionResult:
        """Run 3D DenseNet inference."""
        model = self.get_model()
        tensor.requires_grad_(True)

        with torch.set_grad_enabled(True):
            logits = model(tensor)

        probs = torch.softmax(logits, dim=1).detach().cpu().numpy().flatten()
        predicted_idx = int(np.argmax(probs))

        probabilities = {
            cls: float(probs[i]) for i, cls in enumerate(self.classes)
        }

        return PredictionResult(
            predicted_class=self.classes[predicted_idx],
            confidence=float(probs[predicted_idx]),
            class_probabilities=probabilities,
            raw_output=logits,
        )

    def get_gradcam_target_layer(self) -> nn.Module:
        """Return the last dense block for Grad-CAM++."""
        model = self.get_model()

        if hasattr(model, "features"):
            # MONAI DenseNet structure
            for name, module in reversed(list(model.features.named_children())):
                if "denseblock" in name.lower() or "dense" in name.lower():
                    return module
            return model.features[-1]

        # Fallback
        last_conv = None
        for module in model.modules():
            if isinstance(module, nn.Conv3d):
                last_conv = module
        if last_conv:
            return last_conv

        raise RuntimeError("Could not find Grad-CAM++ target layer in DenseNet3D")

    def get_xai_config(self) -> XAIConfig:
        return XAIConfig(
            gradcam_target_layer="features.denseblock4",
            supports_occlusion=True,
            supports_integrated_gradients=True,
            supports_shap=True,
            input_requires_grad=True,
        )
