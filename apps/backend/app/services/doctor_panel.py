"""
Doctor panel service: the study lifecycle behind ``/api/v1/doctor/*``.

Kept free of Flask so the rules live in one place and are testable:

* Ownership: a doctor only ever reaches their own studies (``get_owned``).
* Analysis goes through ``study_analysis`` analysers; this module never calls a model.
* Report lifecycle: ``draft`` -> ``signed``. Signed reports are locked (no edits,
  no re-analysis, no deletion).
* A study can be attached to a patient the doctor has an active care link with; once
  signed, that patient sees the report in their own portal.
* Patient details come from what the doctor typed or real DICOM tags; nothing is invented.
"""

from __future__ import annotations

import contextlib
import io
import json
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database.models.care import CareLink
from app.database.models.doctor_panel import DoctorStudy
from app.database.models.iam import User
from app.services import notify
from app.services import patient_ehr as ehr
from app.services import study_analysis as sa

SEXES = {"female", "male", "other", "unknown"}
FILTERS = ("all", "draft", "signed", "urgent", "pending", "failed", "shared")
SORTS = {
    "newest": DoctorStudy.created_at.desc(),
    "oldest": DoctorStudy.created_at.asc(),
    "severity": None,  # handled below
    "patient": func.lower(func.coalesce(DoctorStudy.patient_name, "")).asc(),
}
MAX_PAGE_SIZE = 100


class ReportStatus:
    DRAFT = "draft"
    SIGNED = "signed"


class DoctorPanelError(ehr.EhrError):
    """Validation / state errors; carries the HTTP status and error code for the API."""


# --------------------------------------------------------------------------- helpers


def _iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime) and value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


def serialize(study: DoctorStudy, *, detail: bool = False) -> dict[str, Any]:
    analyzer = sa.get_analyzer(study.analyzer_id)
    out = {
        "id": study.id,
        "patient_ref": study.patient_ref,
        "patient_name": study.patient_name,
        "patient_age": study.patient_age,
        "patient_sex": study.patient_sex,
        "study_date": study.study_date.isoformat() if study.study_date else None,
        "modality": study.modality,
        "analyzer_id": study.analyzer_id,
        "analyzer_name": analyzer.display_name if analyzer else None,
        "original_filename": study.original_filename,
        "size_bytes": study.size_bytes,
        "status": study.status,
        "error": study.error,
        "primary_finding": study.primary_finding,
        "severity": study.severity,
        "model_name": study.model_name,
        "analyzed_at": _iso(study.analyzed_at),
        "has_preview": bool(study.preview_path),
        "has_heatmap": bool(study.heatmap_path),
        "report_status": study.report_status,
        "signed_at": _iso(study.signed_at),
        "signed_by": study.signed_by,
        "can_analyze": can_analyze(study),
        "patient_user_id": study.patient_user_id,
        "shared_with_patient_at": _iso(study.shared_with_patient_at),
        "created_at": _iso(study.created_at),
        "updated_at": _iso(study.updated_at),
    }
    if detail:
        out["clinical_notes"] = study.clinical_notes
        out["impression"] = study.impression
        out["findings"] = json.loads(study.findings_json) if study.findings_json else None
    return out


def dicom_demographics(blob: bytes) -> dict[str, Any]:
    """Patient fields that are actually present in the DICOM header (no defaults are invented)."""
    try:
        import pydicom

        ds = pydicom.dcmread(io.BytesIO(blob), stop_before_pixels=True, force=True)
    except Exception:
        return {}

    def tag(name: str) -> str | None:
        value = str(getattr(ds, name, "") or "").strip()
        return value or None

    out: dict[str, Any] = {}
    if tag("PatientID"):
        out["patient_ref"] = tag("PatientID")[:120]
    if tag("PatientName"):
        out["patient_name"] = tag("PatientName").replace("^", " ").strip()[:150]
    age = tag("PatientAge")  # e.g. "054Y"
    if age and age[:-1].isdigit() and age.endswith("Y"):
        out["patient_age"] = int(age[:-1])
    sex = (tag("PatientSex") or "").upper()
    if sex in ("M", "F", "O"):
        out["patient_sex"] = {"M": "male", "F": "female", "O": "other"}[sex]
    study_date = tag("StudyDate")
    if study_date and len(study_date) == 8 and study_date.isdigit():
        with contextlib.suppress(ValueError):
            out["study_date"] = date(int(study_date[:4]), int(study_date[4:6]), int(study_date[6:]))
    return out


def apply_patient_fields(study: DoctorStudy, data: dict) -> None:
    def text(key: str, size: int):
        if key in data:
            value = str(data.get(key) or "").strip()[:size]
            setattr(study, key, value or None)

    text("patient_ref", 120)
    text("patient_name", 150)
    if "patient_age" in data:
        raw = data.get("patient_age")
        if raw in (None, ""):
            study.patient_age = None
        else:
            try:
                age = int(raw)
            except (TypeError, ValueError):
                raise DoctorPanelError("Age must be a whole number.") from None
            if not 0 <= age <= 130:
                raise DoctorPanelError("Age must be between 0 and 130.")
            study.patient_age = age
    if "patient_sex" in data:
        sex = str(data.get("patient_sex") or "").strip().lower() or None
        if sex and sex not in SEXES:
            raise DoctorPanelError("Sex must be female, male, other or unknown.")
        study.patient_sex = sex
    if "study_date" in data:
        study.study_date = ehr.parse_date(data.get("study_date"), "study_date")
    if "clinical_notes" in data:
        study.clinical_notes = str(data.get("clinical_notes") or "").strip()[:4000] or None


def _require_draft(study: DoctorStudy, message: str) -> None:
    if study.report_status == ReportStatus.SIGNED:
        raise DoctorPanelError(message, 409, "REPORT_SIGNED")


def can_analyze(study: DoctorStudy) -> bool:
    """Whether running the analyser again is allowed and could succeed right now."""
    if study.report_status == ReportStatus.SIGNED or study.status == sa.Status.PROCESSING:
        return False
    analyzer = sa.get_analyzer(study.analyzer_id)
    return bool(analyzer and analyzer.is_available())


# --------------------------------------------------------------------------- queries


def get_owned(db: Session, owner_id: str, study_id: str) -> DoctorStudy:
    study = db.query(DoctorStudy).filter_by(id=study_id, user_id=owner_id).first()
    if study is None:
        raise DoctorPanelError("Study not found.", 404, "NOT_FOUND")
    return study


def summary(db: Session, owner_id: str) -> dict[str, Any]:
    base = db.query(DoctorStudy).filter(DoctorStudy.user_id == owner_id)
    by_severity = dict(
        db.query(DoctorStudy.severity, func.count(DoctorStudy.id))
        .filter(DoctorStudy.user_id == owner_id, DoctorStudy.status == sa.Status.COMPLETED)
        .group_by(DoctorStudy.severity)
        .all()
    )
    by_modality = dict(
        db.query(DoctorStudy.modality, func.count(DoctorStudy.id))
        .filter(DoctorStudy.user_id == owner_id)
        .group_by(DoctorStudy.modality)
        .all()
    )
    today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        "total": base.count(),
        "drafts": base.filter(DoctorStudy.report_status == ReportStatus.DRAFT).count(),
        "signed": base.filter(DoctorStudy.report_status == ReportStatus.SIGNED).count(),
        "signed_today": base.filter(
            DoctorStudy.report_status == ReportStatus.SIGNED, DoctorStudy.signed_at >= today_start
        ).count(),
        "urgent_unsigned": base.filter(
            DoctorStudy.report_status == ReportStatus.DRAFT,
            DoctorStudy.severity.in_(sa.URGENT_SEVERITIES),
        ).count(),
        "pending": base.filter(DoctorStudy.status == sa.Status.PENDING).count(),
        "failed": base.filter(DoctorStudy.status == sa.Status.FAILED).count(),
        "shared": base.filter(DoctorStudy.patient_user_id.isnot(None)).count(),
        "by_severity": {k: v for k, v in by_severity.items() if k},
        "by_modality": {k: v for k, v in by_modality.items() if k},
    }


def list_studies(
    db: Session,
    owner_id: str,
    *,
    flt: str = "all",
    q: str = "",
    modality: str | None = None,
    patient_user_id: str | None = None,
    sort: str = "newest",
    page: int | None = None,
    page_size: int = 50,
) -> tuple[list[DoctorStudy], int]:
    """Studies for the worklist. Without ``page`` the first 500 are returned (legacy clients)."""
    if flt not in FILTERS:
        raise DoctorPanelError(f"filter must be one of: {', '.join(FILTERS)}.", 400, "BAD_FILTER")
    query = db.query(DoctorStudy).filter(DoctorStudy.user_id == owner_id)
    if flt in (ReportStatus.DRAFT, ReportStatus.SIGNED):
        query = query.filter(DoctorStudy.report_status == flt)
    elif flt == "urgent":
        query = query.filter(DoctorStudy.severity.in_(sa.URGENT_SEVERITIES))
    elif flt in (sa.Status.PENDING, sa.Status.FAILED):
        query = query.filter(DoctorStudy.status == flt)
    elif flt == "shared":
        query = query.filter(DoctorStudy.patient_user_id.isnot(None))
    if modality:
        query = query.filter(DoctorStudy.modality == modality.upper()[:30])
    if patient_user_id:
        query = query.filter(DoctorStudy.patient_user_id == patient_user_id)
    q = (q or "").strip().lower()
    if q:
        like = f"%{q[:100]}%"
        query = query.filter(
            func.lower(func.coalesce(DoctorStudy.patient_name, "")).like(like)
            | func.lower(func.coalesce(DoctorStudy.patient_ref, "")).like(like)
            | func.lower(DoctorStudy.original_filename).like(like)
            | func.lower(func.coalesce(DoctorStudy.primary_finding, "")).like(like)
        )
    total = query.count()
    if sort == "severity":
        rank = case(
            *[(DoctorStudy.severity == sev, i) for i, sev in enumerate(reversed(sa.SEVERITIES))],
            else_=len(sa.SEVERITIES),
        )
        order = [rank.asc(), DoctorStudy.created_at.desc()]
    else:
        primary = SORTS.get(sort)
        order = [SORTS["newest"] if primary is None else primary, DoctorStudy.created_at.desc()]
    query = query.order_by(*order)
    if page is None:
        return query.limit(500).all(), total
    page_size = max(1, min(page_size, MAX_PAGE_SIZE))
    return query.offset((max(1, page) - 1) * page_size).limit(page_size).all(), total


# --------------------------------------------------------------------------- commands


def create_study(
    db: Session,
    owner_id: str,
    *,
    blob: bytes,
    filename: str,
    fields: dict,
    store: ehr.FileStore,
    analyzer_id: str | None = None,
    modality: str | None = None,
) -> DoctorStudy:
    """Validate the upload, store it, and analyse it automatically."""
    sniffed = ehr.sniff_type(blob)
    if sniffed is None or sniffed[0] == "application/pdf":
        raise DoctorPanelError(
            "Upload an imaging study (DICOM, PNG, JPG or WEBP).", 415, "UNSUPPORTED_MEDIA_TYPE"
        )
    analyzer = sa.resolve(blob, filename, analyzer_id=analyzer_id, modality=modality)

    study = DoctorStudy(
        user_id=owner_id,
        original_filename=filename,
        content_type=sniffed[0],
        size_bytes=len(blob),
        sha256=ehr.sha256(blob),
        storage_path=store.save(owner_id, analyzer.modality.lower(), blob, sniffed[1]),
        analyzer_id=analyzer.id,
        modality=analyzer.modality,
        status=sa.Status.PROCESSING,
        report_status=ReportStatus.DRAFT,
    )
    # Real DICOM tags first, then anything the doctor typed overrides them.
    if sniffed[0] == "application/dicom":
        for key, value in dicom_demographics(blob).items():
            setattr(study, key, value)
    apply_patient_fields(study, fields)
    db.add(study)
    db.flush()
    sa.run_analysis(study, analyzer, blob, store)
    db.flush()
    return study


def analyze(db: Session, study: DoctorStudy, store: ehr.FileStore) -> DoctorStudy:
    """Re-run the study's analyser (e.g. after a model was installed). Drafts only."""
    _require_draft(study, "This report is signed; its analysis can't change.")
    if study.status == sa.Status.PROCESSING:
        raise DoctorPanelError("This study is already being analysed.", 409, "IN_PROGRESS")
    path = store.path(study.storage_path)
    if path is None:
        raise DoctorPanelError("The original file for this study is missing.", 410, "FILE_MISSING")
    blob = path.read_bytes()
    analyzer = sa.get_analyzer(study.analyzer_id) or sa.resolve(blob, study.original_filename)
    sa.run_analysis(study, analyzer, blob, store)
    db.flush()
    return study


def analyze_waiting(db: Session, owner_id: str, store: ehr.FileStore, *, limit: int = 20) -> dict:
    """Automatically analyse this doctor's pending/failed drafts whose model is now installed."""
    rows = (
        db.query(DoctorStudy)
        .filter(
            DoctorStudy.user_id == owner_id,
            DoctorStudy.report_status == ReportStatus.DRAFT,
            DoctorStudy.status.in_(sa.Status.RERUNNABLE),
        )
        .order_by(DoctorStudy.created_at)
        .all()
    )
    ready = [s for s in rows if can_analyze(s)][: max(1, min(limit, 50))]
    outcome: dict[str, int] = {}
    for study in ready:
        try:
            analyze(db, study, store)
            outcome[study.status] = outcome.get(study.status, 0) + 1
        except (DoctorPanelError, sa.AnalysisError):
            outcome["skipped"] = outcome.get("skipped", 0) + 1
    return {
        "attempted": len(ready),
        "waiting": len(rows) - len(ready),
        "results": outcome,
        "studies": [serialize(s) for s in ready],
    }


def update_study(study: DoctorStudy, data: dict) -> DoctorStudy:
    _require_draft(study, "This report is signed and can no longer be edited.")
    apply_patient_fields(study, data)
    if "impression" in data:
        study.impression = str(data.get("impression") or "").strip()[:8000] or None
    return study


def link_patient(db: Session, study: DoctorStudy, doctor_id: str, link_id: str | None) -> DoctorStudy:
    """Attach the study to a care-linked patient (or detach with an empty id). Drafts only."""
    _require_draft(study, "This report is signed; its patient can no longer change.")
    if not link_id:
        study.patient_user_id = None
        return study
    link = db.query(CareLink).filter_by(id=link_id, doctor_id=doctor_id, status="active").first()
    if link is None:
        raise DoctorPanelError("Pick a patient you are connected with.", 404, "LINK_NOT_FOUND")
    study.patient_user_id = link.patient_id
    patient = db.get(User, link.patient_id)
    if patient is not None and not study.patient_name:
        study.patient_name = " ".join(p for p in (patient.first_name, patient.last_name) if p) or None
    return study


def sign_study(db: Session, study: DoctorStudy, signer: User) -> DoctorStudy:
    _require_draft(study, "This report is already signed.")
    if study.status != sa.Status.COMPLETED:
        raise DoctorPanelError("Only analysed studies can be signed.", 409, "NOT_ANALYSED")
    if not (study.impression or "").strip():
        raise DoctorPanelError("Write your impression before signing.", 422)
    name = " ".join(p for p in (signer.first_name, signer.last_name) if p) or signer.username
    study.report_status = ReportStatus.SIGNED
    study.signed_at = datetime.now(UTC)
    study.signed_by = name[:150]
    if study.patient_user_id:
        study.shared_with_patient_at = study.signed_at
        notify.notify(
            db,
            study.patient_user_id,
            "report.ready",
            f"Dr. {name} signed a report for you",
            f"{study.modality or 'Imaging'} study"
            + (f" from {study.study_date.isoformat()}" if study.study_date else "")
            + ". Open your records to read it.",
            link=f"/patient/records?report={study.id}",
            email_cta="Read the report",
        )
    return study


def delete_study(db: Session, study: DoctorStudy) -> tuple[str | None, ...]:
    """Delete a draft; returns the stored file paths for the caller to remove after commit."""
    _require_draft(study, "Signed reports are kept and can't be deleted.")
    rels = (study.storage_path, study.preview_path, study.heatmap_path)
    db.delete(study)
    return rels


def image_ref(study: DoctorStudy, kind: str) -> tuple[str | None, str, str, bool]:
    """(relative path, content type, download name, as_attachment) for an image kind."""
    if kind == "original":
        return study.storage_path, study.content_type, study.original_filename, True
    if kind in ("preview", "heatmap"):
        rel = study.preview_path if kind == "preview" else study.heatmap_path
        return rel, "image/png", f"study-{kind}.png", False
    raise DoctorPanelError("kind must be preview, heatmap or original.", 400, "BAD_KIND")


# --------------------------------------------------------------------------- patient-facing


def shared_reports(db: Session, patient_id: str) -> list[DoctorStudy]:
    """Signed reports doctors shared with this patient."""
    return (
        db.query(DoctorStudy)
        .filter(
            DoctorStudy.patient_user_id == patient_id,
            DoctorStudy.report_status == ReportStatus.SIGNED,
        )
        .order_by(DoctorStudy.signed_at.desc())
        .all()
    )


def shared_report(db: Session, patient_id: str, study_id: str) -> DoctorStudy:
    study = (
        db.query(DoctorStudy)
        .filter_by(id=study_id, patient_user_id=patient_id, report_status=ReportStatus.SIGNED)
        .first()
    )
    if study is None:
        raise DoctorPanelError("Report not found.", 404, "NOT_FOUND")
    return study


def serialize_for_patient(db: Session, study: DoctorStudy, *, detail: bool = False) -> dict:
    doctor = db.get(User, study.user_id)
    analyzer = sa.get_analyzer(study.analyzer_id)
    out = {
        "id": study.id,
        "modality": study.modality,
        "analyzer_name": analyzer.display_name if analyzer else None,
        "study_date": study.study_date.isoformat() if study.study_date else None,
        "primary_finding": study.primary_finding,
        "severity": study.severity,
        "signed_at": _iso(study.signed_at),
        "signed_by": study.signed_by,
        "doctor": {
            "id": doctor.id if doctor else None,
            "name": " ".join(p for p in (doctor.first_name, doctor.last_name) if p) if doctor else study.signed_by,
            "organization": doctor.organization if doctor else None,
        },
        "has_preview": bool(study.preview_path),
        "has_heatmap": bool(study.heatmap_path),
    }
    if detail:
        out["impression"] = study.impression
        out["clinical_notes"] = study.clinical_notes
        out["findings"] = json.loads(study.findings_json) if study.findings_json else None
        out["model_name"] = study.model_name
    return out
