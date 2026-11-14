"""
Eka.care Personal Health Record (PHR) service, on the central database.

Every record belongs to the signed-in user through their family members. Each
operation takes ``owner_id`` and raises :class:`NotFound` for anything the owner
doesn't hold, so one user can never read or change another user's health data.

Data lives in the ``family_members``, ``medications``, ``vital_records``,
``health_records`` and ``consumer_appointments`` tables (see
``app/database/models/consumer_health.py``). Nothing is seeded.
"""

import json
import uuid
from datetime import UTC, date, datetime, time
from typing import Any

import structlog

from app.database.models import consumer_health as ch
from app.database.session import get_db

logger = structlog.get_logger()

VITAL_TYPES = [
    "Blood Pressure",
    "Blood Sugar (Fasting)",
    "Blood Sugar (PP)",
    "Heart Rate",
    "SpO2",
    "Weight & BMI",
    "Body Temp",
]

RECORD_CATEGORIES = [
    "Prescriptions",
    "Lab Reports",
    "Scans & Imaging",
    "Discharge Summary",
    "Vaccinations",
]

# Reference ranges shown next to a logged reading (general adult guidance).
TARGET_RANGES: dict[str, str] = {
    "Blood Pressure": "< 120/80 mmHg",
    "Blood Sugar (Fasting)": "70 - 100 mg/dL",
    "Blood Sugar (PP)": "< 140 mg/dL",
    "Heart Rate": "60 - 100 BPM",
    "SpO2": "95 - 100 %",
    "Weight & BMI": "18.5 - 24.9 BMI",
    "Body Temp": "97.0 - 99.0 °F",
}


class NotFound(Exception):
    """The item doesn't exist or isn't owned by the caller (both answer 404)."""


class InvalidInput(ValueError):
    """A payload field is missing or malformed (answers 400)."""


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _today_label() -> str:
    return datetime.now().strftime("Today, %I:%M %p")


def _int(payload: dict, key: str, default: int) -> int:
    raw = payload.get(key, default)
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise InvalidInput(f"'{key}' must be a whole number.") from None


# ─────────────────────────────────────────────────────────────
# Serialisation (response shapes used by the API)
# ─────────────────────────────────────────────────────────────


def member_dict(m: ch.FamilyMember) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "relation": m.relation,
        "age": m.age,
        "gender": m.gender,
        "abhaId": m.abha_id,
        "bloodGroup": m.blood_group,
        "avatarColor": m.avatar_color,
        "primaryCondition": m.primary_condition,
    }


def medication_dict(m: ch.Medication) -> dict:
    return {
        "id": m.id,
        "memberId": m.member_id,
        "name": m.name,
        "dosage": m.dosage,
        "frequency": m.frequency,
        "timing": m.timing,
        "instruction": m.instruction,
        "prescribedBy": m.prescribed_by,
        "refillDaysLeft": m.refill_days_left,
        "takenToday": bool(m.taken_today) and m.last_taken_date == date.today().isoformat(),
        "timeSlot": m.time_slot,
    }


def vital_dict(v: ch.VitalRecord) -> dict:
    return {
        "id": v.id,
        "memberId": v.member_id,
        "type": v.vital_type,
        "value": v.value,
        "unit": v.unit,
        "status": v.status,
        "recordedAt": v.recorded_at,
        "trend": v.trend,
        "targetRange": v.target_range,
    }


def record_dict(r: ch.HealthRecord) -> dict:
    return {
        "id": r.id,
        "memberId": r.member_id,
        "title": r.title,
        "category": r.category,
        "doctorOrLab": r.doctor_or_lab,
        "date": r.record_date,
        "fileType": r.file_type,
        "fileSize": r.file_size,
        "aiKeySummary": r.ai_key_summary,
        "extractedParameters": json.loads(r.extracted_parameters_json or "[]"),
        "tags": json.loads(r.tags_json or "[]"),
    }


def appointment_dict(a: ch.ConsumerAppointment) -> dict:
    return {
        "id": a.id,
        "memberId": a.member_id,
        "doctorName": a.doctor_name,
        "specialty": a.specialty,
        "hospital": a.hospital,
        "date": a.appointment_date,
        "time": a.appointment_time,
        "tokenNumber": a.token_number,
        "type": a.appointment_type,
        "status": a.status,
        "queueWaitMins": a.queue_wait_mins,
    }


# ─────────────────────────────────────────────────────────────
# Clinical status for a logged reading (heuristic thresholds)
# ─────────────────────────────────────────────────────────────


def classify_vital(vital_type: str, value: str) -> str:
    try:
        first = float(value.split()[0].split("/")[0])
    except (ValueError, IndexError):
        return "Normal"
    bounds = {
        "Blood Pressure": (90, 140),
        "Blood Sugar (Fasting)": (70, 126),
        "Blood Sugar (PP)": (70, 200),
        "Heart Rate": (55, 100),
        "SpO2": (94, 101),
        "Body Temp": (97.0, 99.5),
    }
    rule = bounds.get(vital_type)
    if not rule:
        return "Normal"
    low, high = rule
    if vital_type == "SpO2":
        return "Optimal" if first >= 95 else ("Elevated" if first >= 92 else "Attention")
    if first < low * 0.9 or first > high * 1.1:
        return "Attention"
    if first > high:
        return "Elevated"
    return "Normal" if vital_type != "Heart Rate" else "Optimal"


# ─────────────────────────────────────────────────────────────
# Service
# ─────────────────────────────────────────────────────────────


def _owned_member(db, owner_id: str, member_id: str) -> ch.FamilyMember:
    member = db.query(ch.FamilyMember).filter_by(id=member_id, user_id=owner_id).first()
    if member is None:
        raise NotFound(f"Family member '{member_id}' not found")
    return member


def _owned_row(db, owner_id: str, model, item_id: str, label: str):
    row = db.get(model, item_id)
    if row is None:
        raise NotFound(f"{label} '{item_id}' not found")
    _owned_member(db, owner_id, row.member_id)  # raises NotFound for other owners
    return row


class EkaCarePortalService:
    """Business logic for the eka.care portal, backed by the central database."""

    # Session -----------------------------------------------------------

    def get_session(self, user: Any) -> dict:
        with get_db() as db:
            owned = (
                db.query(ch.FamilyMember)
                .filter_by(user_id=user.id)
                .order_by(ch.FamilyMember.created_at)
                .all()
            )
            primary = next((m for m in owned if m.relation == "Self"), owned[0] if owned else None)
            return {
                "userId": user.id,
                "userName": user.name,
                "role": user.role.value,
                "linkedMembers": len(owned),
                "primaryMemberId": primary.id if primary else None,
                "entitlements": sorted(p.value for p in user.permissions),
                "consent": {
                    "abdmLinked": any(m.abha_id for m in owned),
                    "aiConsultEnabled": True,
                    "lockerEncryption": None,
                },
            }

    # Family ------------------------------------------------------------

    def list_members(self, owner_id: str) -> list[dict]:
        with get_db() as db:
            rows = (
                db.query(ch.FamilyMember)
                .filter_by(user_id=owner_id)
                .order_by(ch.FamilyMember.created_at)
                .all()
            )
            return [member_dict(m) for m in rows]

    def add_member(self, owner_id: str, payload: dict) -> dict:
        name = str(payload.get("name", "")).strip()
        if not name:
            raise InvalidInput("'name' is required.")
        with get_db() as db:
            member = ch.FamilyMember(
                id=_new_id("fam"),
                user_id=owner_id,
                name=name[:100],
                relation=str(payload.get("relation", "Dependent"))[:50],
                age=_int(payload, "age", 0),
                gender=str(payload.get("gender", "Other"))[:20],
                abha_id=(str(payload["abhaId"]).strip() or None) if payload.get("abhaId") else None,
                blood_group=str(payload.get("bloodGroup", "Unknown"))[:10],
                avatar_color=str(payload.get("avatarColor", "from-sky-500 to-blue-600"))[:100],
                primary_condition=(str(payload.get("primaryCondition"))[:255] or None)
                if payload.get("primaryCondition")
                else None,
            )
            db.add(member)
            db.flush()
            logger.info("eka_member_added", member_id=member.id)
            return member_dict(member)

    # Medications -------------------------------------------------------

    def list_medications(self, owner_id: str, member_id: str) -> list[dict]:
        with get_db() as db:
            _owned_member(db, owner_id, member_id)
            rows = (
                db.query(ch.Medication)
                .filter_by(member_id=member_id)
                .order_by(ch.Medication.created_at)
                .all()
            )
            return [medication_dict(m) for m in rows]

    def add_medication(self, owner_id: str, member_id: str, payload: dict) -> dict:
        name = str(payload.get("name", "")).strip()
        if not name:
            raise InvalidInput("'name' is required.")
        with get_db() as db:
            _owned_member(db, owner_id, member_id)
            med = ch.Medication(
                id=_new_id("med"),
                member_id=member_id,
                name=name[:150],
                dosage=str(payload.get("dosage", "1 Tablet"))[:100],
                frequency=str(payload.get("frequency", "Once daily"))[:100],
                timing=str(payload.get("timing", "Morning"))[:50],
                instruction=str(payload.get("instruction", "After Food"))[:50],
                prescribed_by=str(payload.get("prescribedBy", "Self"))[:150],
                refill_days_left=_int(payload, "refillDaysLeft", 30),
                time_slot=str(payload.get("timeSlot", "09:00 AM"))[:50],
                taken_today=False,
            )
            db.add(med)
            db.flush()
            logger.info("eka_medication_added", med_id=med.id, member_id=member_id)
            return medication_dict(med)

    def set_medication_taken(self, owner_id: str, med_id: str, taken: bool | None = None) -> dict:
        with get_db() as db:
            med = _owned_row(db, owner_id, ch.Medication, med_id, "Medication")
            currently = bool(med.taken_today) and med.last_taken_date == date.today().isoformat()
            new_state = (not currently) if taken is None else bool(taken)
            med.taken_today = new_state
            med.last_taken_date = date.today().isoformat() if new_state else None
            db.flush()
            return medication_dict(med)

    def delete_medication(self, owner_id: str, med_id: str) -> None:
        with get_db() as db:
            med = _owned_row(db, owner_id, ch.Medication, med_id, "Medication")
            db.delete(med)

    # Vitals ------------------------------------------------------------

    def list_vitals(self, owner_id: str, member_id: str) -> list[dict]:
        with get_db() as db:
            _owned_member(db, owner_id, member_id)
            rows = (
                db.query(ch.VitalRecord)
                .filter_by(member_id=member_id)
                .order_by(ch.VitalRecord.created_at.desc())
                .all()
            )
            return [vital_dict(v) for v in rows]

    def add_vital(self, owner_id: str, member_id: str, payload: dict) -> dict:
        vital_type = str(payload.get("type", "Blood Pressure"))[:50]
        value = str(payload.get("value", "")).strip()
        if not value:
            raise InvalidInput("'value' is required.")
        with get_db() as db:
            _owned_member(db, owner_id, member_id)
            vital = ch.VitalRecord(
                id=_new_id("vit"),
                member_id=member_id,
                vital_type=vital_type,
                value=value[:50],
                unit=str(payload.get("unit", ""))[:20],
                status=classify_vital(vital_type, value),
                recorded_at=_today_label()[:100],
                trend=str(payload.get("trend", "stable"))[:20],
                target_range=str(
                    payload.get(
                        "targetRange", TARGET_RANGES.get(vital_type, "Per clinical standards")
                    )
                )[:100],
            )
            db.add(vital)
            db.flush()
            logger.info(
                "eka_vital_logged", vit_id=vital.id, member_id=member_id, status=vital.status
            )
            return vital_dict(vital)

    def delete_vital(self, owner_id: str, vital_id: str) -> None:
        with get_db() as db:
            db.delete(_owned_row(db, owner_id, ch.VitalRecord, vital_id, "Vital record"))

    # Health locker -----------------------------------------------------

    def list_records(
        self, owner_id: str, member_id: str, category: str | None = None, query: str | None = None
    ) -> list[dict]:
        with get_db() as db:
            _owned_member(db, owner_id, member_id)
            rows = (
                db.query(ch.HealthRecord)
                .filter_by(member_id=member_id)
                .order_by(ch.HealthRecord.created_at.desc())
                .all()
            )
            out = []
            for r in rows:
                if category and category != "All" and r.category != category:
                    continue
                if query:
                    haystack = f"{r.title} {r.doctor_or_lab} {r.ai_key_summary or ''}".lower()
                    if query.lower() not in haystack:
                        continue
                out.append(record_dict(r))
            return out

    def add_record(self, owner_id: str, member_id: str, payload: dict) -> dict:
        title = str(payload.get("title", "")).strip()
        if not title:
            raise InvalidInput("'title' is required.")
        with get_db() as db:
            _owned_member(db, owner_id, member_id)
            record = ch.HealthRecord(
                id=_new_id("rec"),
                member_id=member_id,
                title=title[:200],
                category=str(payload.get("category", "Lab Reports"))[:50],
                doctor_or_lab=str(payload.get("doctorOrLab", "Self-Uploaded Document"))[:150],
                record_date=str(payload.get("date", datetime.now().strftime("%d %b %Y")))[:50],
                file_type=str(payload.get("fileType", "PDF"))[:50],
                file_size=str(payload.get("fileSize", ""))[:50],
                # No summary is generated for metadata-only records; the field stays empty.
                ai_key_summary=payload.get("aiKeySummary") or None,
                tags_json=json.dumps(payload.get("tags", [])),
                extracted_parameters_json=json.dumps(payload.get("extractedParameters", [])),
            )
            db.add(record)
            db.flush()
            logger.info("eka_record_added", rec_id=record.id, member_id=member_id)
            return record_dict(record)

    def delete_record(self, owner_id: str, record_id: str) -> None:
        with get_db() as db:
            db.delete(_owned_row(db, owner_id, ch.HealthRecord, record_id, "Health record"))

    # Appointments ------------------------------------------------------

    def list_appointments(self, owner_id: str, member_id: str) -> list[dict]:
        with get_db() as db:
            _owned_member(db, owner_id, member_id)
            rows = (
                db.query(ch.ConsumerAppointment)
                .filter_by(member_id=member_id)
                .order_by(ch.ConsumerAppointment.created_at)
                .all()
            )
            return [appointment_dict(a) for a in rows]

    def book_appointment(self, owner_id: str, member_id: str, payload: dict) -> dict:
        doctor = str(payload.get("doctorName", "")).strip()
        appointment_date = str(payload.get("date", "")).strip()
        if not doctor or not appointment_date:
            raise InvalidInput("'doctorName' and 'date' are required.")
        apt_type = str(payload.get("type", "In-Clinic"))[:50]
        with get_db() as db:
            _owned_member(db, owner_id, member_id)
            same_day = (
                db.query(ch.ConsumerAppointment)
                .filter_by(member_id=member_id, appointment_date=appointment_date)
                .count()
            )
            apt = ch.ConsumerAppointment(
                id=_new_id("apt"),
                member_id=member_id,
                doctor_name=doctor[:150],
                specialty=str(payload.get("specialty", "General Physician"))[:150],
                hospital=str(
                    payload.get(
                        "hospital",
                        "Teleconsult"
                        if apt_type == "Video Teleconsult"
                        else "Hospital not specified",
                    )
                )[:200],
                appointment_date=appointment_date[:50],
                appointment_time=str(payload.get("time", ""))[:50],
                token_number=same_day + 1,
                appointment_type=apt_type,
                status="Confirmed",
                queue_wait_mins=0,
            )
            db.add(apt)
            db.flush()
            logger.info("eka_appointment_booked", apt_id=apt.id, member_id=member_id)
            return appointment_dict(apt)

    def cancel_appointment(self, owner_id: str, apt_id: str) -> None:
        with get_db() as db:
            apt = _owned_row(db, owner_id, ch.ConsumerAppointment, apt_id, "Appointment")
            apt.status = "Cancelled"
            logger.info("eka_appointment_cancelled", apt_id=apt_id)

    # ABHA card ---------------------------------------------------------

    def get_abha_profile(self, owner_id: str, member_id: str) -> dict:
        with get_db() as db:
            member = _owned_member(db, owner_id, member_id)
            vaccinations = (
                db.query(ch.HealthRecord)
                .filter_by(member_id=member_id, category="Vaccinations")
                .order_by(ch.HealthRecord.created_at)
                .all()
            )
            return {
                "member": member_dict(member),
                "abhaAddress": None,  # issued by ABDM only; never generated locally
                "verificationStatus": "Linked" if member.abha_id else "Not linked to ABDM",
                "consentArtifacts": [],  # consents come from ABDM, none are recorded locally
                "immunizationHistory": [
                    {"record": r.title, "date": r.record_date} for r in vaccinations
                ],
                "linkedFacilities": [],
            }

    # AI consultation (rule-based; no language model) -------------------

    def consult(self, owner_id: str, member_id: str, message: str) -> dict:
        with get_db() as db:
            member = _owned_member(db, owner_id, member_id)
            name = member.name.split()[0]
        vitals = self.list_vitals(owner_id, member_id)
        meds = self.list_medications(owner_id, member_id)
        apts = self.list_appointments(owner_id, member_id)
        confirmed = [a for a in apts if a["status"] == "Confirmed"]

        bp = next((v for v in vitals if v["type"] == "Blood Pressure"), None)
        sugar = next((v for v in vitals if "Fasting" in v["type"]), None)
        pending = [m for m in meds if not m["takenToday"]]
        lower = message.lower()

        if any(k in lower for k in ("sugar", "glucose", "diabetes", "hba1c")):
            if sugar:
                reply = (
                    f"Hi {name}. Your latest fasting glucose reading is **{sugar['value']} {sugar['unit']}** "
                    f"(reference {sugar['targetRange']}, status: {sugar['status']}). Discuss any change with your doctor."
                )
            else:
                reply = f"Hi {name}. There is no fasting glucose reading logged yet. Add one under Vitals so it can be tracked."
        elif any(k in lower for k in ("bp", "pressure", "hypertension")):
            if bp:
                reply = (
                    f"Hi {name}. Your latest blood pressure is **{bp['value']} {bp['unit']}** "
                    f"(status: {bp['status']}). Discuss any change with your doctor."
                )
            else:
                reply = f"Hi {name}. No blood pressure reading is logged yet. Add one under Vitals so it can be tracked."
        elif any(k in lower for k in ("appointment", "doctor", "consult", "visit")):
            if confirmed:
                upcoming = confirmed[0]
                reply = (
                    f"You have a {upcoming['type'].lower()} with **{upcoming['doctorName']}** "
                    f"({upcoming['specialty']}) on **{upcoming['date']} {upcoming['time']}**. "
                    f"Token #{upcoming['tokenNumber']}."
                )
            else:
                reply = f"You have no upcoming appointments, {name}."
        elif any(k in lower for k in ("medicine", "medication", "tablet", "dose")):
            if not meds:
                reply = f"Hi {name}. No medicines are on the schedule."
            elif pending:
                names = ", ".join(f"**{m['name']}** ({m['timeSlot']})" for m in pending)
                reply = f"Hi {name}. Not yet marked as taken today: {names}."
            else:
                reply = f"Hi {name}. All {len(meds)} scheduled medicines are marked as taken today."
        else:
            summary_bits = []
            if bp:
                summary_bits.append(f"BP {bp['value']} {bp['unit']}")
            if sugar:
                summary_bits.append(f"fasting glucose {sugar['value']} {sugar['unit']}")
            summary = ", ".join(summary_bits) if summary_bits else "no vitals logged"
            pending_txt = pending[0]["name"] if pending else "nothing pending"
            reply = f"Hi {name}. Latest readings: {summary}. Not yet marked as taken today: {pending_txt}."

        return {
            "reply": reply,
            "model": "MiPAAS rule-based assistant (no language model)",
            "groundedOn": {
                "vitalsCount": len(vitals),
                "activeMedications": len(meds),
                "pendingMedications": len(pending),
                "upcomingAppointments": len(confirmed),
            },
            "disclaimer": "Automated summary of your logged data. Not medical advice; consult your treating physician.",
        }

    # Dashboard ---------------------------------------------------------

    def today_summary(self, owner_id: str, member_id: str) -> dict:
        meds = self.list_medications(owner_id, member_id)
        vitals = self.list_vitals(owner_id, member_id)
        start_of_day = datetime.combine(date.today(), time.min).astimezone(UTC)
        with get_db() as db:
            logged_today = (
                db.query(ch.VitalRecord)
                .filter(
                    ch.VitalRecord.member_id == member_id, ch.VitalRecord.created_at >= start_of_day
                )
                .count()
            )
        taken = len([m for m in meds if m["takenToday"]])
        return {
            "medicationAdherence": {
                "taken": taken,
                "total": len(meds),
                "percentage": round((taken / len(meds)) * 100) if meds else 100,
            },
            "vitalsLoggedToday": logged_today,
            "abnormalVitals": [v for v in vitals if v["status"] in ("Elevated", "Attention")],
            "recordsInLocker": len(self.list_records(owner_id, member_id)),
            "upcomingAppointments": [
                a for a in self.list_appointments(owner_id, member_id) if a["status"] == "Confirmed"
            ],
        }


_service: EkaCarePortalService | None = None


def get_eka_portal_service() -> EkaCarePortalService:
    global _service
    if _service is None:
        _service = EkaCarePortalService()
    return _service
