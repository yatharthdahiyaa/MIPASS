"""
3D ResNet Adapter — Volumetric classification for CT/MRI.

Wraps 3D ResNet models (from MONAI or custom implementations)
for tasks like nodule classification, tumor detection, etc.
"""

import numpy as np
import torch
import torch.nn as nn
import structlog

from workers.adapters.base_adapter import BaseModelAdapter, PredictionResult, XAIConfig

logger = structlog.get_logger()


class ResNet3DAdapter(BaseModelAdapter):
    """Adapter for 3D ResNet classification models.

    Compatible with:
    - MONAI's ResNet3D implementations
    - Custom 3D ResNet checkpoints
    - Any model following the standard ResNet3D architecture
    """

    def __init__(self, classes: list[str] | None = None):
        super().__init__()
        self.classes = classes or ["benign", "malignant"]

    @property
    def disease(self) -> str:
        return "lung_cancer"

    @property
    def model_name(self) -> str:
        return "resnet3d_nodule"

    @property
    def modality(self) -> str:
        return "CT"

    def load_model(self, checkpoint_path: str) -> nn.Module:
        """Load 3D ResNet model weights.

        Supports both MONAI and custom checkpoint formats.

        Args:
            checkpoint_path: Path to the model checkpoint (.pt/.pth).

        Returns:
            Loaded 3D ResNet model.
        """
        try:
            from monai.networks.nets import ResNet
            # Try MONAI ResNet first
            self.model = ResNet(
                block="bottleneck",
                layers=[3, 4, 6, 3],  # ResNet-50
                block_inplanes=[64, 128, 256, 512],
                spatial_dims=3,
                n_input_channels=1,
                num_classes=len(self.classes),
            )
        except ImportError:
            # Fallback: build a standard 3D ResNet
            from models.resnet3d import ResNet3D
            self.model = ResNet3D(
                in_channels=1,
                num_classes=len(self.classes),
            )

        # Load weights
        checkpoint = torch.load(checkpoint_path, map_location=self.device)
        if isinstance(checkpoint, dict):
            state_dict = checkpoint.get("state_dict", checkpoint.get("model", checkpoint))
        else:
            state_dict = checkpoint.state_dict() if isinstance(checkpoint, nn.Module) else checkpoint

        # Handle DataParallel / DistributedDataParallel prefix
        cleaned = {}
        for k, v in state_dict.items():
            key = k.replace("module.", "").replace("model.", "")
            cleaned[key] = v

        self.model.load_state_dict(cleaned, strict=False)
        self.model.to(self.device)
        self.model.eval()

        logger.info("resnet3d_loaded", checkpoint=checkpoint_path, classes=self.classes)
        return self.model

    def preprocess(self, volume: np.ndarray) -> torch.Tensor:
        """Convert preprocessed volume to model input.

        Args:
            volume: Preprocessed numpy array [1, D, H, W].

        Returns:
            Tensor [1, 1, D, H, W].
        """
        if volume.ndim == 3:
            volume = np.expand_dims(volume, axis=0)

        tensor = torch.from_numpy(volume).float()
        tensor = tensor.unsqueeze(0)  # Batch dim
        return tensor.to(self.device)

    def predict(self, tensor: torch.Tensor) -> PredictionResult:
        """Run 3D ResNet inference.

        Args:
            tensor: Input tensor [1, 1, D, H, W].

        Returns:
            Classification prediction with probabilities.
        """
        model = self.get_model()

        # Enable gradient computation for XAI (Grad-CAM needs it)
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
        """Return the last convolutional block (layer4) for Grad-CAM++."""
        model = self.get_model()

        if hasattr(model, "layer4"):
            return model.layer4[-1]
        elif hasattr(model, "features"):
            # MONAI style
            return model.features[-1]

        # Fallback: find last Conv3d
        last_conv = None
        for module in model.modules():
            if isinstance(module, nn.Conv3d):
                last_conv = module
        if last_conv:
            return last_conv

        raise RuntimeError("Could not find Grad-CAM++ target layer in ResNet3D")

    def get_xai_config(self) -> XAIConfig:
        """Return XAI configuration."""
        return XAIConfig(
            gradcam_target_layer="layer4",
            supports_occlusion=True,
            supports_integrated_gradients=True,
            supports_shap=True,
            input_requires_grad=True,
        )
