"""
Upload routes — Generate GCS Signed URLs for direct DICOM upload.

The frontend never uploads through the API server. Instead:
1. Frontend requests a signed URL from this endpoint
2. Frontend uploads directly to GCS using the signed URL
3. GCS triggers a Pub/Sub notification on upload completion
4. The async pipeline picks it up from there
"""

import uuid
from datetime import datetime

import structlog
from flask import Blueprint, current_app, g, jsonify, request

from app.middleware.auth_middleware import require_permission
from app.services.rbac import Permission
from app.services.storage import StorageService
from app.services.firestore import FirestoreService
from app.services.registry import ModelRegistry
from app.utils.response import api_response, api_error

logger = structlog.get_logger()
upload_bp = Blueprint("upload", __name__)


@upload_bp.route("/upload/signed-url", methods=["POST"])
@require_permission(Permission.JOBS_CREATE)
def generate_signed_url():
    """Generate a GCS V4 signed URL for direct DICOM upload.

    Request Body:
        {
            "disease_id": "lung_cancer",
            "model_name": "sybil",
            "modality": "CT",
            "filename": "series_001.dcm",
            "content_type": "application/dicom",
            "num_files": 1  // Optional: for multi-file DICOM series
        }

    Returns:
        {
            "job_id": "uuid",
            "upload_url": "https://storage.googleapis.com/...",
            "upload_prefix": "raw/{user_id}/{job_id}/",
            "expires_in_minutes": 15
        }
    """
    data = request.get_json()
    if not data:
        return api_error("Request body is required", 400)

    # Validate required fields
    required_fields = ["disease_id", "model_name", "modality"]
    missing = [f for f in required_fields if f not in data]
    if missing:
        return api_error(f"Missing required fields: {', '.join(missing)}", 400)

    disease_id = data["disease_id"]
    model_name = data["model_name"]
    modality = data["modality"]

    # Validate disease + model combination exists in registry
    registry = ModelRegistry(current_app.config["DISEASE_CONFIG_DIR"])
    if not registry.validate_disease_model(disease_id, model_name):
        return api_error(
            f"Invalid disease/model combination: {disease_id}/{model_name}. "
            f"Use GET /api/v1/diseases to see available options.",
            400,
        )

    # Generate job ID and GCS path bound to authenticated user
    user_id = g.current_user.id
    job_id = str(uuid.uuid4())
    upload_prefix = f"raw/{user_id}/{job_id}/"
    filename = data.get("filename", "series.dcm")

    # Generate signed URL
    storage = StorageService(current_app.config)
    expiry_minutes = current_app.config["GCS_SIGNED_URL_EXPIRY_MINUTES"]

    signed_url = storage.generate_signed_upload_url(
        blob_path=f"{upload_prefix}{filename}",
        content_type=data.get("content_type", "application/dicom"),
        expiry_minutes=expiry_minutes,
        max_size_bytes=current_app.config["GCS_MAX_UPLOAD_SIZE_BYTES"],
    )

    # Create job record in Firestore
    firestore = FirestoreService(current_app.config)
    job_data = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "awaiting_upload",
        "disease_id": disease_id,
        "model_name": model_name,
        "modality": modality,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "input": {
            "gcs_prefix": f"gs://{current_app.config['GCS_DATA_BUCKET']}/{upload_prefix}",
            "filename": filename,
            "modality": modality,
        },
        "predictions": None,
        "xai": {},
        "segmentation": {},
        "error": None,
    }
    firestore.create_job(job_id, job_data)

    logger.info(
        "signed_url_generated",
        job_id=job_id,
        disease_id=disease_id,
        model_name=model_name,
        user_id=user_id,
    )

    return api_response({
        "job_id": job_id,
        "upload_url": signed_url,
        "upload_prefix": upload_prefix,
        "expires_in_minutes": expiry_minutes,
    }, 201)
