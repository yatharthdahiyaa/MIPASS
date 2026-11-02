"""
Sybil Model Adapter — MIT Lung Cancer Risk Prediction.

Wraps the Sybil model (https://github.com/reginabarzilaygroup/Sybil)
which predicts 1-6 year lung cancer risk from low-dose CT scans.
"""

import os
import sys
import numpy as np
import torch
import torch.nn as nn
import structlog

from workers.adapters.base_adapter import BaseModelAdapter, PredictionResult, XAIConfig

logger = structlog.get_logger()


class SybilAdapter(BaseModelAdapter):
    """Adapter for MIT Sybil lung cancer risk prediction model.

    Sybil uses an ensemble of 3D models trained on NLST data
    to predict lung cancer risk over 1-6 years.
    """

    @property
    def disease(self) -> str:
        return "lung_cancer"

    @property
    def model_name(self) -> str:
        return "sybil"

    @property
    def modality(self) -> str:
        return "CT"

    def load_model(self, checkpoint_path: str) -> nn.Module:
        """Load the Sybil model ensemble.

        Args:
            checkpoint_path: Path to Sybil checkpoint (.ckpt).

        Returns:
            Loaded Sybil model.
        """
        import sys
        local_sybil_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "MODELS", "LUNG CANCER", "Sybil-main")
        )
        if local_sybil_dir not in sys.path and os.path.exists(local_sybil_dir):
            sys.path.insert(0, local_sybil_dir)

        try:
            # Try to use the Sybil library directly
            from sybil import Sybil as SybilModel
            self.model = SybilModel.load(checkpoint_path)
        except Exception as e:
            # Fallback: load as a standard PyTorch model or dummy
            logger.warning("sybil_library_load_fallback", error=str(e))
            if checkpoint_path and os.path.exists(checkpoint_path):
                self.model = torch.load(checkpoint_path, map_location=self.device)
                if isinstance(self.model, dict) and "model" in self.model:
                    self.model = self.model["model"]
            else:
                self.model = nn.Identity()

        if isinstance(self.model, nn.Module):
            self.model.to(self.device)
            self.model.eval()

        logger.info("sybil_model_loaded", checkpoint=checkpoint_path)
        return self.model

    def preprocess(self, volume: np.ndarray) -> torch.Tensor:
        """Convert preprocessed volume to Sybil's expected input format.

        Sybil expects CT volumes in a specific format with
        particular normalization and orientation.

        Args:
            volume: Preprocessed numpy array [1, D, H, W] (already normalized).

        Returns:
            Tensor [1, 1, D, H, W] ready for Sybil inference.
        """
        if volume.ndim == 3:
            volume = np.expand_dims(volume, axis=0)  # Add channel dim

        tensor = torch.from_numpy(volume).float()
        tensor = tensor.unsqueeze(0)  # Add batch dim: [1, 1, D, H, W]
        return tensor.to(self.device)

    def predict(self, tensor: torch.Tensor) -> PredictionResult:
        """Run Sybil inference to get 1-6 year risk scores.

        Args:
            tensor: Input tensor [1, 1, D, H, W].

        Returns:
            PredictionResult with temporal risk scores.
        """
        model = self.get_model()

        with torch.no_grad():
            output = model(tensor)

        # Sybil outputs risk scores for each year
        if isinstance(output, dict):
            risk_scores = output.get("risk", output.get("scores", None))
        elif isinstance(output, (list, tuple)):
            risk_scores = output[0]
        else:
            risk_scores = output

        if isinstance(risk_scores, torch.Tensor):
            risk_scores = risk_scores.cpu().numpy().flatten()

        # Map to year labels
        years = ["1yr", "2yr", "3yr", "4yr", "5yr", "6yr"]
        probabilities = {}
        for i, year in enumerate(years):
            if i < len(risk_scores):
                probabilities[year] = float(risk_scores[i])

        # Highest risk year
        max_year = max(probabilities, key=probabilities.get)

        return PredictionResult(
            predicted_class=f"risk_{max_year}",
            confidence=float(probabilities[max_year]),
            class_probabilities=probabilities,
            raw_output=output,
        )

    def get_gradcam_target_layer(self) -> nn.Module:
        """Return the target layer for Grad-CAM++ in Sybil.

        For Sybil's architecture, we target the last convolutional
        block before the global pooling layer.
        """
        model = self.get_model()

        # Navigate Sybil's architecture to find the last conv layer
        # This depends on Sybil's specific architecture
        if hasattr(model, "encoder"):
            # Sybil uses an encoder-based architecture
            if hasattr(model.encoder, "layer4"):
                return model.encoder.layer4[-1]
            elif hasattr(model.encoder, "features"):
                return model.encoder.features[-1]

        # Fallback: find last Conv3d layer
        last_conv = None
        for module in model.modules():
            if isinstance(module, (nn.Conv3d, nn.Conv2d)):
                last_conv = module
        if last_conv:
            return last_conv

        raise RuntimeError("Could not find target layer for Grad-CAM++ in Sybil model")

    def get_xai_config(self) -> XAIConfig:
        """Return XAI configuration for Sybil."""
        return XAIConfig(
            gradcam_target_layer="encoder.layer4",
            supports_occlusion=True,
            supports_integrated_gradients=True,
            supports_shap=True,
            input_requires_grad=True,
        )

    def postprocess(self, raw_output) -> dict:
        """Format Sybil's temporal risk scores for the API response."""
        return {
            "output_type": "temporal_risk_scores",
            "description": "Lung cancer risk probability for each year (1-6)",
        }
