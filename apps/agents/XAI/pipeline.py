"""XAI pipeline: stored upload -> model scores + Grad-CAM -> Grok review -> draft report.

Outputs go to data/uploads/<upload_id>/xai/: image.png, <Finding>.png overlays (spaces as "_") and xai.json.
"""

import json
from datetime import datetime, timezone

import cv2

from UploadAgent import storage

from . import grok
from .gradcam import explain
from .model import CHECKPOINT_PATH, get_ensemble, preprocess, slug
from .prompt import model_output_text


def _xai_dir(upload_id: str):
    return storage.upload_dir(upload_id) / "xai"


def analyze(upload_id: str, use_grok: bool = True) -> dict:
    path = storage.original_path(upload_id)  # KeyError if unknown
    pre = preprocess(path.read_bytes(), path.name)
    result = explain(pre)

    out = _xai_dir(upload_id)
    out.mkdir(exist_ok=True)
    cv2.imwrite(str(out / "image.png"), result["display"])
    for m in result["maps"]:
        cv2.imwrite(str(out / f"{slug(m['name'])}.png"), m["overlay"])

    if not use_grok:
        review = {"status": "skipped", "reason": "not requested"}
    elif not grok.configured():
        review = {"status": "skipped", "reason": "XAI_API_KEY is not set"}
    else:
        images = [("ORIGINAL", result["display"])] + [(f"GRAD-CAM: {m['name']}", m["overlay"]) for m in result["maps"]]
        try:
            review = {"status": "ok", **grok.review(images, model_output_text(result["scores"], result["maps"], pre["pixel_spacing_mm"]))}
        except grok.GrokError as exc:
            review = {"status": "error", "reason": str(exc)}

    record = {
        "upload_id": upload_id,
        "analysed_at": datetime.now(timezone.utc).isoformat(),
        "status": "draft_requires_radiologist_signoff",
        "model": {
            "name": get_ensemble().model_name,
            "checkpoint": CHECKPOINT_PATH.name,
            "method": "ensemble scores (mean of 3 networks x hflip); Grad-CAM from the DenseNet-121 member",
        },
        "pixel_spacing_mm": pre["pixel_spacing_mm"],
        "scores": result["scores"],
        "gradcam": [
            {k: m[k] for k in ("name", "probability", "threshold", "positive", "empty_map", "stats")}
            | {"overlay": f"/xai/{upload_id}/image/{slug(m['name'])}.png"}
            for m in result["maps"]
        ],
        "image": f"/xai/{upload_id}/image/image.png",
        "grok": review,
    }
    (out / "xai.json").write_text(json.dumps(record, indent=2))
    return record


def read(upload_id: str) -> dict:
    path = _xai_dir(upload_id) / "xai.json"
    if not path.exists():
        raise KeyError(f"no XAI analysis for upload '{upload_id}'")
    return json.loads(path.read_text())


def image_path(upload_id: str, name: str):
    """Only serve files this pipeline wrote: image.png or a known finding overlay."""
    from .model import labels

    stem = name.removesuffix(".png")
    if stem != "image" and stem not in {slug(c) for c in labels()}:
        raise KeyError(f"unknown image '{name}'")
    path = _xai_dir(upload_id) / f"{stem}.png"
    if not path.exists():
        raise KeyError(f"unknown image '{name}'")
    return path
