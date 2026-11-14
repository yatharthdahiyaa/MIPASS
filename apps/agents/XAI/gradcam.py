"""Scores from the CheXpert ensemble, Grad-CAM from its DenseNet-121 member, and statistics about each map.

The maps show where the DenseNet member looked, not the ensemble as a whole: Grad-CAM needs one
network's gradients, and the DenseNet's last feature map is the most spatially detailed of the three.

The statistics (regions, location, edge attention) are what the Grok reviewer checks against the image.
Location assumes a standard frontal (PA/AP) radiograph: the patient's right is on the image left.
"""

import cv2
import numpy as np
import torch

from . import ensemble as ens
from .model import get_ensemble

MAX_SIDE = 1024        # maps and overlays are stored at most this size
HOT = 0.5              # a pixel is "hot" when it is >= 50% of the map's peak
MIN_REGION = 0.005     # ignore hot regions smaller than 0.5% of the image
EDGE_BAND = 0.08       # outer 8% of the image: attention here often means markers, labels or borders


def _scale_to(display: np.ndarray) -> np.ndarray:
    h, w = display.shape
    s = min(1.0, MAX_SIDE / max(h, w))
    return display if s == 1.0 else cv2.resize(display, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)


def _location(cx: float, cy: float) -> str:
    side = "right hemithorax" if cx < 0.4 else "left hemithorax" if cx > 0.6 else "central / mediastinal"
    zone = "upper zone" if cy < 0.4 else "mid zone" if cy < 0.65 else "lower zone"
    return f"{side}, {zone}"


def map_stats(cam: np.ndarray) -> dict:
    h, w = cam.shape
    hot = (cam >= HOT).astype(np.uint8)
    n, labels, stats, cents = cv2.connectedComponentsWithStats(hot, connectivity=8)
    regions = []
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if area < MIN_REGION * h * w:
            continue
        mask = labels == i
        cx, cy = cents[i][0] / w, cents[i][1] / h
        regions.append({
            "bbox_frac": [round(x / w, 3), round(y / h, 3), round(bw / w, 3), round(bh / h, 3)],
            "centroid_frac": [round(cx, 3), round(cy, 3)],
            "area_frac": round(area / (h * w), 4),
            "peak": round(float(cam[mask].max()), 3),
            "mean": round(float(cam[mask].mean()), 3),
            "location": _location(cx, cy),
        })
    regions.sort(key=lambda r: r["mean"] * r["area_frac"], reverse=True)

    total = float(cam.sum()) or 1.0
    by, bx = round(EDGE_BAND * h), round(EDGE_BAND * w)
    inner = float(cam[by:h - by, bx:w - bx].sum())
    return {
        "hot_area_frac": round(float(hot.mean()), 4),
        "edge_attention_frac": round(1 - inner / total, 3),
        "n_regions": len(regions),
        "regions": regions[:3],
    }


def overlay(display: np.ndarray, cam: np.ndarray) -> np.ndarray:
    """Jet heatmap blended by map strength, with the >=50% contour outlined."""
    gray = cv2.cvtColor(display, cv2.COLOR_GRAY2BGR).astype(np.float32)
    heat = cv2.applyColorMap((cam * 255).astype(np.uint8), cv2.COLORMAP_JET).astype(np.float32)
    alpha = (0.5 * cam)[..., None]
    out = (gray * (1 - alpha) + heat * alpha).clip(0, 255).astype(np.uint8)
    contours, _ = cv2.findContours((cam >= HOT).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(out, contours, -1, (255, 255, 255), max(1, round(max(cam.shape) / 512)))
    return out


def explain(pre: dict, max_maps: int = 6) -> dict:
    """Score every label with the ensemble; Grad-CAM for each positive one (or the top one if none is)."""
    model = get_ensemble()
    gray = pre["display"]
    probs = ens.predict(model, gray)
    scores = sorted(
        (
            {
                "name": c,
                "probability": round(probs["probabilities"][c], 4),
                "threshold": round(model.thresholds[c], 4),
                "positive": probs["probabilities"][c] >= model.thresholds[c],
                "members": {k: round(v[c], 4) for k, v in probs["members"].items()},
            }
            for c in model.labels
        ),
        key=lambda s: s["probability"] / s["threshold"],
        reverse=True,
    )
    targets = [s for s in scores if s["positive"]][:max_maps] or scores[:1]

    member = next(m for m in model.members if m.name == "densenet121")
    store: dict = {}
    hook = member.model.backbone.features.norm5.register_forward_hook(lambda m, i, o: store.__setitem__("act", o))
    try:
        logits = member.model(ens._input(gray, member))[0]
    finally:
        hook.remove()

    display = _scale_to(gray)
    act = store["act"]
    maps = []
    for t in targets:
        (grad,) = torch.autograd.grad(logits[model.labels.index(t["name"])], act, retain_graph=True)
        weights = grad[0].mean(dim=(1, 2), keepdim=True)
        cam = torch.relu((weights * act[0]).sum(0)).detach().numpy()
        peak = float(cam.max())
        cam = cam / peak if peak > 0 else cam
        cam = cv2.resize(cam, (display.shape[1], display.shape[0]), interpolation=cv2.INTER_CUBIC).clip(0, 1)
        maps.append({**t, "empty_map": peak <= 0, "stats": map_stats(cam), "overlay": overlay(display, cam)})
    member.model.zero_grad()
    return {"scores": scores, "maps": maps, "display": display}
