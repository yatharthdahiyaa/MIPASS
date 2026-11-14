"""Chest X-ray model for the XAI agent: the CheXpert ensemble the backend also runs.

``ensemble.py`` is an identical copy of apps/backend/app/services/cxr_ensemble.py (tests/test_xai_model.py
fails if they differ), so the agent scores exactly what the backend scores. Preprocessing matches the
backend's dicom_service: DICOM modality and VOI look-up tables, MONOCHROME1 inversion, robust 8-bit
scaling; other formats as 8-bit grayscale.
"""

from __future__ import annotations

import io
import os
from pathlib import Path

import numpy as np
import pydicom
from PIL import Image

from . import ensemble as ens

REPO_ROOT = Path(__file__).resolve().parents[3]
CHECKPOINT_PATH = Path(os.getenv("MIPAAS_CXR_CHECKPOINT", REPO_ROOT / "ml" / "chexpert_ensemble.pth"))


class ModelUnavailable(RuntimeError):
    """The checkpoint is missing or isn't the ensemble format."""


def get_ensemble() -> ens.Ensemble:
    if not CHECKPOINT_PATH.is_file() or CHECKPOINT_PATH.stat().st_size < 1000:
        raise ModelUnavailable(f"chest X-ray model not found at {CHECKPOINT_PATH} (set MIPAAS_CXR_CHECKPOINT)")
    try:
        return ens.get(CHECKPOINT_PATH)
    except (ens.ModelFormatError, RuntimeError, KeyError) as exc:
        raise ModelUnavailable(f"{CHECKPOINT_PATH.name} could not be loaded: {exc}") from exc


def slug(label: str) -> str:
    """File-name form of a label ("Lung Opacity" -> "Lung_Opacity")."""
    return label.replace(" ", "_")


def labels() -> list[str]:
    return get_ensemble().labels


def _to_uint8(arr: np.ndarray) -> np.ndarray:
    arr = arr.astype(np.float32)
    lo, hi = np.percentile(arr, (0.5, 99.5))
    if hi <= lo:
        lo, hi = float(arr.min()), float(arr.max())
    if hi <= lo:
        return np.zeros(arr.shape, dtype=np.uint8)
    return np.clip((arr - lo) / (hi - lo) * 255.0, 0, 255).astype(np.uint8)


def preprocess(data: bytes, filename: str = "") -> dict:
    """Full-size uint8 grayscale image, pixel spacing (DICOM only) and whether it was DICOM."""
    from pydicom.pixels import apply_modality_lut, apply_voi_lut

    spacing = None
    is_dicom = (len(data) > 132 and data[128:132] == b"DICM") or filename.lower().endswith((".dcm", ".dicom"))
    if is_dicom:
        ds = pydicom.dcmread(io.BytesIO(data), force=True)
        arr = ds.pixel_array
        photometric = str(getattr(ds, "PhotometricInterpretation", "MONOCHROME2")).upper()
        if arr.ndim == 3 and photometric not in ("RGB", "YBR_FULL", "YBR_FULL_422"):
            arr = arr[0]
        if arr.ndim == 3:
            display = np.asarray(Image.fromarray(_to_uint8(arr)).convert("L"))
        else:
            arr = apply_modality_lut(arr, ds)
            if "WindowCenter" in ds or "VOILUTSequence" in ds:
                arr = apply_voi_lut(arr, ds, index=0)
            arr = arr.astype(np.float32)
            if photometric == "MONOCHROME1":
                arr = arr.max() - arr
            display = _to_uint8(arr)
        sp = ds.get("PixelSpacing") or ds.get("ImagerPixelSpacing")
        if sp is not None and len(sp) == 2:
            spacing = (float(sp[0]), float(sp[1]))  # (row mm, column mm)
    else:
        with Image.open(io.BytesIO(data)) as img:
            if img.mode in ("I", "I;16", "I;16B", "F"):
                display = _to_uint8(np.asarray(img, dtype=np.float32))
            else:
                display = np.asarray(img.convert("L"), dtype=np.uint8)
    return {"display": display, "pixel_spacing_mm": spacing, "is_dicom": is_dicom}
