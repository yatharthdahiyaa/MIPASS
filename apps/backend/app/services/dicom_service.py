"""
Chest X-ray reading: file validation, DICOM handling, and the CheXpert ensemble.

1. Validation: DICOM (pydicom) or PNG / JPEG / WEBP.
2. Pixels: DICOM modality and VOI look-up tables, MONOCHROME1 inversion, robust scaling to 8 bit.
3. Inference: ``app.services.cxr_ensemble`` (three networks, mirror-image averaging, the
   checkpoint's own thresholds). Nothing is ever substituted when the model is missing.
4. Output: the findings, a severity grade, a plain description of what the model can and cannot
   see, follow-up suggestions for the reviewing clinician, a preview and a Grad-CAM overlay.

The text this module writes is decision support for a clinician. It names what the model flagged
and how confidently; it never recommends treatment, and it never states that something the model
does not look for is absent.
"""

from __future__ import annotations

import base64
import io
from typing import Any

import numpy as np
import pydicom
import structlog
from PIL import Image

from app.paths import CXR_CHECKPOINT_PATH

logger = structlog.get_logger()

PREVIEW_MAX_SIDE = 1600  # stored previews and overlays; the model has its own input size

DESCRIPTIONS = {
    "Cardiomegaly": "Enlargement of the cardiac silhouette.",
    "Lung Opacity": "An area of increased density in the lung; many causes (infection, fluid, collapse, mass).",
    "Edema": "Fluid in the lung interstitium or air spaces, often cardiogenic.",
    "Consolidation": "Air spaces filled with fluid, pus, blood or cells; infection is a common cause.",
    "Atelectasis": "Partial collapse or incomplete expansion of lung tissue.",
    "Pleural Effusion": "Fluid in the pleural space between the lung and the chest wall.",
    "Support Devices": "Lines, tubes, pacemaker leads or other devices visible on the film.",
}

# Findings that make a study worth prompt review when the model flags them.
ACUTE = {"Edema", "Consolidation", "Pleural Effusion", "Lung Opacity"}

# Follow-up a reviewing clinician commonly considers. Never treatment.
FOLLOW_UP = {
    "Cardiomegaly": "Assess heart size on the image (projection affects it); echocardiography if enlargement is confirmed and not already known.",
    "Edema": "Review for signs of fluid overload alongside the clinical picture.",
    "Consolidation": "Correlate with symptoms and examination; follow-up radiograph after treatment if indicated.",
    "Lung Opacity": "Characterise the opacity on the image; follow-up radiograph to confirm resolution if indicated.",
    "Atelectasis": "Correlate clinically; follow-up if it persists or is unexplained.",
    "Pleural Effusion": "Ultrasound can confirm and quantify an effusion if needed.",
    "Support Devices": "Confirm the position of lines and tubes on the image.",
}

SCOPE_NOTE = (
    "The model assesses six findings (cardiomegaly, lung opacity, oedema, consolidation, atelectasis, "
    "pleural effusion) and support devices. It does not assess pneumothorax, nodules, masses or fractures."
)
DISCLAIMER = (
    "Decision support for qualified clinicians, not a diagnosis. Findings must be confirmed on the image "
    "by a radiologist or the treating doctor."
)


# --------------------------------------------------------------------------- validation


def is_valid_dicom(file_bytes: bytes, filename: str = "") -> tuple[bool, str | None]:
    """Whether the file is a DICOM image with pixel data."""
    fn = filename.lower()
    is_dcm_ext = fn.endswith((".dcm", ".dicom"))
    has_dicm_magic = len(file_bytes) > 132 and file_bytes[128:132] == b"DICM"
    try:
        ds = pydicom.dcmread(io.BytesIO(file_bytes), force=False)
        if "PixelData" not in ds:
            return False, "This DICOM file has no image data."
        return True, None
    except Exception:
        if is_dcm_ext or has_dicm_magic:
            try:
                ds = pydicom.dcmread(io.BytesIO(file_bytes), force=True)
                if "PixelData" in ds:
                    return True, None
            except Exception as exc:
                return False, f"Corrupted or invalid DICOM file: {exc}"
    return False, "File is not a valid DICOM image (.dcm / .dicom)."


def is_valid_chest_image(file_bytes: bytes, filename: str = "") -> tuple[bool, str | None]:
    """A DICOM, PNG, JPEG or WEBP image this service can read."""
    if is_valid_dicom(file_bytes, filename)[0]:
        return True, None
    fn = filename.lower()
    if fn.endswith((".png", ".jpg", ".jpeg", ".webp")) or not fn:
        try:
            with Image.open(io.BytesIO(file_bytes)) as img:
                img.verify()
            return True, None
        except Exception as exc:
            return False, f"Invalid or unreadable image file: {exc}"
    return False, "Please upload a chest X-ray as DICOM (.dcm), PNG or JPEG."


def extract_dicom_metadata(ds: pydicom.Dataset) -> dict[str, Any]:
    """Technical tags for display. Identifiers are read only for the clinician's own study."""

    def tag(name: str, default: str = "") -> str:
        try:
            value = getattr(ds, name, default)
            return str(value).strip() if value is not None else default
        except Exception:
            return default

    rows, cols = getattr(ds, "Rows", 0), getattr(ds, "Columns", 0)
    return {
        "patient_id": tag("PatientID"),
        "patient_name": tag("PatientName").replace("^", " "),
        "patient_sex": tag("PatientSex"),
        "patient_age": tag("PatientAge"),
        "study_date": tag("StudyDate"),
        "study_description": tag("StudyDescription"),
        "modality": tag("Modality", "DX"),
        "body_part_examined": tag("BodyPartExamined"),
        "view_position": tag("ViewPosition"),
        "dimensions": f"{cols} × {rows}",
        "photometric_interpretation": tag("PhotometricInterpretation", "MONOCHROME2"),
    }


# --------------------------------------------------------------------------- pixels


def _to_uint8(arr: np.ndarray) -> np.ndarray:
    """Robust 8-bit scaling: the 0.5th to 99.5th percentile spans 0 to 255."""
    arr = arr.astype(np.float32)
    lo, hi = np.percentile(arr, (0.5, 99.5))
    if hi <= lo:
        lo, hi = float(arr.min()), float(arr.max())
    if hi <= lo:
        return np.zeros(arr.shape, dtype=np.uint8)
    return np.clip((arr - lo) / (hi - lo) * 255.0, 0, 255).astype(np.uint8)


def dicom_to_gray(ds: pydicom.Dataset) -> np.ndarray:
    """DICOM pixels as uint8 grayscale, displayed the way a viewer would show them."""
    from pydicom.pixels import apply_modality_lut, apply_voi_lut

    arr = ds.pixel_array
    photometric = str(getattr(ds, "PhotometricInterpretation", "MONOCHROME2")).upper()
    if arr.ndim == 3 and photometric not in ("RGB", "YBR_FULL", "YBR_FULL_422"):
        arr = arr[0]  # multi-frame: the first frame
    if arr.ndim == 3:  # colour DICOM
        return np.asarray(Image.fromarray(_to_uint8(arr)).convert("L"))
    arr = apply_modality_lut(arr, ds)
    if "WindowCenter" in ds or "VOILUTSequence" in ds:
        arr = apply_voi_lut(arr, ds, index=0)
    arr = arr.astype(np.float32)
    if photometric == "MONOCHROME1":  # 0 is white
        arr = arr.max() - arr
    return _to_uint8(arr)


def image_to_gray(file_bytes: bytes) -> np.ndarray:
    with Image.open(io.BytesIO(file_bytes)) as img:
        if img.mode in ("I", "I;16", "I;16B", "F"):  # 16-bit PNGs
            return _to_uint8(np.asarray(img, dtype=np.float32))
        return np.asarray(img.convert("L"), dtype=np.uint8)


def _shrink(gray: np.ndarray) -> np.ndarray:
    h, w = gray.shape
    scale = PREVIEW_MAX_SIDE / max(h, w)
    if scale >= 1:
        return gray
    return np.asarray(Image.fromarray(gray).resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS))


def array_to_base64_png(img_array: np.ndarray) -> str:
    buf = io.BytesIO()
    Image.fromarray(img_array).save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _overlay(gray: np.ndarray, cam: np.ndarray) -> np.ndarray:
    """Jet-style colour map blended over the radiograph (red = most attention)."""
    r = np.clip(1.5 - np.abs(cam * 4.0 - 3.0), 0, 1)
    g = np.clip(1.5 - np.abs(cam * 4.0 - 2.0), 0, 1)
    b = np.clip(1.5 - np.abs(cam * 4.0 - 1.0), 0, 1)
    heat = np.stack([r, g, b], axis=-1) * 255.0
    base = np.stack([gray] * 3, axis=-1).astype(np.float32)
    alpha = 0.45 * cam[..., None]
    return np.clip(base * (1 - alpha) + heat * alpha, 0, 255).astype(np.uint8)


# --------------------------------------------------------------------------- reading


def _certainty(probability: float, threshold: float) -> str | None:
    ratio = round(probability / threshold, 6) if threshold else 0  # 0.30 / 0.20 is 1.4999999999999998
    if ratio >= 1.5:
        return "high"
    if ratio >= 1.15:
        return "moderate"
    if ratio >= 1.0:
        return "low"
    return None


def _severity(positives: list[dict], borderline: list[dict]) -> str:
    """NORMAL < MODERATE < HIGH.

    HIGH needs an acute finding at moderate certainty or more (1.15x its threshold): the thresholds
    were tuned per finding with Youden's J, so with six findings a normal film often grazes one of
    them, and a single marginal flag should not put a study in the urgent queue. It is still listed,
    at low certainty. CRITICAL is not used: none of the model's findings is an emergency on its own,
    and it cannot see the ones that are (e.g. pneumothorax)."""
    if any(p["name"] in ACUTE and p["certainty"] in ("moderate", "high") for p in positives):
        return "HIGH"
    if positives or borderline:
        return "MODERATE"
    return "NORMAL"


def read_radiograph(gray: np.ndarray) -> dict[str, Any]:
    """Run the ensemble on a uint8 grayscale radiograph and describe the result."""
    from app.services import cxr_ensemble  # torch and timm: only when a reading is requested

    if not CXR_CHECKPOINT_PATH.is_file():
        raise RuntimeError(f"Chest X-ray model not found at {CXR_CHECKPOINT_PATH} (set MIPAAS_CXR_CHECKPOINT).")
    ensemble = cxr_ensemble.get(CXR_CHECKPOINT_PATH)
    prediction = cxr_ensemble.predict(ensemble, gray)
    probs = prediction["probabilities"]

    pathologies = []
    for label in ensemble.labels:
        p, thr = probs[label], ensemble.thresholds[label]
        pathologies.append(
            {
                "name": label,
                "probability": round(p, 4),
                "threshold": round(thr, 4),
                "positive": p >= thr,
                "certainty": _certainty(p, thr),
                "description": DESCRIPTIONS.get(label, ""),
                "members": {name: round(m[label], 4) for name, m in prediction["members"].items()},
            }
        )
    by_strength = sorted(pathologies, key=lambda x: x["probability"] / x["threshold"], reverse=True)
    findings = [p for p in by_strength if p["name"] not in cxr_ensemble.NON_PATHOLOGY]
    positives = [p for p in findings if p["positive"]]
    borderline = [p for p in findings if not p["positive"] and p["probability"] >= 0.85 * p["threshold"]]
    devices = next((p for p in pathologies if p["name"] in cxr_ensemble.NON_PATHOLOGY and p["positive"]), None)

    severity = _severity(positives, borderline)
    # Only a flagged finding is "primary": a negative study has none (the strongest score is still in pathologies).
    primary = positives[0] if positives else None

    if positives:
        listed = "; ".join(f"{p['name'].lower()} ({p['certainty']} confidence)" for p in positives)
        summary = f"The model flagged: {listed}."
    elif borderline:
        summary = "No finding reached the model's threshold. Close to it: " + ", ".join(p["name"].lower() for p in borderline) + "."
    else:
        summary = "No finding reached the model's threshold."
    if devices:
        summary += " Support devices appear to be present."
    summary += " " + SCOPE_NOTE

    actions = ["Review the image to confirm or dismiss each flagged finding."] if positives or borderline else []
    actions += [FOLLOW_UP[p["name"]] for p in positives if p["name"] in FOLLOW_UP]
    if devices:
        actions.append(FOLLOW_UP["Support Devices"])
    if not actions:
        actions.append("Read the image as usual; a negative screen does not exclude findings the model does not assess.")

    heatmap = None
    target = positives[0]["name"] if positives else None
    if target:
        try:
            heatmap = cxr_ensemble.gradcam(ensemble, gray, target)
        except Exception as exc:  # the reading stands without its map
            logger.warning("cxr_gradcam_failed", error=str(exc))

    return {
        "model_architecture": ensemble.model_name,
        "model_version": f"chexpert_ensemble.pth ({ensemble.created})" if ensemble.created else "chexpert_ensemble.pth",
        "pathologies": sorted(pathologies, key=lambda x: x["probability"], reverse=True),
        "positive_findings": positives,
        "primary_diagnosis": primary["name"] if primary else None,
        "confidence": primary["probability"] if primary else None,
        "severity": severity,
        "clinical_summary": summary,
        "recommended_actions": actions,
        "heatmap": heatmap,
        "heatmap_target": target,
    }


def analyze_dicom_image(file_bytes: bytes, filename: str = "") -> dict[str, Any]:
    """Validate, read and describe one chest radiograph (DICOM, PNG, JPEG or WEBP)."""
    if is_valid_dicom(file_bytes, filename)[0]:
        ds = pydicom.dcmread(io.BytesIO(file_bytes), force=True)
        metadata = extract_dicom_metadata(ds) | {"is_dicom": True, "image_format": "DICOM"}
        gray = dicom_to_gray(ds)
    else:
        ok, err = is_valid_chest_image(file_bytes, filename)
        if not ok:
            raise ValueError(err or "Please upload a chest X-ray as DICOM (.dcm), PNG or JPEG.")
        gray = image_to_gray(file_bytes)
        ext = filename.rsplit(".", 1)[-1].upper() if "." in filename else "PNG"
        metadata = {"is_dicom": False, "image_format": ext, "dimensions": f"{gray.shape[1]} × {gray.shape[0]}"}

    reading = read_radiograph(gray)
    display = _shrink(gray)
    heat = reading.pop("heatmap")
    if heat is not None:
        cam = np.asarray(Image.fromarray((heat * 255).astype(np.uint8)).resize((display.shape[1], display.shape[0])), dtype=np.float32) / 255.0
        heatmap_b64 = array_to_base64_png(_overlay(display, cam))
    else:
        heatmap_b64 = None

    return {
        "status": "success",
        **reading,
        "confidence_percentage": round(reading["confidence"] * 100, 1) if reading["confidence"] is not None else None,
        "dicom_metadata": metadata,
        "preview_image": array_to_base64_png(display),
        "heatmap_image": heatmap_b64,
        "disclaimer": DISCLAIMER,
    }
