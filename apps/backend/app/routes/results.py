"""
Results routes — Serve XAI heatmaps, segmentation masks, and DICOM frames.

These endpoints serve the processed outputs for the frontend DICOM viewer
with heatmap overlay support.
"""

import io

import structlog
from flask import Blueprint, current_app, g, send_file, request

from app.middleware.auth_middleware import require_permission
from app.services.firestore import FirestoreService
from app.services.rbac import Permission, get_rbac_service
from app.services.storage import StorageService
from app.utils.response import api_response, api_error

logger = structlog.get_logger()
results_bp = Blueprint("results", __name__)


@results_bp.route("/jobs/<job_id>/heatmap", methods=["GET"])
@require_permission(Permission.XAI_READ)
def get_heatmap(job_id: str):
    """Get Grad-CAM++ heatmap overlay for a specific slice or full volume.

    Query Parameters:
        - slice_idx: Specific slice index (optional, returns full volume if omitted)
        - plane: Viewing plane — 'axial', 'coronal', 'sagittal' (default: axial)
        - format: 'png' (overlay image) or 'npy' (raw numpy array)
        - alpha: Overlay opacity 0.0–1.0 (default: 0.4)
    """
    firestore = FirestoreService(current_app.config)
    job = firestore.get_job(job_id)
    if not job:
        return api_error(f"Job {job_id} not found", 404)

    xai_status = job.get("xai", {}).get("gradcam", {}).get("status")
    if xai_status != "complete":
        return api_error(
            f"Grad-CAM++ is not ready (status: {xai_status}). "
            "Poll GET /jobs/{job_id} for status updates.",
            202,
        )

    # Determine which artifact to serve
    slice_idx = request.args.get("slice_idx", type=int)
    plane = request.args.get("plane", "axial")
    fmt = request.args.get("format", "png")

    storage = StorageService(current_app.config)

    if fmt == "png" and slice_idx is not None:
        # Serve a specific slice overlay PNG
        blob_path = f"xai/{job_id}/overlays/{plane}_{slice_idx:04d}.png"
        content = storage.download_blob(blob_path)
        if not content:
            return api_error(f"Overlay not found for {plane} slice {slice_idx}", 404)
        return send_file(
            io.BytesIO(content),
            mimetype="image/png",
            download_name=f"gradcam_{plane}_{slice_idx}.png",
        )
    elif fmt == "npy":
        # Serve full 3D heatmap as numpy array
        blob_path = f"xai/{job_id}/heatmap_gradcam.npy"
        content = storage.download_blob(blob_path)
        if not content:
            return api_error("Heatmap volume not found", 404)
        return send_file(
            io.BytesIO(content),
            mimetype="application/octet-stream",
            download_name=f"gradcam_{job_id}.npy",
        )
    else:
        # Return metadata about available overlays
        overlay_uris = job.get("xai", {}).get("gradcam", {}).get("overlay_uris", [])
        return api_response({
            "job_id": job_id,
            "method": "gradcam_plus_plus",
            "status": "complete",
            "available_planes": ["axial", "coronal", "sagittal"],
            "num_overlays": len(overlay_uris),
            "download_format": ["png", "npy"],
        })


@results_bp.route("/jobs/<job_id>/xai/<method>", methods=["GET"])
@require_permission(Permission.XAI_READ)
def get_xai_result(job_id: str, method: str):
    """Get a specific XAI method result.

    Path Parameters:
        - method: 'gradcam', 'occlusion', 'integrated_gradients'

    Query Parameters:
        - format: 'npy' (raw) or 'png' (visualization)
        - slice_idx: Specific slice (optional)
    """
    valid_methods = ["gradcam", "occlusion", "integrated_gradients"]
    if method not in valid_methods:
        return api_error(f"Invalid XAI method: {method}. Valid: {valid_methods}", 400)

    firestore = FirestoreService(current_app.config)
    job = firestore.get_job(job_id)
    if not job:
        return api_error(f"Job {job_id} not found", 404)

    # Ownership check
    rbac_service = get_rbac_service()
    if not rbac_service.can_access_job(g.current_user, job.get("user_id", ""), action="read"):
        return api_error("Forbidden: You do not have permission to view XAI for this study", 403)

    xai_data = job.get("xai", {}).get(method, {})
    if xai_data.get("status") != "complete":
        return api_error(
            f"XAI method '{method}' not ready (status: {xai_data.get('status')})",
            202,
        )

    # Map method to GCS filename
    filename_map = {
        "gradcam": "heatmap_gradcam.npy",
        "occlusion": "occlusion_map.npy",
        "integrated_gradients": "integrated_grads.npy",
    }

    storage = StorageService(current_app.config)
    blob_path = f"xai/{job_id}/{filename_map[method]}"
    content = storage.download_blob(blob_path)

    if not content:
        return api_error(f"XAI artifact not found: {method}", 404)

    return send_file(
        io.BytesIO(content),
        mimetype="application/octet-stream",
        download_name=f"{method}_{job_id}.npy",
    )


@results_bp.route("/jobs/<job_id>/segmentation", methods=["GET"])
@require_permission(Permission.XAI_READ)
def get_segmentation(job_id: str):
    """Get segmentation results — lesion mask + SHAP attribution.

    Query Parameters:
        - artifact: 'lesion_mask', 'shap', or 'all' (default: 'all')
        - format: 'npy' or 'json' (summary)
    """
    firestore = FirestoreService(current_app.config)
    job = firestore.get_job(job_id)
    if not job:
        return api_error(f"Job {job_id} not found", 404)

    # Ownership check
    rbac_service = get_rbac_service()
    if not rbac_service.can_access_job(g.current_user, job.get("user_id", ""), action="read"):
        return api_error("Forbidden: You do not have permission to view segmentation for this study", 403)

    seg_data = job.get("segmentation", {})
    if seg_data.get("status") != "complete":
        return api_error(
            f"Segmentation not ready (status: {seg_data.get('status')})",
            202,
        )

    artifact = request.args.get("artifact", "all")
    fmt = request.args.get("format", "json")

    if fmt == "json":
        # Return segmentation summary
        return api_response({
            "job_id": job_id,
            "status": "complete",
            "lesion_count": seg_data.get("lesion_count", 0),
            "lesion_volumes_mm3": seg_data.get("lesion_volumes_mm3", []),
            "artifacts": {
                "lesion_mask": f"/api/v1/jobs/{job_id}/segmentation?artifact=lesion_mask&format=npy",
                "shap_values": f"/api/v1/jobs/{job_id}/segmentation?artifact=shap&format=npy",
            },
        })

    # Serve binary artifact
    storage = StorageService(current_app.config)
    filename_map = {
        "lesion_mask": "lesion_mask.npy",
        "shap": "shap_values.npy",
    }

    if artifact not in filename_map:
        return api_error(f"Invalid artifact: {artifact}. Valid: {list(filename_map.keys())}", 400)

    blob_path = f"segmentation/{job_id}/{filename_map[artifact]}"
    content = storage.download_blob(blob_path)

    if not content:
        return api_error(f"Segmentation artifact not found: {artifact}", 404)

    return send_file(
        io.BytesIO(content),
        mimetype="application/octet-stream",
        download_name=f"{artifact}_{job_id}.npy",
    )


@results_bp.route("/jobs/<job_id>/dicom-frames", methods=["GET"])
@require_permission(Permission.RESULTS_READ)
def get_dicom_frames(job_id: str):
    """Serve processed DICOM frames as PNG images for the viewer.

    Query Parameters:
        - plane: 'axial', 'coronal', 'sagittal' (default: axial)
        - slice_idx: Specific slice index
        - overlay: 'none', 'gradcam', 'lesion_mask' (default: none)
        - window_center: DICOM window center (optional)
        - window_width: DICOM window width (optional)
    """
    firestore = FirestoreService(current_app.config)
    job = firestore.get_job(job_id)
    if not job:
        return api_error(f"Job {job_id} not found", 404)

    # Ownership check
    rbac_service = get_rbac_service()
    if not rbac_service.can_access_job(g.current_user, job.get("user_id", ""), action="read"):
        return api_error("Forbidden: You do not have permission to view frames for this study", 403)

    slice_idx = request.args.get("slice_idx", 0, type=int)
    plane = request.args.get("plane", "axial")
    overlay = request.args.get("overlay", "none")

    storage = StorageService(current_app.config)

    # Determine blob path based on overlay mode
    if overlay == "none":
        blob_path = f"processed/{job_id}/frames/{plane}_{slice_idx:04d}.png"
    elif overlay == "gradcam":
        blob_path = f"xai/{job_id}/overlays/{plane}_{slice_idx:04d}.png"
    elif overlay == "lesion_mask":
        blob_path = f"segmentation/{job_id}/overlays/{plane}_{slice_idx:04d}.png"
    else:
        return api_error(f"Invalid overlay: {overlay}", 400)

    content = storage.download_blob(blob_path)
    if not content:
        return api_error(f"Frame not found: {plane} slice {slice_idx}", 404)

    return send_file(
        io.BytesIO(content),
        mimetype="image/png",
        download_name=f"{plane}_{slice_idx}_{overlay}.png",
    )
