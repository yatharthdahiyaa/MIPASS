"""
Jobs routes — Create, monitor, and manage processing jobs.

A job represents a single end-to-end pipeline run:
upload → preprocess → inference → XAI → segmentation → results
"""

import uuid
from datetime import datetime

import structlog
from flask import Blueprint, current_app, g, jsonify, request

from app.middleware.auth_middleware import require_permission
from app.services.firestore import FirestoreService
from app.services.pubsub import PubSubService
from app.services.rbac import Permission, get_rbac_service
from app.services.registry import ModelRegistry
from app.utils.response import api_response, api_error

logger = structlog.get_logger()
jobs_bp = Blueprint("jobs", __name__)


@jobs_bp.route("/jobs", methods=["POST"])
@require_permission(Permission.JOBS_CREATE)
def create_job():
    """Create a new processing job after upload is complete.

    This endpoint is called by the frontend after the DICOM upload
    to GCS is complete. It triggers the async processing pipeline.

    Request Body:
        {
            "job_id": "uuid",           // From the signed-url response
            "disease_id": "lung_cancer",
            "model_name": "sybil",
            "modality": "CT"
        }

    Returns:
        {
            "job_id": "uuid",
            "status": "preprocessing",
            "message": "Processing pipeline started"
        }
    """
    data = request.get_json()
    if not data:
        return api_error("Request body is required", 400)

    job_id = data.get("job_id")
    if not job_id:
        return api_error("job_id is required", 400)

    # Verify job exists and is in correct state
    firestore = FirestoreService(current_app.config)
    job = firestore.get_job(job_id)
    if not job:
        return api_error(f"Job {job_id} not found", 404)
    if job.get("status") not in ("awaiting_upload", "uploaded"):
        return api_error(
            f"Job {job_id} is in state '{job.get('status')}' — cannot start processing",
            409,
        )

    disease_id = data.get("disease_id", job.get("disease_id"))
    model_name = data.get("model_name", job.get("model_name"))

    # Validate disease/model combo
    registry = ModelRegistry(current_app.config["DISEASE_CONFIG_DIR"])
    disease_config = registry.get_disease_config(disease_id)
    if not disease_config:
        return api_error(f"Unknown disease: {disease_id}", 400)

    # Update job status
    firestore.update_job(job_id, {
        "status": "preprocessing",
        "updated_at": datetime.utcnow(),
        "disease_id": disease_id,
        "model_name": model_name,
    })

    # Publish to Pub/Sub to trigger preprocessing pipeline
    pubsub = PubSubService(current_app.config)
    pubsub.publish(
        topic=current_app.config["PUBSUB_TOPIC_DICOM_UPLOADED"],
        message={
            "job_id": job_id,
            "disease_id": disease_id,
            "model_name": model_name,
            "gcs_prefix": job["input"]["gcs_prefix"],
            "modality": job["input"]["modality"],
        },
    )

    logger.info(
        "job_started",
        job_id=job_id,
        disease_id=disease_id,
        model_name=model_name,
    )

    return api_response({
        "job_id": job_id,
        "status": "preprocessing",
        "message": "Processing pipeline started",
    }, 202)


@jobs_bp.route("/jobs/<job_id>", methods=["GET"])
@require_permission(Permission.JOBS_READ)
def get_job(job_id: str):
    """Get job status and results.

    Returns the full job document including prediction results,
    XAI status, and segmentation status.
    """
    firestore = FirestoreService(current_app.config)
    job = firestore.get_job(job_id)
    if not job:
        return api_error(f"Job {job_id} not found", 404)

    # Check job ownership / access rights
    rbac_service = get_rbac_service()
    if not rbac_service.can_access_job(g.current_user, job.get("user_id", ""), action="read"):
        rbac_service.log_audit_event(
            user=g.current_user,
            action="job:read_unauthorized",
            resource=f"job:{job_id}",
            decision="deny",
            details={"job_owner": job.get("user_id")},
            ip_address=request.remote_addr,
        )
        return api_error("Forbidden: You do not have permission to access this clinical study", 403)

    input_data = dict(job.get("input") or {})
    # HIPAA PHI de-identification: mask patient identifiers if lacking PHI_READ
    if not rbac_service.has_permission(g.current_user, Permission.PHI_READ):
        input_data["gcs_prefix"] = "gs://[PROTECTED-PHI-REDACTED]"
        input_data["patient_mrn"] = "ANONYMIZED"

    # Convert datetime objects for JSON serialization
    response_data = {
        "job_id": job["job_id"],
        "status": job["status"],
        "disease_id": job.get("disease_id"),
        "model_name": job.get("model_name"),
        "created_at": job["created_at"].isoformat() if job.get("created_at") else None,
        "updated_at": job["updated_at"].isoformat() if job.get("updated_at") else None,
        "input": input_data,
        "predictions": job.get("predictions"),
        "xai": job.get("xai"),
        "segmentation": job.get("segmentation"),
        "error": job.get("error"),
    }

    return api_response(response_data)


@jobs_bp.route("/jobs/<job_id>", methods=["DELETE"])
@require_permission(Permission.JOBS_DELETE)
def cancel_job(job_id: str):
    """Cancel a running job or delete a completed job.

    Cancels processing and schedules cleanup of GCS artifacts.
    """
    firestore = FirestoreService(current_app.config)
    job = firestore.get_job(job_id)
    if not job:
        return api_error(f"Job {job_id} not found", 404)

    # Verify authorization to cancel/delete
    rbac_service = get_rbac_service()
    if not rbac_service.can_access_job(g.current_user, job.get("user_id", ""), action="delete"):
        return api_error("Forbidden: Only job owner or administrators can cancel jobs", 403)

    # Update status
    firestore.update_job(job_id, {
        "status": "cancelled",
        "updated_at": datetime.utcnow(),
    })

    logger.info("job_cancelled", job_id=job_id, user_id=g.current_user.id)

    return api_response({
        "job_id": job_id,
        "status": "cancelled",
        "message": "Job cancelled. Artifacts will be cleaned up.",
    })


@jobs_bp.route("/jobs", methods=["GET"])
@require_permission(Permission.JOBS_READ)
def list_jobs():
    """List jobs with role-scoped isolation.

    Admins and Auditors can query jobs system-wide or filter by user.
    Technicians, Radiologists, and Researchers can only list their own jobs.
    """
    rbac_service = get_rbac_service()

    # Scope query by permission
    if rbac_service.has_permission(g.current_user, Permission.JOBS_READ_ALL):
        user_id = request.args.get("user_id")  # If None, returns all jobs
    else:
        user_id = g.current_user.id

    status_filter = request.args.get("status")
    disease_filter = request.args.get("disease_id")
    limit = min(int(request.args.get("limit", 20)), 100)
    offset = int(request.args.get("offset", 0))

    firestore = FirestoreService(current_app.config)
    jobs = firestore.list_jobs(
        user_id=user_id,
        status=status_filter,
        disease_id=disease_filter,
        limit=limit,
        offset=offset,
    )

    return api_response({
        "jobs": jobs,
        "count": len(jobs),
        "limit": limit,
        "offset": offset,
        "scoped_user": user_id or "all_users",
    })
