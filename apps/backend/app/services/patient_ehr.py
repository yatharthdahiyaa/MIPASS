"""
Patient EHR service: validation, serialisation, file storage and X-ray screening
for the patient portal (routes in ``app/routes/patient_portal.py``).

All data is entered or uploaded by the signed-in patient. Every query is scoped
by ``user_id``; callers never pass another user's id.
"""

import hashlib
import json
import re
import secrets
from collections.abc import Iterable
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import structlog
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models.patient_ehr import (
    DailyLog,
    MedicationDose,
    PatientDocument,
    PatientMedication,
    PatientProfile,
    XrayStudy,
)

logger = structlog.get_logger()


class EhrError(Exception):
    def __init__(self, message: str, status: int = 422, code: str = "VALIDATION_ERROR"):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime) and value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


def _clean_text(value: Any, max_len: int) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text[:max_len] or None


def parse_date(value: Any, field: str, *, required: bool = False) -> date | None:
    if value in (None, ""):
        if required:
            raise EhrError(f"'{field}' is required.")
        return None
    try:
        parsed = date.fromisoformat(str(value)[:10])
    except ValueError:
        raise EhrError(f"'{field}' must be a date (YYYY-MM-DD).")
    if parsed.year < 1900 or parsed > date.today() + timedelta(days=366 * 5):
        raise EhrError(f"'{field}' is out of range.")
    return parsed


def parse_day_param(value: str | None) -> date:
    """Client's local 'today' (falls back to the server's UTC date)."""
    return parse_date(value, "date") or _utcnow().date()


def _number(data: dict, key: str, lo: float, hi: float, as_int: bool) -> float | None:
    raw = data.get(key)
    if raw in (None, ""):
        return None
    try:
        num = float(raw)
    except (TypeError, ValueError):
        raise EhrError(f"'{key}' must be a number.")
    if not lo <= num <= hi:
        raise EhrError(f"'{key}' must be between {lo:g} and {hi:g}.")
    return int(round(num)) if as_int else round(num, 2)


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

SEXES = {"female", "male", "intersex", "prefer_not"}
BLOOD_GROUPS = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}
LANGUAGES = {"en", "hi", "bn", "ta", "te"}
_PHONE_RE = re.compile(r"^[+0-9 ()-]{6,30}$")


def get_or_create_profile(db: Session, user_id: str) -> PatientProfile:
    profile = db.query(PatientProfile).filter_by(user_id=user_id).first()
    if profile is None:
        profile = PatientProfile(user_id=user_id)
        db.add(profile)
        db.flush()
    return profile


def serialize_profile(p: PatientProfile) -> dict:
    age = None
    if p.date_of_birth:
        today = date.today()
        age = (
            today.year
            - p.date_of_birth.year
            - ((today.month, today.day) < (p.date_of_birth.month, p.date_of_birth.day))
        )
    fields = (
        "date_of_birth",
        "sex",
        "blood_group",
        "height_cm",
        "emergency_contact_name",
        "emergency_contact_phone",
    )
    return {
        "date_of_birth": p.date_of_birth.isoformat() if p.date_of_birth else None,
        "age": age,
        "sex": p.sex,
        "blood_group": p.blood_group,
        "height_cm": p.height_cm,
        "phone": p.phone,
        "allergies": p.allergies,
        "conditions": p.conditions,
        "emergency_contact_name": p.emergency_contact_name,
        "emergency_contact_phone": p.emergency_contact_phone,
        "preferred_language": p.preferred_language,
        "completeness": round(
            sum(1 for f in fields if getattr(p, f) not in (None, "")) / len(fields), 2
        ),
        "updated_at": _iso(p.updated_at),
    }


def update_profile(p: PatientProfile, data: dict) -> None:
    if "date_of_birth" in data:
        dob = parse_date(data["date_of_birth"], "date_of_birth")
        if dob and dob > date.today():
            raise EhrError("Date of birth can't be in the future.")
        p.date_of_birth = dob
    if "sex" in data:
        sex = _clean_text(data["sex"], 20)
        if sex and sex not in SEXES:
            raise EhrError("Unknown value for 'sex'.")
        p.sex = sex
    if "blood_group" in data:
        bg = _clean_text(data["blood_group"], 5)
        if bg and bg.upper() not in BLOOD_GROUPS:
            raise EhrError("Unknown blood group.")
        p.blood_group = bg.upper() if bg else None
    if "height_cm" in data:
        p.height_cm = _number(data, "height_cm", 30, 260, as_int=False)
    if "preferred_language" in data:
        lang = _clean_text(data["preferred_language"], 10)
        if lang and lang not in LANGUAGES:
            raise EhrError("Unsupported language.")
        p.preferred_language = lang
    for key in ("phone", "emergency_contact_phone"):
        if key in data:
            phone = _clean_text(data[key], 30)
            if phone and not _PHONE_RE.match(phone):
                raise EhrError(f"'{key}' doesn't look like a phone number.")
            setattr(p, key, phone)
    if "emergency_contact_name" in data:
        p.emergency_contact_name = _clean_text(data["emergency_contact_name"], 120)
    for key in ("allergies", "conditions"):
        if key in data:
            setattr(p, key, _clean_text(data[key], 2000))


# ---------------------------------------------------------------------------
# Daily logs
# ---------------------------------------------------------------------------

# key: (min, max, integer?)
LOG_METRICS: dict[str, tuple[float, float, bool]] = {
    "systolic": (50, 260, True),
    "diastolic": (30, 160, True),
    "heart_rate": (25, 250, True),
    "glucose": (20, 700, False),
    "spo2": (50, 100, True),
    "temperature_c": (30, 45, False),
    "weight_kg": (1, 400, False),
    "sleep_hours": (0, 24, False),
    "steps": (0, 150000, True),
    "water_ml": (0, 15000, True),
    "mood": (1, 5, True),
}
GLUCOSE_CONTEXTS = {"fasting", "after_meal", "random"}
SYMPTOMS = {
    "headache",
    "fever",
    "cough",
    "breathlessness",
    "chest_pain",
    "fatigue",
    "dizziness",
    "nausea",
    "body_ache",
    "sore_throat",
    "palpitations",
    "swelling",
    "anxiety",
    "poor_appetite",
}


def create_log(db: Session, user_id: str, data: dict) -> DailyLog:
    values = {k: _number(data, k, lo, hi, as_int) for k, (lo, hi, as_int) in LOG_METRICS.items()}
    if (values["systolic"] is None) != (values["diastolic"] is None):
        raise EhrError("Enter both systolic and diastolic blood pressure.")
    if values["systolic"] is not None and values["systolic"] <= values["diastolic"]:
        raise EhrError("Systolic pressure must be higher than diastolic.")

    symptoms = data.get("symptoms") or []
    if not isinstance(symptoms, list) or any(s not in SYMPTOMS for s in symptoms):
        raise EhrError("Unknown symptom.")
    symptoms = sorted(set(symptoms))
    notes = _clean_text(data.get("notes"), 2000)

    if all(v is None for v in values.values()) and not symptoms and not notes:
        raise EhrError("Add at least one reading, symptom or note.")

    glucose_context = _clean_text(data.get("glucose_context"), 20)
    if values["glucose"] is None:
        glucose_context = None
    elif glucose_context not in GLUCOSE_CONTEXTS:
        raise EhrError("Choose when the glucose reading was taken.")

    recorded_at = _utcnow()
    if data.get("recorded_at"):
        try:
            recorded_at = datetime.fromisoformat(str(data["recorded_at"]).replace("Z", "+00:00"))
        except ValueError:
            raise EhrError("'recorded_at' must be an ISO timestamp.")
        if recorded_at.tzinfo is None:
            recorded_at = recorded_at.replace(tzinfo=UTC)
        if recorded_at > _utcnow() + timedelta(minutes=5):
            raise EhrError("A check-in can't be in the future.")
    log_date = parse_date(data.get("log_date"), "log_date") or recorded_at.date()

    log = DailyLog(
        user_id=user_id,
        log_date=log_date,
        recorded_at=recorded_at,
        glucose_context=glucose_context,
        symptoms_json=json.dumps(symptoms) if symptoms else None,
        notes=notes,
        **values,
    )
    db.add(log)
    db.flush()
    return log


def serialize_log(log: DailyLog) -> dict:
    out = {k: getattr(log, k) for k in LOG_METRICS}
    out.update(
        {
            "id": log.id,
            "log_date": log.log_date.isoformat(),
            "recorded_at": _iso(log.recorded_at),
            "glucose_context": log.glucose_context,
            "symptoms": json.loads(log.symptoms_json) if log.symptoms_json else [],
            "notes": log.notes,
        }
    )
    return out


def list_logs(db: Session, user_id: str, days: int, until: date) -> list[DailyLog]:
    since = until - timedelta(days=days - 1)
    return (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user_id, DailyLog.log_date >= since, DailyLog.log_date <= until)
        .order_by(DailyLog.recorded_at.desc())
        .all()
    )


def latest_readings(db: Session, user_id: str) -> dict[str, dict]:
    """Most recent non-empty value per metric (looks back over the last 200 check-ins)."""
    logs = (
        db.query(DailyLog)
        .filter_by(user_id=user_id)
        .order_by(DailyLog.recorded_at.desc())
        .limit(200)
        .all()
    )
    latest: dict[str, dict] = {}
    for log in logs:
        for key in LOG_METRICS:
            if key in latest or key == "diastolic":
                continue
            value = getattr(log, key)
            if value is None:
                continue
            entry = {
                "value": value,
                "recorded_at": _iso(log.recorded_at),
                "log_date": log.log_date.isoformat(),
            }
            if key == "systolic":
                entry["diastolic"] = log.diastolic
            if key == "glucose":
                entry["context"] = log.glucose_context
            latest[key] = entry
        if len(latest) == len(LOG_METRICS) - 1:
            break
    return latest


def logging_streak(db: Session, user_id: str, today: date) -> int:
    days = {
        d
        for (d,) in db.query(DailyLog.log_date)
        .filter(
            DailyLog.user_id == user_id,
            DailyLog.log_date <= today,
            DailyLog.log_date >= today - timedelta(days=365),
        )
        .distinct()
    }
    streak = 0
    cursor = today if today in days else today - timedelta(days=1)
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


# ---------------------------------------------------------------------------
# Medications
# ---------------------------------------------------------------------------

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _parse_times(raw: Any) -> list[str]:
    if not isinstance(raw, list) or not 1 <= len(raw) <= 8:
        raise EhrError("Add between 1 and 8 dose times.")
    times = sorted({str(t).strip() for t in raw})
    if any(not _TIME_RE.match(t) for t in times):
        raise EhrError("Dose times must look like 08:00.")
    return times


def apply_medication(med: PatientMedication, data: dict, *, creating: bool) -> None:
    if creating or "name" in data:
        name = _clean_text(data.get("name"), 150)
        if not name:
            raise EhrError("Enter the medicine name.")
        med.name = name
    if creating or "times" in data:
        med.times_json = json.dumps(_parse_times(data.get("times")))
    for key, size in (("dosage", 100), ("instructions", 255), ("prescribed_by", 150)):
        if creating or key in data:
            setattr(med, key, _clean_text(data.get(key), size))
    if creating or "start_date" in data:
        med.start_date = parse_date(data.get("start_date"), "start_date")
    if creating or "end_date" in data:
        med.end_date = parse_date(data.get("end_date"), "end_date")
    if med.start_date and med.end_date and med.end_date < med.start_date:
        raise EhrError("End date must be after the start date.")
    if "is_active" in data:
        med.is_active = bool(data["is_active"])


def med_times(med: PatientMedication) -> list[str]:
    return json.loads(med.times_json or "[]")


def serialize_medication(med: PatientMedication) -> dict:
    return {
        "id": med.id,
        "name": med.name,
        "dosage": med.dosage,
        "times": med_times(med),
        "instructions": med.instructions,
        "prescribed_by": med.prescribed_by,
        "start_date": med.start_date.isoformat() if med.start_date else None,
        "end_date": med.end_date.isoformat() if med.end_date else None,
        "is_active": med.is_active,
        "created_at": _iso(med.created_at),
    }


def _scheduled_on(med: PatientMedication, day: date) -> bool:
    if not med.is_active:
        return False
    first_day = med.start_date or (med.created_at.date() if med.created_at else day)
    return first_day <= day and (med.end_date is None or day <= med.end_date)


def medication_day(db: Session, user_id: str, day: date) -> list[dict]:
    meds = (
        db.query(PatientMedication)
        .filter_by(user_id=user_id, is_active=True)
        .order_by(PatientMedication.name)
        .all()
    )
    meds = [m for m in meds if _scheduled_on(m, day)]
    doses = {
        (d.medication_id, d.slot): d
        for d in db.query(MedicationDose).filter(
            MedicationDose.user_id == user_id, MedicationDose.dose_date == day
        )
    }
    out = []
    for med in meds:
        slots = []
        for slot in med_times(med):
            dose = doses.get((med.id, slot))
            slots.append(
                {
                    "slot": slot,
                    "status": dose.status if dose else None,
                    "recorded_at": _iso(dose.recorded_at) if dose else None,
                }
            )
        out.append({"medication": serialize_medication(med), "doses": slots})
    return out


def record_dose(
    db: Session, user_id: str, med: PatientMedication, data: dict
) -> MedicationDose | None:
    day = parse_date(data.get("date"), "date", required=True)
    slot = str(data.get("slot") or "")
    if slot not in med_times(med):
        raise EhrError("That dose time isn't part of this medicine's schedule.")
    if day > _utcnow().date() + timedelta(days=1):
        raise EhrError("You can't record a future dose.")
    status = data.get("status")
    existing = (
        db.query(MedicationDose).filter_by(medication_id=med.id, dose_date=day, slot=slot).first()
    )
    if status is None:  # undo
        if existing:
            db.delete(existing)
        return None
    if status not in ("taken", "skipped"):
        raise EhrError("Status must be 'taken' or 'skipped'.")
    if existing is None:
        existing = MedicationDose(
            user_id=user_id,
            medication_id=med.id,
            dose_date=day,
            slot=slot,
            status=status,
            recorded_at=_utcnow(),
        )
        db.add(existing)
    else:
        existing.status = status
        existing.recorded_at = _utcnow()
    db.flush()
    return existing


def adherence(db: Session, user_id: str, until: date, days: int = 7) -> dict | None:
    """Share of scheduled doses marked taken over the window (None when nothing was scheduled)."""
    since = until - timedelta(days=days - 1)
    meds = db.query(PatientMedication).filter_by(user_id=user_id).all()
    scheduled = 0
    for offset in range(days):
        day = since + timedelta(days=offset)
        scheduled += sum(len(med_times(m)) for m in meds if _scheduled_on(m, day))
    if scheduled == 0:
        return None
    taken = (
        db.query(func.count(MedicationDose.id))
        .filter(
            MedicationDose.user_id == user_id,
            MedicationDose.status == "taken",
            MedicationDose.dose_date >= since,
            MedicationDose.dose_date <= until,
        )
        .scalar()
        or 0
    )
    return {
        "taken": taken,
        "scheduled": scheduled,
        "rate": round(min(taken / scheduled, 1.0), 3),
        "days": days,
    }


# ---------------------------------------------------------------------------
# File storage
# ---------------------------------------------------------------------------

DOCUMENT_CATEGORIES = {
    "lab_report",
    "prescription",
    "imaging",
    "discharge",
    "vaccination",
    "insurance",
    "other",
}


def sniff_type(blob: bytes) -> tuple[str, str] | None:
    """(content_type, extension) from magic bytes; None for unsupported files."""
    if blob.startswith(b"%PDF-"):
        return "application/pdf", ".pdf"
    if blob.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", ".png"
    if blob.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", ".jpg"
    if blob[:4] == b"RIFF" and blob[8:12] == b"WEBP":
        return "image/webp", ".webp"
    if len(blob) > 132 and blob[128:132] == b"DICM":
        return "application/dicom", ".dcm"
    return None


class FileStore:
    """Stores patient files under <root>/<user_id>/<kind>/<random>.<ext>; rows keep the relative path."""

    def __init__(self, root: str):
        self.root = Path(root).resolve()

    def save(self, user_id: str, kind: str, blob: bytes, ext: str) -> str:
        rel = Path(user_id) / kind / f"{secrets.token_hex(16)}{ext}"
        target = self.root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(blob)
        return rel.as_posix()

    def path(self, rel: str | None) -> Path | None:
        if not rel:
            return None
        target = (self.root / rel).resolve()
        if self.root not in target.parents or not target.is_file():
            return None
        return target

    def delete_user(self, user_id: str) -> None:
        """Remove every file stored for one user (account deletion)."""
        import shutil

        if not user_id or not all(c.isalnum() or c == "-" for c in user_id):
            return
        target = (self.root / user_id).resolve()
        if target.parent == self.root and target.is_dir():
            shutil.rmtree(target, ignore_errors=True)

    def delete(self, *rels: str | None) -> None:
        for rel in rels:
            target = self.path(rel)
            if target:
                try:
                    target.unlink()
                except OSError as exc:
                    logger.warning("patient_file_delete_failed", path=rel, error=str(exc))


def read_upload(file_storage, max_bytes: int) -> bytes:
    if file_storage is None or not file_storage.filename:
        raise EhrError("Choose a file to upload.", 400, "BAD_REQUEST")
    blob = file_storage.read(max_bytes + 1)
    if not blob:
        raise EhrError("The file is empty.", 400, "BAD_REQUEST")
    if len(blob) > max_bytes:
        raise EhrError(
            f"Files must be {max_bytes // (1024 * 1024)} MB or smaller.", 413, "PAYLOAD_TOO_LARGE"
        )
    return blob


def sha256(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def safe_filename(name: str) -> str:
    base = re.sub(r"[^\w.\- ]+", "_", Path(name or "upload").name).strip() or "upload"
    return base[:200]


def serialize_document(doc: PatientDocument) -> dict:
    return {
        "id": doc.id,
        "title": doc.title,
        "category": doc.category,
        "record_date": doc.record_date.isoformat() if doc.record_date else None,
        "provider": doc.provider,
        "notes": doc.notes,
        "original_filename": doc.original_filename,
        "content_type": doc.content_type,
        "size_bytes": doc.size_bytes,
        "created_at": _iso(doc.created_at),
    }


# ---------------------------------------------------------------------------
# Chest X-ray screening
# ---------------------------------------------------------------------------


def analyze_xray(study: XrayStudy, blob: bytes, store: FileStore) -> None:
    """Analyse a patient's chest X-ray through the shared study-analysis registry.

    Only the model's findings are stored. The patient UI knows processing,
    completed and failed, so "no model installed yet" is reported as failed.
    """
    from app.services import study_analysis as sa

    message = "We saved your X-ray but couldn't analyse it. Please try again later."
    analyzer = sa.get_analyzer("chest_xray")
    if analyzer is None:
        study.status, study.error = sa.Status.FAILED, message
        return
    if sa.run_analysis(study, analyzer, blob, store, failure_message=message) == sa.Status.PENDING:
        study.status, study.error = sa.Status.FAILED, message


def serialize_xray(study: XrayStudy, *, detail: bool = False) -> dict:
    out = {
        "id": study.id,
        "title": study.title,
        "taken_on": study.taken_on.isoformat() if study.taken_on else None,
        "original_filename": study.original_filename,
        "size_bytes": study.size_bytes,
        "status": study.status,
        "error": study.error,
        "primary_finding": study.primary_finding,
        "severity": study.severity,
        "model_name": study.model_name,
        "has_preview": bool(study.preview_path),
        "has_heatmap": bool(study.heatmap_path),
        "analyzed_at": _iso(study.analyzed_at),
        "created_at": _iso(study.created_at),
    }
    findings = json.loads(study.findings_json) if study.findings_json else None
    if findings:
        out["positive_findings"] = findings.get("positive_findings", [])
        if detail:
            out["findings"] = findings
    return out


def export_all(db: Session, user_id: str) -> dict:
    """Complete machine-readable copy of the patient's record (files listed, not embedded)."""

    def rows(model, order) -> Iterable:
        return db.query(model).filter_by(user_id=user_id).order_by(order).all()

    profile = db.query(PatientProfile).filter_by(user_id=user_id).first()
    return {
        "exported_at": _iso(_utcnow()),
        "profile": serialize_profile(profile) if profile else None,
        "daily_logs": [serialize_log(x) for x in rows(DailyLog, DailyLog.recorded_at)],
        "medications": [
            serialize_medication(x) for x in rows(PatientMedication, PatientMedication.created_at)
        ],
        "medication_doses": [
            {
                "medication_id": d.medication_id,
                "date": d.dose_date.isoformat(),
                "slot": d.slot,
                "status": d.status,
                "recorded_at": _iso(d.recorded_at),
            }
            for d in rows(MedicationDose, MedicationDose.dose_date)
        ],
        "documents": [
            serialize_document(x) for x in rows(PatientDocument, PatientDocument.created_at)
        ],
        "xray_studies": [
            serialize_xray(x, detail=True) for x in rows(XrayStudy, XrayStudy.created_at)
        ],
    }
