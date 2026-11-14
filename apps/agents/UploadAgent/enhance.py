"""Image loading, quality measurement and enhancement for uploaded studies.

Enhancement is for viewing and model input only: the original upload is always kept unchanged.
"""

import io

import cv2
import numpy as np
import pydicom
from pydicom.pixels import apply_modality_lut, apply_voi_lut
from skimage.restoration import estimate_sigma


class ImageLoadError(ValueError):
    """The uploaded bytes are not a readable image."""


def is_dicom(data: bytes) -> bool:
    return len(data) > 132 and data[128:132] == b"DICM"


def _to_uint8(arr: np.ndarray) -> np.ndarray:
    arr = arr.astype(np.float32)
    lo, hi = float(arr.min()), float(arr.max())
    if hi <= lo:
        return np.zeros(arr.shape, np.uint8)
    return ((arr - lo) * (255.0 / (hi - lo))).astype(np.uint8)


def _load_dicom(data: bytes) -> np.ndarray:
    try:
        ds = pydicom.dcmread(io.BytesIO(data), force=True)
        arr = ds.pixel_array
    except Exception as exc:
        raise ImageLoadError(f"could not read DICOM pixel data: {exc}") from exc
    if int(ds.get("NumberOfFrames", 1) or 1) > 1:
        arr = arr[0]  # multi-frame: enhance the first frame
    arr = apply_voi_lut(apply_modality_lut(arr, ds), ds)
    if ds.get("PhotometricInterpretation") == "MONOCHROME1":
        arr = arr.max() - arr  # MONOCHROME1 stores bright as low values
    return _to_uint8(arr)


def load_image(data: bytes, filename: str = "") -> np.ndarray:
    """Return a uint8 image: 2-D for grayscale, H x W x 3 (BGR) for colour."""
    if is_dicom(data) or filename.lower().endswith(".dcm"):
        return _load_dicom(data)

    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ImageLoadError("unsupported or corrupt image file")
    if img.ndim == 3 and img.shape[2] == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    if img.ndim == 3 and np.array_equal(img[..., 0], img[..., 1]) and np.array_equal(img[..., 1], img[..., 2]):
        img = img[..., 0]  # grayscale saved as RGB
    if img.dtype != np.uint8:
        img = _to_uint8(img)
    return img


def _luma(img: np.ndarray) -> np.ndarray:
    return img if img.ndim == 2 else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def _noise_sigma(gray: np.ndarray) -> float:
    # estimate on a downscaled copy: it is slow on full-size radiographs
    scale = 1024 / max(gray.shape)
    small = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else gray
    return float(estimate_sigma(small, channel_axis=None))


def measure(img: np.ndarray) -> dict:
    gray = _luma(img)
    h, w = gray.shape
    return {
        "width": int(w),
        "height": int(h),
        "channels": 1 if img.ndim == 2 else int(img.shape[2]),
        "brightness": round(float(gray.mean()) / 255, 3),
        "contrast": round(float(gray.std()) / 255, 3),
        "sharpness": round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 1),
        "noise_sigma": round(_noise_sigma(gray), 2),
        "clipped_dark": round(float((gray <= 2).mean()), 4),
        "clipped_bright": round(float((gray >= 253).mean()), 4),
    }


def quality_warnings(m: dict) -> list[str]:
    warnings = []
    if min(m["width"], m["height"]) < 512:
        warnings.append("Low resolution (shorter side under 512 px).")
    if m["brightness"] < 0.2:
        warnings.append("Image looks under-exposed.")
    elif m["brightness"] > 0.8:
        warnings.append("Image looks over-exposed.")
    if m["contrast"] < 0.12:
        warnings.append("Low contrast.")
    if m["sharpness"] < 50:
        warnings.append("Image may be blurred.")
    if m["clipped_dark"] + m["clipped_bright"] > 0.25:
        warnings.append("Large areas are clipped to pure black or white; detail there cannot be recovered.")
    return warnings


def enhance(img: np.ndarray) -> tuple[np.ndarray, list[str]]:
    """Denoise (only when noisy), stretch, CLAHE and a mild unsharp mask, on luminance only."""
    steps: list[str] = []
    if img.ndim == 2:
        lum, lab = img, None
    else:
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        lum = lab[..., 0]

    sigma = _noise_sigma(lum)
    if sigma > 3.0:
        lum = cv2.fastNlMeansDenoising(lum, None, h=min(15.0, sigma * 1.2), templateWindowSize=7, searchWindowSize=21)
        steps.append(f"denoise (estimated noise sigma {sigma:.1f})")

    lo, hi = np.percentile(lum, (0.5, 99.5))
    if hi - lo < 200 and hi > lo:
        lum = np.clip((lum.astype(np.float32) - lo) * (255.0 / (hi - lo)), 0, 255).astype(np.uint8)
        steps.append(f"contrast stretch ({lo:.0f}-{hi:.0f} -> 0-255)")

    lum = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lum)
    steps.append("CLAHE (clip 2.0, 8x8 tiles)")

    blur = cv2.GaussianBlur(lum, (0, 0), 1.5)
    lum = cv2.addWeighted(lum, 1.5, blur, -0.5, 0)
    steps.append("unsharp mask (amount 0.5, radius 1.5)")

    if lab is None:
        return lum, steps
    lab[..., 0] = lum
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR), steps
