"""
Diagnostic job store on the central PostgreSQL database (``diagnostic_jobs``).

The upload route creates jobs and the pipeline workers advance them. Callers see the same
nested document shape the API has always returned::

    {job_id, user_id, status, disease_id, model_name, modality, progress_pct,
     input, predictions, xai, segmentation, error, created_at, updated_at}

Updates accept dotted paths (``"xai.gradcam.status"``) like the document store did.
"""

import json
from datetime import UTC, datetime
from typing import Any

import structlog

from app.database.models.imaging_ai import DiagnosticJob
from app.database.session import get_db

logger = structlog.get_logger()

# Fields stored directly in columns.
_COLUMN_FIELDS = {"user_id", "status", "disease_id", "model_name", "modality", "progress_pct"}
# Nested documents stored as JSON text.
_JSON_COLUMNS = {
    "input": "input_json",
    "predictions": "predictions_json",
    "xai": "xai_json",
    "segmentation": "segmentation_json",
    "error": "error_json",
}


def _now() -> datetime:
    return datetime.now(UTC)


def _load(text: str | None) -> Any:
    return json.loads(text) if text is not None else None


def _dump(value: Any) -> str | None:
    return None if value is None else json.dumps(value, default=str)


def _set_path(doc: dict, parts: list[str], value: Any) -> None:
    node = doc
    for part in parts[:-1]:
        if not isinstance(node.get(part), dict):
            node[part] = {}
        node = node[part]
    node[parts[-1]] = value


def _to_document(job: DiagnosticJob) -> dict[str, Any]:
    return {
        "job_id": job.id,
        "user_id": job.user_id,
        "status": job.status,
        "disease_id": job.disease_id,
        "model_name": job.model_name,
        "modality": job.modality,
        "progress_pct": job.progress_pct or 0,
        "input": _load(job.input_json) or {},
        "predictions": _load(job.predictions_json),
        "xai": _load(job.xai_json) or {},
        "segmentation": _load(job.segmentation_json) or {},
        "error": _load(job.error_json),
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


class JobStore:
    """Create, read, update and list diagnostic jobs in the central database."""

    def __init__(self, config: dict | None = None):
        self._config = config or {}

    def create_job(self, job_id: str, data: dict) -> None:
        """Insert a new job. ``data`` uses the document shape described in the module docstring."""
        input_doc = data.get("input") or {}
        with get_db() as db:
            db.add(
                DiagnosticJob(
                    id=job_id,
                    user_id=data.get("user_id"),
                    status=data.get("status", "awaiting_upload"),
                    disease_id=data["disease_id"],
                    model_name=data["model_name"],
                    modality=data["modality"],
                    progress_pct=0,
                    input_gcs_uri=input_doc.get("gcs_prefix"),
                    input_json=_dump(input_doc),
                    predictions_json=_dump(data.get("predictions")),
                    xai_json=_dump(data.get("xai") or {}),
                    segmentation_json=_dump(data.get("segmentation") or {}),
                    error_json=_dump(data.get("error")),
                )
            )
        logger.info("job_created", job_id=job_id, status=data.get("status"))

    def get_job(self, job_id: str) -> dict | None:
        """The job document, or None when no job has this id."""
        with get_db() as db:
            job = db.get(DiagnosticJob, job_id)
            return None if job is None else _to_document(job)

    def update_job(self, job_id: str, updates: dict) -> None:
        """Apply updates. Keys may be top-level fields or dotted paths into a nested document."""
        with get_db() as db:
            job = db.get(DiagnosticJob, job_id)
            if job is None:
                raise KeyError(f"Job {job_id} does not exist.")

            documents = {name: _load(getattr(job, col)) for name, col in _JSON_COLUMNS.items()}
            for key, value in updates.items():
                if key == "updated_at":
                    continue
                head, _, rest = key.partition(".")
                if head in _COLUMN_FIELDS and not rest:
                    setattr(job, head, value)
                elif head in _JSON_COLUMNS:
                    if rest:
                        if documents[head] is None:
                            documents[head] = {}
                        _set_path(documents[head], rest.split("."), value)
                    else:
                        documents[head] = value
                else:
                    raise ValueError(f"Unknown job field: {key!r}")

            for name, col in _JSON_COLUMNS.items():
                setattr(job, col, _dump(documents[name]))
            if isinstance(documents.get("input"), dict):
                job.input_gcs_uri = documents["input"].get("gcs_prefix")
            error = documents.get("error")
            job.error_stage = error.get("stage") if isinstance(error, dict) else None
            job.error_message = error.get("message") if isinstance(error, dict) else None
            job.updated_at = _now()

        logger.info("job_updated", job_id=job_id, fields=list(updates.keys()))

    def update_job_status(self, job_id: str, status: str, **extra_fields: Any) -> None:
        self.update_job(job_id, {"status": status, **extra_fields})

    def update_job_error(self, job_id: str, stage: str, message: str, traceback: str = "") -> None:
        self.update_job(
            job_id,
            {
                "status": "failed",
                "error": {
                    "stage": stage,
                    "message": message,
                    "traceback": traceback,
                    "occurred_at": _now().isoformat(),
                },
            },
        )
        logger.error("job_failed", job_id=job_id, stage=stage, message=message)

    def update_xai_status(self, job_id: str, method: str, status: str, **data: Any) -> None:
        """Set an XAI method's status and extra fields (e.g. ``gcs_uri``)."""
        self.update_job(
            job_id,
            {
                f"xai.{method}.status": status,
                **{f"xai.{method}.{k}": v for k, v in data.items()},
            },
        )

    def update_segmentation_status(self, job_id: str, status: str, **data: Any) -> None:
        self.update_job(
            job_id,
            {
                "segmentation.status": status,
                **{f"segmentation.{k}": v for k, v in data.items()},
            },
        )

    def list_jobs(
        self,
        user_id: str | None,
        status: str | None = None,
        disease_id: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        """Jobs newest first. ``user_id=None`` lists across all users (callers check permission)."""
        with get_db() as db:
            query = db.query(DiagnosticJob)
            if user_id is not None:
                query = query.filter(DiagnosticJob.user_id == user_id)
            if status:
                query = query.filter(DiagnosticJob.status == status)
            if disease_id:
                query = query.filter(DiagnosticJob.disease_id == disease_id)
            rows = query.order_by(DiagnosticJob.created_at.desc()).offset(offset).limit(limit).all()
            docs = []
            for job in rows:
                doc = _to_document(job)
                for ts_field in ("created_at", "updated_at"):
                    if doc.get(ts_field):
                        doc[ts_field] = doc[ts_field].isoformat()
                docs.append(doc)
            return docs

    def delete_job(self, job_id: str) -> None:
        with get_db() as db:
            job = db.get(DiagnosticJob, job_id)
            if job is not None:
                db.delete(job)
        logger.info("job_deleted", job_id=job_id)
