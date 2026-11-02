"""
Diabetic Foot Model Adapter — Plantar Thermogram Screening.

Integrated from MODELS/Diabetic-foot-detect-using-thermal-image.
Processes bilateral foot thermal images to detect diabetic neuropathy and ulcer risk.
"""

import os
from typing import Any
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import joblib
import structlog

from workers.adapters.base_adapter import BaseModelAdapter, PredictionResult, XAIConfig
from models.thermal_foot import (
    extract_features,
    standardize_foot_geometry,
)

logger = structlog.get_logger()


class DiabeticFootAdapter(BaseModelAdapter):
    """Adapter for Plantar Thermogram Diabetic Foot & DM screening."""

    def __init__(self, classes: list[str] | None = None):
        super().__init__()
        self.classes = classes or ["Control", "DM"]
        self.sk_model = None
        self.feature_cols: list[str] = []
        self.threshold: float = 0.41
        self.target_shape = (128, 64)

    @property
    def disease(self) -> str:
        return "diabetic_foot"

    @property
    def model_name(self) -> str:
        return "thermal_dm_predictor"

    @property
    def modality(self) -> str:
        return "THERMAL"

    def load_model(self, checkpoint_path: str | None = None) -> Any:
        """Load joblib bundle with model, feature_cols, and decision threshold."""
        default_local = os.path.join(
            os.path.dirname(__file__),
            "..", "..", "..", "MODELS",
            "Diabetic-foot-detect-using-thermal-image", "thermal_dm_model.joblib"
        )
        resolved_path = checkpoint_path if (checkpoint_path and os.path.exists(checkpoint_path)) else default_local

        if os.path.exists(resolved_path):
            try:
                bundle = joblib.load(resolved_path)
                self.sk_model = bundle.get("model")
                self.feature_cols = bundle.get("feature_cols", [])
                self.threshold = float(bundle.get("threshold", 0.41))
                self.target_shape = tuple(bundle.get("target_shape", (128, 64)))
                logger.info("diabetic_foot_model_loaded", path=resolved_path, threshold=self.threshold)
            except Exception as e:
                logger.warning("diabetic_foot_load_failed", error=str(e), path=resolved_path)

        # Create dummy PyTorch placeholder so BaseModelAdapter.get_model() doesn't fail
        self.model = nn.Identity()
        return self.model

    def preprocess(self, volume: np.ndarray) -> torch.Tensor:
        """Convert input array into a PyTorch tensor wrapping the thermal matrix."""
        arr = np.asarray(volume, dtype=np.float32)
        if arr.ndim == 2:
            tensor = torch.from_numpy(arr).unsqueeze(0).unsqueeze(0)
        elif arr.ndim == 3:
            tensor = torch.from_numpy(arr).unsqueeze(0)
        else:
            tensor = torch.from_numpy(arr)
        return tensor

    def predict(self, tensor: torch.Tensor) -> PredictionResult:
        """Extract bilateral features and run DM classification."""
        arr = tensor.detach().cpu().numpy()
        while arr.ndim > 2:
            arr = arr[0]

        # If single combined image, split into Left and Right foot halves
        h, w = arr.shape
        if w >= h:
            half = w // 2
            mat_l = arr[:, :half]
            mat_r = arr[:, half:]
        else:
            mat_l = arr
            mat_r = np.fliplr(arr)

        feats = extract_features(mat_l, mat_r, target_shape=self.target_shape)

        p = 0.5
        if self.sk_model is not None and self.feature_cols:
            try:
                X = pd.DataFrame([feats]).reindex(columns=self.feature_cols)
                X = X.apply(pd.to_numeric, errors="coerce").replace([np.inf, -np.inf], np.nan)
                p = float(self.sk_model.predict_proba(X)[0, 1])
            except Exception as e:
                logger.warning("diabetic_foot_predict_proba_fallback", error=str(e))
                # Fallback to asymmetry rule
                asym = feats.get("asym_mean_diff", 0.0)
                p = min(0.95, max(0.05, asym / 2.2))
        else:
            # Rule-based calculation from asymmetry
            asym = feats.get("asym_mean_diff", 0.0)
            p = min(0.95, max(0.05, asym / 2.2))

        predicted = "DM" if p >= self.threshold else "Control"
        probs = {
            "Control": round(1.0 - p, 4),
            "DM": round(p, 4),
        }

        return PredictionResult(
            predicted_class=predicted,
            confidence=round(max(p, 1.0 - p), 4),
            class_probabilities=probs,
            raw_output={
                "prediction": predicted,
                "dm_probability": round(p, 4),
                "threshold": round(self.threshold, 4),
                "risk_flag": bool(p >= self.threshold),
                "bilateral_asymmetry": {
                    "mean_temp_difference": round(float(feats.get("asym_mean_diff", 0.0)), 2),
                    "max_temp_difference": round(float(feats.get("asym_max_diff", 0.0)), 2),
                    "left_foot_mean": round(float(feats.get("L_foot_mean", 0.0)), 2),
                    "right_foot_mean": round(float(feats.get("R_foot_mean", 0.0)), 2),
                },
            },
        )

    def get_gradcam_target_layer(self) -> nn.Module:
        return self.get_model()

    def get_xai_config(self) -> XAIConfig:
        return XAIConfig(
            gradcam_target_layer=None,
            supports_occlusion=False,
            supports_integrated_gradients=False,
            supports_shap=False,
            input_requires_grad=False,
        )
