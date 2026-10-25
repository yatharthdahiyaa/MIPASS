"""
Anatomical zone analysis for Grad-CAM saliency maps.

This module converts a raw Grad-CAM heatmap into a human-readable
"where the AI looked" report.  It does NOT claim that the heatmap is a
map of disease: Grad-CAM shows which pixels contributed most to the
model's score, not where the pathology definitely is.

For chest X-rays the image is divided into a 3 x 3 grid:

    upper / middle / lower  x  image-left / central / image-right

On a standard PA/AP chest radiograph the left side of the image is the
patient's right side and vice versa.  We therefore report BOTH the image
side and the patient side so the wording can never be ambiguous.
"""

from __future__ import annotations

import base64
import io
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFont


# ─────────────────────────────────────────────────────────────────────
# Grid definitions
# ─────────────────────────────────────────────────────────────────────

CHEST_ROWS = ("upper", "middle", "lower")
CHEST_COLS = ("image_left", "central", "image_right")

CHEST_ROW_LABELS = {
    "upper": "upper",
    "middle": "middle",
    "lower": "lower",
}

# Normalised grid edges (x0, x1) and (y0, y1)
CHEST_X_EDGES = (0.05, 0.34, 0.66, 0.95)
CHEST_Y_EDGES = (0.08, 0.38, 0.64, 0.92)

GENERIC_ROW_LABELS = ("top", "middle", "bottom")
GENERIC_COL_LABELS = ("left", "center", "right")


def _zone_meta(row_key: str, col_key: str, is_chest: bool) -> Dict[str, str]:
    """Return display metadata for a zone."""
    if is_chest:
        row_label = CHEST_ROW_LABELS[row_key]
        if col_key == "image_left":
            image_side = "left side of the image"
            patient_side = "patient's right side (standard PA/AP view)"
            short = f"{row_label.capitalize()} left (image)"
            label = (
                f"{row_label} zone on the left side of the image "
                f"(the patient's right lung on a standard PA/AP view)"
            )
        elif col_key == "central":
            image_side = "central area"
            patient_side = "central chest / mediastinum"
            short = f"{row_label.capitalize()} central"
            label = f"{row_label} central (mediastinal) zone"
        else:
            image_side = "right side of the image"
            patient_side = "patient's left side (standard PA/AP view)"
            short = f"{row_label.capitalize()} right (image)"
            label = (
                f"{row_label} zone on the right side of the image "
                f"(the patient's left lung on a standard PA/AP view)"
            )
        return {
            "key": f"{row_key}_{col_key}",
            "row": row_label,
            "col": col_key,
            "image_side": image_side,
            "patient_side": patient_side,
            "short_label": short,
            "label": label,
        }

    row_label = GENERIC_ROW_LABELS[CHEST_ROWS.index(row_key)]
    col_label = GENERIC_COL_LABELS[CHEST_COLS.index(col_key)]
    return {
        "key": f"{row_key}_{col_key}",
        "row": row_label,
        "col": col_label,
        "image_side": f"{col_label} side of the image",
        "patient_side": "confirm orientation with your clinician",
        "short_label": f"{row_label.capitalize()} {col_label}",
        "label": f"{row_label} {col_label} zone of the image",
    }


def _grid_edges(service_id: str) -> Tuple[Tuple[float, ...], Tuple[float, ...], bool]:
    """Return x edges, y edges and whether this is a chest study."""
    if service_id in ("qxr", "tb"):
        return CHEST_X_EDGES, CHEST_Y_EDGES, True
    return CHEST_X_EDGES, CHEST_Y_EDGES, False


# ─────────────────────────────────────────────────────────────────────
# Zone analysis
# ─────────────────────────────────────────────────────────────────────

def compute_zone_analysis(
    cam: np.ndarray,
    service_id: str = "qxr",
    top_percent: float = 10.0,
    border_percent: float = 0.05,
) -> Optional[Dict[str, Any]]:
    """Summarise a Grad-CAM map by anatomical zone.

    Args:
        cam: 2-D float array in [0, 1] (Grad-CAM upsampled to image size).
        service_id: Service identifier (qxr/tb use chest labels).
        top_percent: Percentage of strongest CAM pixels used to define the
            focal activation mask.
        border_percent: Fraction of the image border to ignore (reduces
            edge/letterbox artefacts).

    Returns:
        A JSON-serialisable dict, or None if the CAM is not usable.
    """
    try:
        arr = np.asarray(cam, dtype=np.float32)
        if arr.ndim > 2:
            arr = np.squeeze(arr)
        if arr.ndim != 2 or arr.size == 0:
            return None

        arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)
        arr = np.clip(arr, 0.0, None)
        vmax = float(arr.max())
        if vmax > 0:
            arr = arr / vmax

        h, w = arr.shape
        bx = max(0, int(w * border_percent))
        by = max(0, int(h * border_percent))
        if bx or by:
            arr = arr.copy()
            arr[:by, :] = 0.0
            arr[-by:, :] = 0.0
            arr[:, :bx] = 0.0
            arr[:, -bx:] = 0.0

        flat = arr.ravel()
        k = max(1, int(flat.size * max(0.1, min(top_percent, 100.0)) / 100.0))
        threshold = float(np.partition(flat, -k)[-k])
        mask = arr >= threshold
        if not mask.any():
            mask = arr > 0
        if not mask.any():
            return None

        total_top = float(mask.sum())
        total_cam = float(arr.sum()) or 1.0

        x_edges, y_edges, is_chest = _grid_edges(service_id)
        xs = [int(round(v * (w - 1))) for v in x_edges]
        ys = [int(round(v * (h - 1))) for v in y_edges]

        zones: List[Dict[str, Any]] = []
        for r_idx, row_key in enumerate(CHEST_ROWS):
            for c_idx, col_key in enumerate(CHEST_COLS):
                y0, y1 = ys[r_idx], ys[r_idx + 1]
                x0, x1 = xs[c_idx], xs[c_idx + 1]
                zone_mask = mask[y0:y1, x0:x1]
                zone_cam = arr[y0:y1, x0:x1]
                count = float(zone_mask.sum())
                share = (count / total_top * 100.0) if total_top else 0.0
                cam_share = (
                    float(zone_cam.sum()) / total_cam * 100.0 if total_cam else 0.0
                )
                meta = _zone_meta(row_key, col_key, is_chest)
                zones.append(
                    {
                        **meta,
                        "row_index": r_idx,
                        "col_index": c_idx,
                        "share_pct": round(share, 1),
                        "activation_share_pct": round(cam_share, 1),
                        "mean_activation": round(float(zone_cam.mean()), 4),
                        "peak_activation": round(float(zone_cam.max()), 4),
                        "pixel_count": int(count),
                    }
                )

        zones.sort(key=lambda z: z["share_pct"], reverse=True)
        dominant = zones[0]
        second = zones[1] if len(zones) > 1 else {"share_pct": 0.0}
        # A zone is "focal" when it carries a clear plurality of the
        # strongest activation.  Otherwise the heatmap is diffuse and we
        # should not over-claim a location.
        is_localized = (
            dominant["share_pct"] >= 35.0
            and dominant["share_pct"] >= second["share_pct"] * 1.6
        )

        if is_localized:
            sentence = (
                f"The strongest heatmap focus is in the "
                f"{dominant['label']}."
            )
            confidence = "focal"
        else:
            sentence = (
                f"The heatmap activation is spread across several zones. "
                f"The strongest focus is in the {dominant['label']}, "
                f"but no single zone clearly dominates."
            )
            confidence = "diffuse"

        laterality_note = (
            "On a standard PA/AP chest X-ray, the left side of the image is "
            "the patient's right side, and the right side of the image is the "
            "patient's left side. Confirm orientation with the radiology report."
            if is_chest
            else "Left/right here refers to the image, not the patient. "
            "Confirm orientation with your clinician."
        )

        return {
            "method": "Grad-CAM top-activation mask, 3 x 3 anatomical grid",
            "top_percent": top_percent,
            "is_chest": is_chest,
            "dominant_zone": dominant["key"],
            "dominant_zone_label": dominant["label"],
            "dominant_short_label": dominant["short_label"],
            "dominant_share_pct": dominant["share_pct"],
            "dominant_activation_share_pct": dominant["activation_share_pct"],
            "image_side": dominant["image_side"],
            "patient_side": dominant["patient_side"],
            "is_localized": is_localized,
            "localization_confidence": confidence,
            "localization_sentence": sentence,
            "laterality_note": laterality_note,
            "zones": zones,
            "grid": {
                "x_edges": list(x_edges),
                "y_edges": list(y_edges),
                "rows": ["upper", "middle", "lower"],
                "cols": ["image_left", "central", "image_right"],
            },
        }
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────
# Annotated heatmap for patient display
# ─────────────────────────────────────────────────────────────────────

def _load_font(size: int) -> ImageFont.ImageFont:
    for name in ("arial.ttf", "DejaVuSans.ttf", "LiberationSans-Regular.ttf"):
        try:
            return ImageFont.truetype(name, size=size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size=size)  # Pillow >= 10
    except Exception:
        return ImageFont.load_default()


def annotate_heatmap_with_zones(
    overlay_b64: str,
    analysis: Optional[Dict[str, Any]],
    demo_mode: bool = False,
) -> str:
    """Draw the zone grid and highlight the dominant zone on a heatmap PNG.

    Returns the original base64 string if annotation is not possible.
    """
    if not overlay_b64 or not analysis:
        return overlay_b64

    try:
        raw = base64.b64decode(overlay_b64)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        w, h = img.size
        draw = ImageDraw.Draw(img, "RGBA")

        grid = analysis.get("grid") or {}
        x_edges = grid.get("x_edges") or list(CHEST_X_EDGES)
        y_edges = grid.get("y_edges") or list(CHEST_Y_EDGES)
        xs = [int(round(v * (w - 1))) for v in x_edges]
        ys = [int(round(v * (h - 1))) for v in y_edges]

        line_color = (255, 255, 255, 120)
        for x in xs[1:-1]:
            draw.line([(x, ys[0]), (x, ys[-1])], fill=line_color, width=max(1, w // 400))
        for y in ys[1:-1]:
            draw.line([(xs[0], y), (xs[-1], y)], fill=line_color, width=max(1, h // 400))

        # Highlight the dominant zone
        zones = analysis.get("zones") or []
        if zones:
            dom = zones[0]
            r_idx = int(dom.get("row_index", 0))
            c_idx = int(dom.get("col_index", 0))
            x0, x1 = xs[c_idx], xs[c_idx + 1]
            y0, y1 = ys[r_idx], ys[r_idx + 1]
            draw.rectangle(
                [x0 + 2, y0 + 2, x1 - 2, y1 - 2],
                outline=(255, 235, 59, 255),
                width=max(2, w // 180),
            )

        # Banner with the dominant zone
        font = _load_font(max(14, int(w * 0.028)))
        small = _load_font(max(11, int(w * 0.020)))
        title = "SYNTHETIC DEMO HEATMAP" if demo_mode else "AI heatmap focus"
        focus = analysis.get("dominant_short_label", "unknown zone")
        share = analysis.get("dominant_share_pct", 0)
        line1 = f"{title}: {focus}  ({share}% of strongest activation)"
        line2 = (
            "Demo only - not from a trained model. Not proof of disease."
            if demo_mode
            else "Warm colours = more AI attention. This is not proof of disease."
        )

        banner_h = int(h * 0.13)
        draw.rectangle([0, 0, w, banner_h], fill=(8, 15, 30, 205))
        draw.text((int(w * 0.025), int(h * 0.018)), line1, font=font, fill=(255, 255, 255, 255))
        draw.text(
            (int(w * 0.025), int(h * 0.018) + font.size + 6),
            line2,
            font=small,
            fill=(203, 213, 225, 255),
        )

        # Corner labels for the grid
        draw.text((xs[0] + 4, ys[-1] + 4), "IMAGE LEFT", font=small, fill=(255, 255, 255, 200))
        draw.text((xs[1] + 4, ys[-1] + 4), "CENTRAL", font=small, fill=(255, 255, 255, 200))
        draw.text((xs[2] + 4, ys[-1] + 4), "IMAGE RIGHT", font=small, fill=(255, 255, 255, 200))

        out = io.BytesIO()
        img.save(out, format="PNG")
        return base64.b64encode(out.getvalue()).decode("utf-8")
    except Exception:
        return overlay_b64
