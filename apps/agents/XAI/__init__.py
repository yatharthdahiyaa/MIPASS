"""XAI: Grad-CAM explanations for the chest X-ray model, reviewed by Grok into a draft structured report.

- POST /xai/analyze               multipart 'file' or {"upload_id"}; ?grok=false for Grad-CAM only
- GET  /xai/<upload_id>           stored analysis
- GET  /xai/<upload_id>/image/<image.png | Finding.png>
- agent 'xai_cxr_report'          {"upload_id": ..., "grok": true}

Env: MIPAAS_CXR_CHECKPOINT (default ml/chexpert_ensemble.pth), XAI_API_KEY, XAI_MODEL (default grok-4.7), XAI_TIMEOUT.
"""

from registry import agent

from .pipeline import analyze
from .routes import xai_bp

__all__ = ["xai_bp", "analyze"]


@agent(
    "xai_cxr_report",
    description="Grad-CAM for each chest X-ray finding, checked by Grok, with a draft structured report.",
    inputs={
        "type": "object",
        "properties": {
            "upload_id": {"type": "string", "description": "Id of an uploaded chest X-ray."},
            "grok": {"type": "boolean", "default": True, "description": "Have Grok review the Grad-CAM maps and draft the report."},
        },
        "required": ["upload_id"],
    },
)
def xai_cxr_report(inputs, backend):
    upload_id = inputs.get("upload_id")
    if not upload_id:
        raise ValueError("inputs.upload_id is required")
    return analyze(upload_id, use_grok=bool(inputs.get("grok", True)))
