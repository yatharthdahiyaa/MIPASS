"""
Care service: the consented doctor <-> patient relationship and everything that runs
inside it (shared record, secure messages, clinician reviews, consultations).

Rules enforced here, independent of the HTTP layer:

* A care link exists between exactly one patient and one verified doctor. Either side can
  invite; the other side must accept. Either side can end it.
* A doctor only ever reads the record areas (scopes) the patient has shared, and only
  while the link is ``active``.
* Every write notifies the other party through :mod:`app.services.notify`.
"""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database.models.care import (
    CARE_SCOPES,
    CONSULT_MODES,
    CareLink,
    CareMessage,
    ClinicianReview,
    ConsultRequest,
)
from app.database.models.doctor_panel import DoctorStudy
from app.database.models.iam import User
from app.database.models.patient_ehr import (
    ClinicianProfile,
    DailyLog,
    PatientDocument,
    PatientMedication,
    PatientProfile,
    XrayStudy,
)
from app.services import events, notify
from app.services import patient_ehr as ehr
from app.services.rbac import Role

DOCTOR_ROLES = {Role.DOCTOR.value, Role.RADIOLOGIST.value}
MAX_MESSAGE = 4000


class CareError(ehr.EhrError):
    """Carries the HTTP status and code for the API layer."""


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime) and value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


def _name(user: User | None) -> str:
    if user is None:
        return "Former member"
    return " ".join(p for p in (user.first_name, user.last_name) if p) or user.username


def scopes_of(link: CareLink) -> list[str]:
    return [s for s in json.loads(link.scopes_json or "[]") if s in CARE_SCOPES]


def _clean_scopes(raw: Any) -> list[str]:
    if raw is None:
        return list(CARE_SCOPES)
    if not isinstance(raw, list):
        raise CareError("scopes must be a list.")
    scopes = [s for s in CARE_SCOPES if s in raw]
    if not scopes:
        raise CareError("Share at least one part of your record.")
    return scopes


# --------------------------------------------------------------------------- serialisation


def doctor_card(user: User, profile: ClinicianProfile | None) -> dict:
    return {
        "id": user.id,
        "name": _name(user),
        "organization": user.organization,
        "specialty": profile.specialty if profile else None,
        "bio": profile.bio if profile else None,
        "years_experience": profile.years_experience if profile else None,
        "share_code": profile.share_code if profile else None,
        "verified": bool(profile and profile.verified_at),
        "consult_modes": json.loads(profile.consult_modes_json) if profile and profile.consult_modes_json else list(CONSULT_MODES),
    }


def patient_card(user: User, profile: PatientProfile | None) -> dict:
    return {
        "id": user.id,
        "name": _name(user),
        "email": user.email,
        "age": ehr.serialize_profile(profile)["age"] if profile else None,
        "sex": profile.sex if profile else None,
    }


def serialize_link(db: Session, link: CareLink, *, viewer: str) -> dict:
    """``viewer`` is "patient" or "doctor": the other party is embedded."""
    out = {
        "id": link.id,
        "status": link.status,
        "requested_by": link.requested_by,
        "scopes": scopes_of(link),
        "message": link.message,
        "created_at": _iso(link.created_at),
        "accepted_at": _iso(link.accepted_at),
        "ended_at": _iso(link.ended_at),
        "ended_by": link.ended_by,
    }
    if viewer == "patient":
        doctor = db.get(User, link.doctor_id)
        profile = db.query(ClinicianProfile).filter_by(user_id=link.doctor_id).first()
        out["doctor"] = doctor_card(doctor, profile) if doctor else None
    else:
        patient = db.get(User, link.patient_id)
        profile = db.query(PatientProfile).filter_by(user_id=link.patient_id).first()
        out["patient"] = patient_card(patient, profile) if patient else None
    return out


def serialize_message(m: CareMessage, viewer_id: str) -> dict:
    return {
        "id": m.id,
        "link_id": m.link_id,
        "sender_id": m.sender_id,
        "mine": m.sender_id == viewer_id,
        "body": m.body,
        "ref_type": m.ref_type,
        "ref_id": m.ref_id,
        "read_at": _iso(m.read_at),
        "created_at": _iso(m.created_at),
    }


def serialize_review(r: ClinicianReview) -> dict:
    return {
        "id": r.id,
        "link_id": r.link_id,
        "doctor_id": r.doctor_id,
        "doctor_name": r.doctor_name,
        "target_type": r.target_type,
        "target_id": r.target_id,
        "impression": r.impression,
        "recommendation": r.recommendation,
        "urgency": r.urgency,
        "created_at": _iso(r.created_at),
    }


def serialize_consult(db: Session, c: ConsultRequest, *, viewer: str) -> dict:
    other = db.get(User, c.doctor_id if viewer == "patient" else c.patient_id)
    return {
        "id": c.id,
        "link_id": c.link_id,
        "status": c.status,
        "mode": c.mode,
        "reason": c.reason,
        "preferred_at": _iso(c.preferred_at),
        "scheduled_at": _iso(c.scheduled_at),
        "doctor_note": c.doctor_note,
        "responded_at": _iso(c.responded_at),
        "completed_at": _iso(c.completed_at),
        "created_at": _iso(c.created_at),
        ("doctor" if viewer == "patient" else "patient"): {
            "id": other.id if other else None,
            "name": _name(other),
        },
    }


# --------------------------------------------------------------------------- directory


def doctor_directory(db: Session, q: str = "", limit: int = 50) -> list[dict]:
    """Verified doctors who chose to be listed."""
    query = (
        db.query(User, ClinicianProfile)
        .join(ClinicianProfile, ClinicianProfile.user_id == User.id)
        .filter(
            User.is_active.is_(True),
            User.role.in_(DOCTOR_ROLES),
            ClinicianProfile.verified_at.isnot(None),
            ClinicianProfile.listed.is_(True),
        )
    )
    q = (q or "").strip().lower()[:100]
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                func.lower(func.coalesce(User.first_name, "")).like(like),
                func.lower(func.coalesce(User.last_name, "")).like(like),
                func.lower(func.coalesce(User.organization, "")).like(like),
                func.lower(ClinicianProfile.specialty).like(like),
            )
        )
    rows = query.order_by(User.last_name, User.first_name).limit(max(1, min(limit, 100))).all()
    return [doctor_card(u, p) for u, p in rows]


def find_doctor(db: Session, *, email: str | None = None, code: str | None = None) -> User:
    code = (code or "").strip().upper()
    email = (email or "").strip().lower()
    if code:
        if not code.startswith("DR-"):
            code = "DR-" + code
        profile = db.query(ClinicianProfile).filter_by(share_code=code).first()
        user = db.get(User, profile.user_id) if profile else None
    elif email:
        user = db.query(User).filter(func.lower(User.email) == email).first()
    else:
        raise CareError("Enter the doctor's e-mail address or share code.")
    if user is None or not user.is_active or user.role not in DOCTOR_ROLES:
        raise CareError("No verified doctor matches that.", 404, "DOCTOR_NOT_FOUND")
    return user


# --------------------------------------------------------------------------- links


def get_link(db: Session, link_id: str, user_id: str) -> CareLink:
    link = (
        db.query(CareLink)
        .filter(
            CareLink.id == link_id,
            or_(CareLink.patient_id == user_id, CareLink.doctor_id == user_id),
        )
        .first()
    )
    if link is None:
        raise CareError("Not found.", 404, "NOT_FOUND")
    return link


def require_active(link: CareLink) -> None:
    if link.status != "active":
        raise CareError("This care connection isn't active.", 409, "LINK_INACTIVE")


def require_scope(link: CareLink, scope: str) -> None:
    require_active(link)
    if scope not in scopes_of(link):
        raise CareError(f"The patient hasn't shared their {scope}.", 403, "SCOPE_NOT_SHARED")


def _existing(db: Session, patient_id: str, doctor_id: str) -> CareLink | None:
    return db.query(CareLink).filter_by(patient_id=patient_id, doctor_id=doctor_id).first()


def patient_invite(
    db: Session, patient: User, doctor: User, *, scopes: Any, message: str | None
) -> CareLink:
    if patient.id == doctor.id:
        raise CareError("You can't connect with yourself.")
    scopes = _clean_scopes(scopes)
    link = _existing(db, patient.id, doctor.id)
    if link and link.status in ("pending", "active"):
        raise CareError("You're already connected or an invitation is waiting.", 409, "LINK_EXISTS")
    if link is None:
        link = CareLink(patient_id=patient.id, doctor_id=doctor.id)
        db.add(link)
    link.status = "pending"
    link.requested_by = "patient"
    link.scopes_json = json.dumps(scopes)
    link.message = (message or "").strip()[:500] or None
    link.accepted_at = link.ended_at = link.ended_by = None
    db.flush()
    notify.notify(
        db,
        doctor.id,
        "care.invite",
        f"{_name(patient)} wants to share their health record with you",
        link.message or "Open your patient list to accept or decline.",
        link="/doctor/patients",
        email_cta="Review the request",
    )
    return link


def doctor_invite(db: Session, doctor: User, patient_email: str, *, message: str | None) -> CareLink:
    email = (patient_email or "").strip().lower()
    patient = db.query(User).filter(func.lower(User.email) == email).first()
    if patient is None or not patient.is_active or patient.role != Role.PATIENT.value:
        raise CareError(
            "No patient account uses that e-mail. Ask them to create one on MIPAAS first.",
            404,
            "PATIENT_NOT_FOUND",
        )
    link = _existing(db, patient.id, doctor.id)
    if link and link.status in ("pending", "active"):
        raise CareError("You're already connected or an invitation is waiting.", 409, "LINK_EXISTS")
    if link is None:
        link = CareLink(patient_id=patient.id, doctor_id=doctor.id)
        db.add(link)
    link.status = "pending"
    link.requested_by = "doctor"
    link.scopes_json = json.dumps(list(CARE_SCOPES))
    link.message = (message or "").strip()[:500] or None
    link.accepted_at = link.ended_at = link.ended_by = None
    db.flush()
    notify.notify(
        db,
        patient.id,
        "care.invite",
        f"Dr. {_name(doctor)} would like to connect with you",
        "Accept to share the parts of your record you choose; you can stop sharing at any time.",
        link="/patient/care",
        email_cta="Review the request",
    )
    return link


def respond(db: Session, link: CareLink, *, actor: User, accept: bool, scopes: Any = None) -> CareLink:
    actor_role = "patient" if actor.id == link.patient_id else "doctor"
    if link.status != "pending":
        raise CareError("This invitation was already answered.", 409, "NOT_PENDING")
    if link.requested_by == actor_role:
        raise CareError("Only the invited side can answer.", 403)
    if accept:
        link.status = "active"
        link.accepted_at = _utcnow()
        if actor_role == "patient" and scopes is not None:
            link.scopes_json = json.dumps(_clean_scopes(scopes))
    else:
        link.status = "declined"
        link.ended_at = _utcnow()
        link.ended_by = actor_role
    db.flush()
    other_id = link.doctor_id if actor_role == "patient" else link.patient_id
    notify.notify(
        db,
        other_id,
        "care.accepted" if accept else "care.invite",
        f"{_name(actor)} {'accepted' if accept else 'declined'} your care connection",
        "You can now message each other and share the record."
        if accept
        else "No record was shared.",
        link="/doctor/patients" if actor_role == "patient" else "/patient/care",
    )
    return link


def end_link(db: Session, link: CareLink, *, actor: User) -> CareLink:
    actor_role = "patient" if actor.id == link.patient_id else "doctor"
    if link.status not in ("pending", "active"):
        return link
    link.status = "revoked"
    link.ended_at = _utcnow()
    link.ended_by = actor_role
    db.flush()
    other_id = link.doctor_id if actor_role == "patient" else link.patient_id
    notify.notify(
        db,
        other_id,
        "care.accepted",
        f"{_name(actor)} ended your care connection",
        "Shared record access and messaging have stopped.",
        link="/doctor/patients" if actor_role == "patient" else "/patient/care",
    )
    return link


def update_scopes(db: Session, link: CareLink, scopes: Any) -> CareLink:
    link.scopes_json = json.dumps(_clean_scopes(scopes))
    db.flush()
    return link


def links_for(db: Session, user_id: str, role: str, *, statuses: tuple[str, ...] | None = None) -> list[CareLink]:
    col = CareLink.patient_id if role == "patient" else CareLink.doctor_id
    q = db.query(CareLink).filter(col == user_id)
    if statuses:
        q = q.filter(CareLink.status.in_(statuses))
    return q.order_by(CareLink.created_at.desc()).all()


def active_link_between(db: Session, patient_id: str, doctor_id: str) -> CareLink | None:
    link = _existing(db, patient_id, doctor_id)
    return link if link and link.status == "active" else None


# --------------------------------------------------------------------------- messages


def list_messages(db: Session, link: CareLink, *, after_id: str | None = None, limit: int = 100) -> list[CareMessage]:
    q = db.query(CareMessage).filter(CareMessage.link_id == link.id)
    if after_id:
        anchor = db.query(CareMessage.created_at).filter_by(id=after_id, link_id=link.id).scalar()
        if anchor is not None:
            q = q.filter(CareMessage.created_at > anchor)
    return q.order_by(CareMessage.created_at.asc()).limit(max(1, min(limit, 500))).all()


def post_message(
    db: Session, link: CareLink, sender: User, body: str, *, ref_type: str | None = None, ref_id: str | None = None
) -> CareMessage:
    require_active(link)
    body = (body or "").strip()
    if not body:
        raise CareError("Type a message.")
    if len(body) > MAX_MESSAGE:
        raise CareError(f"Messages can be up to {MAX_MESSAGE} characters.")
    if ref_type and ref_type not in ("xray_study", "document", "doctor_study", "consult"):
        raise CareError("Unknown reference type.")
    msg = CareMessage(
        link_id=link.id, sender_id=sender.id, body=body, ref_type=ref_type, ref_id=ref_id
    )
    db.add(msg)
    db.flush()
    is_patient = sender.id == link.patient_id
    notify.notify(
        db,
        link.doctor_id if is_patient else link.patient_id,
        "care.message",
        f"New message from {'' if is_patient else 'Dr. '}{_name(sender)}",
        body[:140] + ("..." if len(body) > 140 else ""),
        link=f"/doctor/inbox?link={link.id}" if is_patient else f"/patient/care?tab=messages&link={link.id}",
    )
    return msg


def mark_thread_read(db: Session, link: CareLink, reader_id: str) -> int:
    count = (
        db.query(CareMessage)
        .filter(
            CareMessage.link_id == link.id,
            CareMessage.sender_id != reader_id,
            CareMessage.read_at.is_(None),
        )
        .update({CareMessage.read_at: _utcnow()}, synchronize_session=False)
    )
    return int(count or 0)


def unread_messages(db: Session, user_id: str, role: str) -> int:
    col = CareLink.patient_id if role == "patient" else CareLink.doctor_id
    return (
        db.query(func.count(CareMessage.id))
        .join(CareLink, CareLink.id == CareMessage.link_id)
        .filter(col == user_id, CareMessage.sender_id != user_id, CareMessage.read_at.is_(None))
        .scalar()
        or 0
    )


def threads_for(db: Session, user_id: str, role: str) -> list[dict]:
    links = links_for(db, user_id, role, statuses=("active",))
    out = []
    for link in links:
        last = (
            db.query(CareMessage)
            .filter_by(link_id=link.id)
            .order_by(CareMessage.created_at.desc())
            .first()
        )
        unread = (
            db.query(func.count(CareMessage.id))
            .filter(
                CareMessage.link_id == link.id,
                CareMessage.sender_id != user_id,
                CareMessage.read_at.is_(None),
            )
            .scalar()
            or 0
        )
        out.append(
            {
                "link": serialize_link(db, link, viewer=role),
                "last_message": serialize_message(last, user_id) if last else None,
                "unread": unread,
            }
        )
    out.sort(
        key=lambda t: (t["last_message"] or {}).get("created_at") or t["link"]["created_at"] or "",
        reverse=True,
    )
    return out


# --------------------------------------------------------------------------- shared record


def shared_record(db: Session, link: CareLink, *, days: int = 30) -> dict:
    """What the doctor may see of the patient's record, by scope."""
    require_active(link)
    scopes = scopes_of(link)
    pid = link.patient_id
    patient = db.get(User, pid)
    profile = db.query(PatientProfile).filter_by(user_id=pid).first()
    out: dict[str, Any] = {
        "link": serialize_link(db, link, viewer="doctor"),
        "scopes": scopes,
        "patient": patient_card(patient, profile) if patient else None,
    }
    if "profile" in scopes:
        out["profile"] = ehr.serialize_profile(profile) if profile else None
    if "vitals" in scopes:
        # log_date is the patient's local calendar day, which can be one day ahead of UTC
        # (e.g. just after midnight in India), so the window reaches one day past UTC today.
        today = _utcnow().date()
        tomorrow = today + timedelta(days=1)
        logs = ehr.list_logs(db, pid, days + 1, tomorrow)
        streak_until = tomorrow if any(x.log_date == tomorrow for x in logs) else today
        out["vitals"] = {
            "latest": ehr.latest_readings(db, pid),
            "logs": [ehr.serialize_log(x) for x in logs],
            "days": days,
            "streak_days": ehr.logging_streak(db, pid, streak_until),
        }
    if "medications" in scopes:
        meds = (
            db.query(PatientMedication)
            .filter_by(user_id=pid)
            .order_by(PatientMedication.is_active.desc(), PatientMedication.name)
            .all()
        )
        out["medications"] = {
            "items": [ehr.serialize_medication(m) for m in meds],
            "adherence_7d": ehr.adherence(db, pid, _utcnow().date(), 7),
            "adherence_30d": ehr.adherence(db, pid, _utcnow().date(), 30),
        }
    if "documents" in scopes:
        docs = (
            db.query(PatientDocument)
            .filter_by(user_id=pid)
            .order_by(PatientDocument.created_at.desc())
            .all()
        )
        out["documents"] = [ehr.serialize_document(d) for d in docs]
    if "xrays" in scopes:
        xrays = (
            db.query(XrayStudy).filter_by(user_id=pid).order_by(XrayStudy.created_at.desc()).all()
        )
        reviews = {
            r.target_id: serialize_review(r)
            for r in db.query(ClinicianReview)
            .filter_by(link_id=link.id, target_type="xray_study")
            .order_by(ClinicianReview.created_at)
            .all()
        }
        items = []
        for x in xrays:
            item = ehr.serialize_xray(x, detail=True)
            item["my_review"] = reviews.get(x.id)
            items.append(item)
        out["xrays"] = items
    # Reports this doctor shared with the patient (their own studies linked to the patient).
    out["reports"] = [
        {
            "id": s.id,
            "modality": s.modality,
            "primary_finding": s.primary_finding,
            "severity": s.severity,
            "report_status": s.report_status,
            "signed_at": _iso(s.signed_at),
            "study_date": s.study_date.isoformat() if s.study_date else None,
        }
        for s in db.query(DoctorStudy)
        .filter_by(user_id=link.doctor_id, patient_user_id=pid)
        .order_by(DoctorStudy.created_at.desc())
        .all()
    ]
    return out


def patient_xray(db: Session, link: CareLink, xray_id: str) -> XrayStudy:
    require_scope(link, "xrays")
    study = db.query(XrayStudy).filter_by(id=xray_id, user_id=link.patient_id).first()
    if study is None:
        raise CareError("Not found.", 404, "NOT_FOUND")
    return study


def patient_document(db: Session, link: CareLink, doc_id: str) -> PatientDocument:
    require_scope(link, "documents")
    doc = db.query(PatientDocument).filter_by(id=doc_id, user_id=link.patient_id).first()
    if doc is None:
        raise CareError("Not found.", 404, "NOT_FOUND")
    return doc


# --------------------------------------------------------------------------- reviews


def create_review(
    db: Session,
    link: CareLink,
    doctor: User,
    study: XrayStudy,
    *,
    impression: str,
    recommendation: str | None,
    urgency: str,
) -> ClinicianReview:
    require_scope(link, "xrays")
    impression = (impression or "").strip()
    if len(impression) < 3:
        raise CareError("Write your impression.")
    if urgency not in ("routine", "soon", "urgent"):
        raise CareError("urgency must be routine, soon or urgent.")
    review = ClinicianReview(
        link_id=link.id,
        doctor_id=doctor.id,
        patient_id=link.patient_id,
        target_type="xray_study",
        target_id=study.id,
        impression=impression[:8000],
        recommendation=(recommendation or "").strip()[:4000] or None,
        urgency=urgency,
        doctor_name=_name(doctor),
    )
    db.add(review)
    db.flush()
    events.publish_on_commit(db, link.patient_id, "xray.reviewed", study_id=study.id, urgency=urgency)
    notify.notify(
        db,
        link.patient_id,
        "care.review",
        f"Dr. {_name(doctor)} reviewed your X-ray",
        impression[:160] + ("..." if len(impression) > 160 else ""),
        link=f"/patient/xrays?id={study.id}",
        severity="warning" if urgency == "urgent" else "info",
        email_cta="Read the review",
    )
    return review


def reviews_for(db: Session, target_type: str, target_id: str) -> list[ClinicianReview]:
    return (
        db.query(ClinicianReview)
        .filter_by(target_type=target_type, target_id=target_id)
        .order_by(ClinicianReview.created_at.desc())
        .all()
    )


def reviewed_targets(db: Session, patient_id: str, target_type: str = "xray_study") -> set[str]:
    """Ids of the patient's items that have at least one clinician review."""
    rows = (
        db.query(ClinicianReview.target_id)
        .filter_by(patient_id=patient_id, target_type=target_type)
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def unread_for_link(db: Session, link: CareLink, reader_id: str) -> int:
    return (
        db.query(func.count(CareMessage.id))
        .filter(
            CareMessage.link_id == link.id,
            CareMessage.sender_id != reader_id,
            CareMessage.read_at.is_(None),
        )
        .scalar()
        or 0
    )


# --------------------------------------------------------------------------- consultations


def _parse_dt(value: Any, field: str) -> datetime | None:
    if value in (None, ""):
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        raise CareError(f"'{field}' must be an ISO date-time.") from None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed


def request_consult(
    db: Session, link: CareLink, patient: User, *, reason: str, mode: str, preferred_at: Any
) -> ConsultRequest:
    require_active(link)
    reason = (reason or "").strip()
    if len(reason) < 3:
        raise CareError("Tell the doctor what the consultation is about.")
    if mode not in CONSULT_MODES:
        raise CareError("mode must be video, in_person or chat.")
    open_count = (
        db.query(func.count(ConsultRequest.id))
        .filter(
            ConsultRequest.link_id == link.id,
            ConsultRequest.status.in_(("requested", "scheduled")),
        )
        .scalar()
        or 0
    )
    if open_count >= 5:
        raise CareError("You already have several open consultation requests with this doctor.", 409)
    consult = ConsultRequest(
        link_id=link.id,
        patient_id=link.patient_id,
        doctor_id=link.doctor_id,
        status="requested",
        mode=mode,
        reason=reason[:4000],
        preferred_at=_parse_dt(preferred_at, "preferred_at"),
    )
    db.add(consult)
    db.flush()
    notify.notify(
        db,
        link.doctor_id,
        "consult.update",
        f"{_name(patient)} requested a consultation",
        reason[:160],
        link="/doctor/consults",
        email_cta="See the request",
    )
    return consult


def respond_consult(
    db: Session, consult: ConsultRequest, doctor: User, *, action: str, scheduled_at: Any = None, note: str | None = None
) -> ConsultRequest:
    if consult.doctor_id != doctor.id:
        raise CareError("Not found.", 404, "NOT_FOUND")
    note = (note or "").strip()[:2000] or None
    now = _utcnow()
    if action == "schedule":
        when = _parse_dt(scheduled_at, "scheduled_at")
        if when is None:
            raise CareError("Pick a date and time.")
        if when < now - timedelta(hours=1):
            raise CareError("That time is in the past.")
        if consult.status not in ("requested", "scheduled"):
            raise CareError("This request is closed.", 409)
        consult.status, consult.scheduled_at, consult.responded_at = "scheduled", when, now
        # No clock time here: the server doesn't know the patient's time zone, and the
        # consultations page shows the appointment in their local time.
        title = "Your consultation is scheduled"
        body = note or "Open your consultations to see the date and time."
    elif action == "decline":
        if consult.status not in ("requested", "scheduled"):
            raise CareError("This request is closed.", 409)
        consult.status, consult.responded_at = "declined", now
        title, body = "Your consultation request was declined", note or "The doctor can't take this consultation."
    elif action == "complete":
        if consult.status != "scheduled":
            raise CareError("Only scheduled consultations can be completed.", 409)
        consult.status, consult.completed_at = "completed", now
        title, body = "Your consultation is complete", note or "Thanks for attending."
    else:
        raise CareError("action must be schedule, decline or complete.")
    consult.doctor_note = note
    db.flush()
    notify.notify(
        db,
        consult.patient_id,
        "consult.update",
        title,
        body,
        link="/patient/care?tab=consults",
        email_cta="Open consultations",
    )
    return consult


def cancel_consult(db: Session, consult: ConsultRequest, patient: User) -> ConsultRequest:
    if consult.patient_id != patient.id:
        raise CareError("Not found.", 404, "NOT_FOUND")
    if consult.status not in ("requested", "scheduled"):
        raise CareError("This request is closed.", 409)
    consult.status = "cancelled"
    consult.completed_at = _utcnow()
    db.flush()
    notify.notify(
        db,
        consult.doctor_id,
        "consult.update",
        f"{_name(patient)} cancelled a consultation",
        consult.reason[:160],
        link="/doctor/consults",
    )
    return consult


def list_consults(db: Session, user_id: str, role: str, *, status: str | None = None, upcoming: bool = False) -> list[ConsultRequest]:
    col = ConsultRequest.patient_id if role == "patient" else ConsultRequest.doctor_id
    q = db.query(ConsultRequest).filter(col == user_id)
    if status:
        q = q.filter(ConsultRequest.status == status)
    if upcoming:
        q = q.filter(
            ConsultRequest.status == "scheduled",
            ConsultRequest.scheduled_at >= _utcnow() - timedelta(hours=1),
        ).order_by(ConsultRequest.scheduled_at.asc())
    else:
        q = q.order_by(ConsultRequest.created_at.desc())
    return q.limit(200).all()


def get_consult(db: Session, consult_id: str, user_id: str) -> ConsultRequest:
    c = (
        db.query(ConsultRequest)
        .filter(
            ConsultRequest.id == consult_id,
            or_(ConsultRequest.patient_id == user_id, ConsultRequest.doctor_id == user_id),
        )
        .first()
    )
    if c is None:
        raise CareError("Not found.", 404, "NOT_FOUND")
    return c


# --------------------------------------------------------------------------- vitals alerts


def vitals_alerts(log: DailyLog) -> list[str]:
    """Readings outside safe self-monitoring ranges (same thresholds the patient UI labels)."""
    alerts = []
    if log.systolic is not None and log.diastolic is not None and (log.systolic >= 180 or log.diastolic >= 120):
        alerts.append(f"Blood pressure {log.systolic}/{log.diastolic} mmHg is dangerously high")
    if log.heart_rate is not None and (log.heart_rate >= 130 or log.heart_rate < 40):
        alerts.append(f"Heart rate {log.heart_rate} bpm is outside the safe range")
    if log.glucose is not None and (log.glucose < 54 or log.glucose >= 300):
        alerts.append(f"Blood glucose {log.glucose:g} mg/dL is outside the safe range")
    if log.spo2 is not None and log.spo2 < 90:
        alerts.append(f"Oxygen saturation {log.spo2}% is low")
    if log.temperature_c is not None and (log.temperature_c >= 39.5 or log.temperature_c < 35):
        alerts.append(f"Temperature {log.temperature_c:g} C is outside the safe range")
    return alerts


def alert_on_vitals(db: Session, patient: User, log: DailyLog) -> None:
    alerts = vitals_alerts(log)
    if not alerts:
        return
    body = "; ".join(alerts) + ". Please contact a doctor or emergency services (112) if you feel unwell."
    notify.notify(
        db, patient.id, "vitals.alert", "A reading needs attention", body, link="/patient/log", severity="critical"
    )
    for link in links_for(db, patient.id, "patient", statuses=("active",)):
        if "vitals" in scopes_of(link):
            notify.notify(
                db,
                link.doctor_id,
                "vitals.alert",
                f"{_name(patient)} logged a reading that needs attention",
                "; ".join(alerts),
                link=f"/doctor/patients/{link.id}",
                severity="critical",
            )


def alert_on_screening(db: Session, patient: User, study: XrayStudy) -> None:
    """Tell the patient (and doctors sharing X-rays) when an AI screening flags something."""
    if study.status != "completed":
        return
    urgent = study.severity in ("HIGH", "CRITICAL")
    notify.notify(
        db,
        patient.id,
        "screening.result",
        "Your X-ray screening is ready",
        "The AI flagged findings a doctor should review." if urgent else "No major concerns were flagged. Share it with your doctor at your next visit.",
        link=f"/patient/xrays?id={study.id}",
        severity="warning" if urgent else "info",
        email=urgent,
    )
    if urgent:
        for link in links_for(db, patient.id, "patient", statuses=("active",)):
            if "xrays" in scopes_of(link):
                notify.notify(
                    db,
                    link.doctor_id,
                    "screening.result",
                    f"AI flagged {_name(patient)}'s chest X-ray as {study.severity}",
                    f"Main finding: {study.primary_finding or 'see findings'}.",
                    link=f"/doctor/patients/{link.id}?xray={study.id}",
                    severity="warning",
                )


def today() -> date:
    return _utcnow().date()
