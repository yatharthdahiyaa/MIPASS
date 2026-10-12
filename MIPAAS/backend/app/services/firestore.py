"""
Firestore Service — Job metadata CRUD and user management.

All job state transitions are tracked in Firestore, which serves
as the source of truth for pipeline status.
"""

from datetime import datetime
from typing import Any

import structlog
from google.cloud import firestore

logger = structlog.get_logger()


class FirestoreService:
    """Firestore CRUD operations for jobs and users."""

    def __init__(self, config: dict):
        """Initialize Firestore client.

        Args:
            config: Application configuration with collection names.
        """
        self._client = firestore.Client(project=config.get("GCP_PROJECT_ID"))
        self._jobs_collection = config.get("FIRESTORE_COLLECTION_JOBS", "jobs")
        self._users_collection = config.get("FIRESTORE_COLLECTION_USERS", "users")

    # ──────────────────────────────────────────────
    # Job Operations
    # ──────────────────────────────────────────────

    def create_job(self, job_id: str, data: dict) -> None:
        """Create a new job document.

        Args:
            job_id: Unique job identifier.
            data: Full job document data.
        """
        doc_ref = self._client.collection(self._jobs_collection).document(job_id)
        doc_ref.set(data)
        logger.info("job_created", job_id=job_id, status=data.get("status"))

    def get_job(self, job_id: str) -> dict | None:
        """Get a job document by ID.

        Args:
            job_id: Job identifier.

        Returns:
            Job document as dict, or None if not found.
        """
        doc_ref = self._client.collection(self._jobs_collection).document(job_id)
        doc = doc_ref.get()
        if not doc.exists:
            return None
        return doc.to_dict()

    def update_job(self, job_id: str, updates: dict) -> None:
        """Update specific fields on a job document.

        Args:
            job_id: Job identifier.
            updates: Dict of field paths → new values.
        """
        updates["updated_at"] = datetime.utcnow()
        doc_ref = self._client.collection(self._jobs_collection).document(job_id)
        doc_ref.update(updates)
        logger.info(
            "job_updated",
            job_id=job_id,
            fields=list(updates.keys()),
        )

    def update_job_status(self, job_id: str, status: str, **extra_fields: Any) -> None:
        """Update job status with optional extra fields.

        Args:
            job_id: Job identifier.
            status: New status string.
            **extra_fields: Additional fields to update.
        """
        updates = {"status": status, **extra_fields}
        self.update_job(job_id, updates)

    def update_job_error(self, job_id: str, stage: str, message: str, traceback: str = "") -> None:
        """Record an error on a job.

        Args:
            job_id: Job identifier.
            stage: Pipeline stage where error occurred.
            message: Error message.
            traceback: Optional traceback string.
        """
        self.update_job(job_id, {
            "status": "failed",
            "error": {
                "stage": stage,
                "message": message,
                "traceback": traceback,
                "occurred_at": datetime.utcnow(),
            },
        })
        logger.error("job_failed", job_id=job_id, stage=stage, message=message)

    def update_xai_status(self, job_id: str, method: str, status: str, **data: Any) -> None:
        """Update XAI method status within a job.

        Args:
            job_id: Job identifier.
            method: XAI method name ('gradcam', 'occlusion', 'integrated_gradients').
            status: Status string ('running', 'complete', 'failed').
            **data: Additional data (e.g., gcs_uri, overlay_uris).
        """
        self.update_job(job_id, {
            f"xai.{method}.status": status,
            **{f"xai.{method}.{k}": v for k, v in data.items()},
        })

    def update_segmentation_status(self, job_id: str, status: str, **data: Any) -> None:
        """Update segmentation status within a job.

        Args:
            job_id: Job identifier.
            status: Status string.
            **data: Additional data (e.g., lesion_count, gcs_uri).
        """
        self.update_job(job_id, {
            "segmentation.status": status,
            **{f"segmentation.{k}": v for k, v in data.items()},
        })

    def list_jobs(
        self,
        user_id: str,
        status: str | None = None,
        disease_id: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        """List jobs for a user with optional filters.

        Args:
            user_id: User identifier.
            status: Optional status filter.
            disease_id: Optional disease filter.
            limit: Maximum results to return.
            offset: Pagination offset.

        Returns:
            List of job documents.
        """
        query = (
            self._client.collection(self._jobs_collection)
            .where("user_id", "==", user_id)
            .order_by("created_at", direction=firestore.Query.DESCENDING)
        )

        if status:
            query = query.where("status", "==", status)
        if disease_id:
            query = query.where("disease_id", "==", disease_id)

        query = query.offset(offset).limit(limit)
        docs = query.stream()

        jobs = []
        for doc in docs:
            job = doc.to_dict()
            # Convert timestamps for JSON
            for ts_field in ("created_at", "updated_at"):
                if job.get(ts_field):
                    job[ts_field] = job[ts_field].isoformat()
            jobs.append(job)

        return jobs

    def delete_job(self, job_id: str) -> None:
        """Delete a job document.

        Args:
            job_id: Job identifier.
        """
        doc_ref = self._client.collection(self._jobs_collection).document(job_id)
        doc_ref.delete()
        logger.info("job_deleted", job_id=job_id)
