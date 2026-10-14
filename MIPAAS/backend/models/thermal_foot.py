"""
Plantar Thermogram Diabetic Foot & DM Screening Models.

Integrated from MODELS/Diabetic-foot-detect-using-thermal-image.
Extracts bilateral asymmetry metrics, GLCM texture features, and thermal statistics
for early diabetic foot complication and neuropathy screening.
"""

import numpy as np
import pandas as pd
import joblib
from scipy import ndimage
from scipy.stats import entropy


def repair_foot_matrix(mat: np.ndarray, max_hole_pixels: int = 10):
    """Repair missing sensor pixels inside the foot area."""
    clean = np.asarray(mat, dtype=np.float32).copy()
    if clean.ndim != 2 or clean.size == 0:
        raise ValueError("Expected a non-empty 2D temperature matrix.")
    mask = np.isfinite(clean) & (clean > 0)
    if not mask.any():
        return clean, mask
    holes = ndimage.binary_fill_holes(mask) & ~mask
    hole_labels, n = ndimage.label(holes)
    for i in range(1, n + 1):
        region = hole_labels == i
        if region.sum() > max_hole_pixels:
            continue
        boundary = ndimage.binary_dilation(region, structure=np.ones((3, 3), bool)) & mask
        if not boundary.any():
            continue
        clean[region] = float(np.median(clean[boundary]))
        mask[region] = True
    return clean, mask


def standardize_foot_geometry(mat: np.ndarray, is_left: bool = False, target_shape: tuple[int, int] = (128, 64)):
    """Align and resize the foot thermal matrix to standard target shape."""
    clean, mask = repair_foot_matrix(mat)
    mask &= np.isfinite(clean) & (clean > 0)
    th, tw = target_shape
    if not mask.any():
        return np.zeros(target_shape, np.float32)

    if is_left:
        clean, mask = np.fliplr(clean), np.fliplr(mask)

    rows, cols = np.any(mask, 1), np.any(mask, 0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    crop = clean[rmin : rmax + 1, cmin : cmax + 1]
    cmask = mask[rmin : rmax + 1, cmin : cmax + 1]

    ch, cw = crop.shape
    s = min(th / ch, tw / cw)
    nh = max(1, min(th, int(round(ch * s))))
    nw = max(1, min(tw, int(round(cw * s))))

    try:
        import cv2
        num = cv2.resize(np.where(cmask, crop, 0.0).astype(np.float32), (nw, nh), interpolation=cv2.INTER_LINEAR)
        wts = cv2.resize(cmask.astype(np.float32), (nw, nh), interpolation=cv2.INTER_LINEAR)
        valid = cv2.resize(cmask.astype(np.uint8), (nw, nh), interpolation=cv2.INTER_NEAREST).astype(bool)
        valid &= wts > 1e-6
        rt = np.zeros((nh, nw), np.float32)
        rt[valid] = num[valid] / wts[valid]
    except ImportError:
        # Fallback using scipy.ndimage
        zoom_factors = (nh / ch, nw / cw)
        rt = ndimage.zoom(crop, zoom_factors, order=1)

    out = np.zeros(target_shape, np.float32)
    y0, x0 = (th - nh) // 2, (tw - nw) // 2
    out[y0 : y0 + nh, x0 : x0 + nw] = rt[:nh, :nw]
    return out


def thermal_stats(values: np.ndarray, prefix: str) -> dict[str, float]:
    """Compute statistical moments over valid foot temperatures."""
    v = np.asarray(values, np.float32)
    v = v[np.isfinite(v)]
    keys = ["mean", "std", "min", "max", "median", "p10", "p90", "range"]
    if v.size == 0:
        return {f"{prefix}_{k}": np.nan for k in keys}
    return {
        f"{prefix}_mean": float(v.mean()),
        f"{prefix}_std": float(v.std()),
        f"{prefix}_min": float(v.min()),
        f"{prefix}_max": float(v.max()),
        f"{prefix}_median": float(np.median(v)),
        f"{prefix}_p10": float(np.percentile(v, 10)),
        f"{prefix}_p90": float(np.percentile(v, 90)),
        f"{prefix}_range": float(np.ptp(v)),
    }


def glcm_features(temp_mat: np.ndarray) -> dict[str, float]:
    """Compute gray-level co-occurrence matrix texture metrics."""
    mat = np.asarray(temp_mat, np.float32)
    mask = np.isfinite(mat) & (mat > 0)
    nan_dict = {"entropy": np.nan, "glcm_contrast": np.nan, "glcm_homogeneity": np.nan}
    if mat.ndim != 2 or not mask.any():
        return nan_dict
    values = mat[mask]
    hist, _ = np.histogram(values, bins=np.linspace(20.0, 36.0, 17))
    hist = np.concatenate(([int((values < 20).sum())], hist, [int((values > 36).sum())]))
    hist = hist[hist > 0].astype(np.float64)
    ent = float(entropy(hist / hist.sum()))

    clipped = np.clip(mat, 20.0, 36.0)
    q = np.zeros(mat.shape, np.uint8)
    q[mask] = np.clip(np.floor((clipped[mask] - 20.0) / 16.0 * 16), 0, 15).astype(np.uint8)
    pm = mask[:, :-1] & mask[:, 1:]
    if not pm.any():
        return {"entropy": ent, "glcm_contrast": np.nan, "glcm_homogeneity": np.nan}
    a, b = q[:, :-1][pm].astype(int), q[:, 1:][pm].astype(int)
    g = np.zeros((16, 16), np.float64)
    np.add.at(g, (a, b), 1)
    np.add.at(g, (b, a), 1)
    if g.sum() > 0:
        g /= g.sum()
    i, j = np.indices(g.shape)
    return {
        "entropy": ent,
        "glcm_contrast": float(np.sum(g * (i - j) ** 2)),
        "glcm_homogeneity": float(np.sum(g / (1.0 + (i - j) ** 2))),
    }


def _valid(mat: np.ndarray) -> np.ndarray:
    mat = np.asarray(mat, np.float32)
    return mat[np.isfinite(mat) & (mat > 0)]


def extract_features(mat_l: np.ndarray, mat_r: np.ndarray, angiosomes: dict | None = None, target_shape=(128, 64)) -> dict:
    """Extract full feature set from bilateral plantar thermograms."""
    std_l = standardize_foot_geometry(mat_l, is_left=True, target_shape=target_shape)
    std_r = standardize_foot_geometry(mat_r, is_left=False, target_shape=target_shape)

    f: dict[str, Any] = {}
    f.update(thermal_stats(_valid(std_l), "L_foot"))
    f.update(thermal_stats(_valid(std_r), "R_foot"))
    f.update({f"L_{k}": v for k, v in glcm_features(std_l).items()})
    f.update({f"R_{k}": v for k, v in glcm_features(std_r).items()})

    ml, mr = f.get("L_foot_mean", np.nan), f.get("R_foot_mean", np.nan)
    xl, xr = f.get("L_foot_max", np.nan), f.get("R_foot_max", np.nan)
    ok = np.isfinite(ml) and np.isfinite(mr)

    f["asym_mean_diff"] = abs(ml - mr) if ok else np.nan
    f["asym_mean_signed_diff"] = ml - mr if ok else np.nan
    f["both_feet_mean"] = (ml + mr) / 2.0 if ok else np.nan
    f["asym_mean_ratio"] = ml / mr if ok and abs(mr) > 1e-6 else np.nan

    okm = np.isfinite(xl) and np.isfinite(xr)
    f["asym_max_diff"] = abs(xl - xr) if okm else np.nan
    f["both_feet_max"] = max(xl, xr) if okm else np.nan

    angiosomes = angiosomes or {}
    for side in ["L", "R"]:
        for ang in ["LCA", "LPA", "MCA", "MPA"]:
            m = angiosomes.get(f"{side}_{ang}")
            px = _valid(m) if m is not None else np.array([])
            f[f"{side}_{ang}_mean"] = float(px.mean()) if px.size else np.nan

    return f
