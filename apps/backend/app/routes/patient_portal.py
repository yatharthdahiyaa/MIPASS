"""
Patient portal API (EHR). Every route requires a signed-in account with role
``patient`` and only ever reads or writes that patient's own rows.

Record
    GET    /patient/overview?date=YYYY-MM-DD
    GET    /patient/profile                 PUT /patient/profile
    GET    /patient/logs?days=30&date=      POST /patient/logs      DELETE /patient/logs/<id>
    GET    /patient/medications             POST /patient/medications
    PATCH  /patient/medications/<id>        DELETE /patient/medications/<id>
    GET    /patient/medications/day?date=   POST /patient/medications/<id>/doses
    GET    /patient/documents               POST /patient/documents (multipart)
    GET    /patient/documents/<id>/file     DELETE /patient/documents/<id>
    GET    /patient/xrays                   POST /patient/xrays (multipart; runs AI screening)
    GET    /patient/xrays/<id>              GET /patient/xrays/<id>/image?kind=original|preview|heatmap
    DELETE /patient/xrays/<id>
    GET    /patient/export                  full JSON copy of the record

Care team (doctor connections, consented by the patient)
    GET    /patient/doctors?q=              verified doctors who chose to be listed
    GET    /patient/care-team?status=       links (active / pending / all)
    POST   /patient/care-team/invite        {doctor_email | doctor_code, scopes?, message?}
    POST   /patient/care-team/<id>/respond  {accept: bool, scopes?}
    PATCH  /patient/care-team/<id>          {scopes}
    DELETE /patient/care-team/<id>          stop sharing
    GET    /patient/consults                POST /patient/consults {link_id, reason, mode, preferred_at?}
    POST   /patient/consults/<id>/cancel
    GET    /patient/reports                 signed reports doctors shared with this patient
    GET    /patient/reports/<id>            GET /patient/reports/<id>/image?kind=preview|heatmap
"""

import json
from functools import wraps

import structlog
from flask import Blueprint, current_app, g, request, send_file

from app.database.models.iam import AuditLog, User
from app.database.models.patient_ehr import (
    DailyLog,
    PatientDocument,
    PatientMedication,
    XrayStudy,
)
from app.database.session import get_db
from app.middleware.auth_middleware import get_authenticated_user
from app.services import accounts, care, events, notify
from app.services import doctor_panel as panel
from app.services import patient_ehr as ehr
from app.services.rbac import Role
from app.services.security import LIMITS, get_rate_limiter
from app.utils.response import api_error, api_response

logger = structlog.get_logger()
patient_bp = Blueprint("patient_portal", __name__)


def patient_only(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_authenticated_user()
        if user is None:
            return api_error("Please sign in.", 401)
        if user.role != Role.PATIENT:
            return api_error("This area is for patient accounts.", 403)
        try:
            return fn(*args, **kwargs)
        except ehr.EhrError as exc:
            return api_error(exc.message, exc.status, exc.code)
        except accounts.AccountError as exc:
            return api_error(exc.message, exc.status, exc.code)

    return wrapper


def _uid() -> str:
    return g.current_user.id


def _me(db) -> User:
    return db.get(User, _uid())


def _audit(db, action: str, resource_type: str, resource_id=None, details=None) -> None:
    db.add(
        AuditLog(
            user_id=_uid(),
            username=g.current_user.email,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            status="success",
            ip_address=request.remote_addr,
            user_agent=(request.headers.get("User-Agent") or "")[:255] or None,
            details_json=json.dumps(details) if details else None,
        )
    )


def _store() -> ehr.FileStore:
    return ehr.FileStore(current_app.config["PATIENT_FILES_DIR"])


def _doctor_store() -> ehr.FileStore:
    return ehr.FileStore(current_app.config["DOCTOR_FILES_DIR"])


def _max_bytes() -> int:
    return int(current_app.config["PATIENT_MAX_UPLOAD_BYTES"])


def _owned(db, model, item_id):
    item = db.query(model).filter_by(id=item_id, user_id=_uid()).first()
    if item is None:
        raise ehr.EhrError("Not found.", 404, "NOT_FOUND")
    return item


def _send(path, ctype, name, attachment):
    if path is None:
        return api_error("File not available.", 404)
    response = send_file(path, mimetype=ctype, as_attachment=attachment, download_name=name, max_age=0)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


# ---------------------------------------------------------------------------
# Overview & profile
# ---------------------------------------------------------------------------


@patient_bp.route("/patient/overview", methods=["GET"])
@patient_only
def overview():
    day = ehr.parse_day_param(request.args.get("date"))
    with get_db() as db:
        profile = ehr.get_or_create_profile(db, _uid())
        meds_today = ehr.medication_day(db, _uid(), day)
        slots = [s for m in meds_today for s in m["doses"]]
        latest_xray = (
            db.query(XrayStudy)
            .filter_by(user_id=_uid())
            .order_by(XrayStudy.created_at.desc())
            .first()
        )
        today_logs = db.query(DailyLog).filter_by(user_id=_uid(), log_date=day).count()
        active_links = care.links_for(db, _uid(), "patient", statuses=("active",))
        pending_links = care.links_for(db, _uid(), "patient", statuses=("pending",))
        upcoming = care.list_consults(db, _uid(), "patient", upcoming=True)
        me = _me(db)
        return api_response(
            {
                "date": day.isoformat(),
                "profile": ehr.serialize_profile(profile),
                "latest": ehr.latest_readings(db, _uid()),
                "today": {
                    "check_ins": today_logs,
                    "doses_scheduled": len(slots),
                    "doses_taken": sum(1 for s in slots if s["status"] == "taken"),
                },
                "medications_today": meds_today,
                "adherence_7d": ehr.adherence(db, _uid(), day, 7),
                "streak_days": ehr.logging_streak(db, _uid(), day),
                "latest_xray": ehr.serialize_xray(latest_xray) if latest_xray else None,
                "counts": {
                    "logs": db.query(DailyLog).filter_by(user_id=_uid()).count(),
                    "medications": db.query(PatientMedication)
                    .filter_by(user_id=_uid(), is_active=True)
                    .count(),
                    "documents": db.query(PatientDocument).filter_by(user_id=_uid()).count(),
                    "xrays": db.query(XrayStudy).filter_by(user_id=_uid()).count(),
                },
                "care": {
                    "doctors": [care.serialize_link(db, l, viewer="patient")["doctor"] for l in active_links],
                    "pending_invites": [
                        care.serialize_link(db, l, viewer="patient") for l in pending_links if l.requested_by == "doctor"
                    ],
                    "unread_messages": care.unread_messages(db, _uid(), "patient"),
                    "unread_notifications": notify.unread_count(db, _uid()),
                    "next_consult": care.serialize_consult(db, upcoming[0], viewer="patient") if upcoming else None,
                    "reports": len(panel.shared_reports(db, _uid())),
                },
                "email_verified": me.email_verified_at is not None,
            }
        )


@patient_bp.route("/patient/profile", methods=["GET"])
@patient_only
def get_profile():
    with get_db() as db:
        return api_response(
            {"profile": ehr.serialize_profile(ehr.get_or_create_profile(db, _uid()))}
        )


@patient_bp.route("/patient/profile", methods=["PUT"])
@patient_only
def put_profile():
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        profile = ehr.get_or_create_profile(db, _uid())
        ehr.update_profile(profile, data)
        db.flush()
        _audit(
            db,
            "ehr.profile.update",
            "patient_profile",
            profile.id,
            {"fields": sorted(data.keys())[:20]},
        )
        return api_response({"profile": ehr.serialize_profile(profile)})


# ---------------------------------------------------------------------------
# Daily logs
# ---------------------------------------------------------------------------


@patient_bp.route("/patient/logs", methods=["GET"])
@patient_only
def list_logs():
    try:
        days = max(1, min(int(request.args.get("days", 30)), 366))
    except ValueError:
        days = 30
    until = ehr.parse_day_param(request.args.get("date"))
    with get_db() as db:
        logs = ehr.list_logs(db, _uid(), days, until)
        return api_response(
            {"logs": [ehr.serialize_log(l) for l in logs], "days": days, "until": until.isoformat()}
        )


@patient_bp.route("/patient/logs", methods=["POST"])
@patient_only
def create_log():
    with get_db() as db:
        log = ehr.create_log(db, _uid(), request.get_json(silent=True) or {})
        _audit(db, "ehr.log.create", "daily_log", log.id)
        care.alert_on_vitals(db, _me(db), log)
        return api_response({"log": ehr.serialize_log(log), "alerts": care.vitals_alerts(log)}, 201)


@patient_bp.route("/patient/logs/<log_id>", methods=["DELETE"])
@patient_only
def delete_log(log_id):
    with get_db() as db:
        db.delete(_owned(db, DailyLog, log_id))
        _audit(db, "ehr.log.delete", "daily_log", log_id)
    return api_response({"deleted": True})


# ---------------------------------------------------------------------------
# Medications
# ---------------------------------------------------------------------------


@patient_bp.route("/patient/medications", methods=["GET"])
@patient_only
def list_medications():
    with get_db() as db:
        meds = (
            db.query(PatientMedication)
            .filter_by(user_id=_uid())
            .order_by(PatientMedication.is_active.desc(), PatientMedication.name)
            .all()
        )
        return api_response({"medications": [ehr.serialize_medication(m) for m in meds]})


@patient_bp.route("/patient/medications", methods=["POST"])
@patient_only
def create_medication():
    with get_db() as db:
        med = PatientMedication(user_id=_uid(), is_active=True)
        ehr.apply_medication(med, request.get_json(silent=True) or {}, creating=True)
        db.add(med)
        db.flush()
        _audit(db, "ehr.medication.create", "medication", med.id)
        return api_response({"medication": ehr.serialize_medication(med)}, 201)


@patient_bp.route("/patient/medications/<med_id>", methods=["PATCH"])
@patient_only
def update_medication(med_id):
    with get_db() as db:
        med = _owned(db, PatientMedication, med_id)
        ehr.apply_medication(med, request.get_json(silent=True) or {}, creating=False)
        db.flush()
        _audit(db, "ehr.medication.update", "medication", med.id)
        return api_response({"medication": ehr.serialize_medication(med)})


@patient_bp.route("/patient/medications/<med_id>", methods=["DELETE"])
@patient_only
def delete_medication(med_id):
    with get_db() as db:
        db.delete(_owned(db, PatientMedication, med_id))
        _audit(db, "ehr.medication.delete", "medication", med_id)
    return api_response({"deleted": True})


@patient_bp.route("/patient/medications/day", methods=["GET"])
@patient_only
def medication_day():
    day = ehr.parse_day_param(request.args.get("date"))
    with get_db() as db:
        return api_response(
            {
                "date": day.isoformat(),
                "items": ehr.medication_day(db, _uid(), day),
                "adherence_7d": ehr.adherence(db, _uid(), day, 7),
                "adherence_30d": ehr.adherence(db, _uid(), day, 30),
            }
        )


@patient_bp.route("/patient/medications/<med_id>/doses", methods=["POST"])
@patient_only
def record_dose(med_id):
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        med = _owned(db, PatientMedication, med_id)
        dose = ehr.record_dose(db, _uid(), med, data)
        _audit(
            db,
            "ehr.dose.record",
            "medication",
            med.id,
            {"slot": data.get("slot"), "status": data.get("status")},
        )
        return api_response({"status": dose.status if dose else None})


# ---------------------------------------------------------------------------
# Record locker
# ---------------------------------------------------------------------------


@patient_bp.route("/patient/documents", methods=["GET"])
@patient_only
def list_documents():
    with get_db() as db:
        docs = (
            db.query(PatientDocument)
            .filter_by(user_id=_uid())
            .order_by(PatientDocument.created_at.desc())
            .all()
        )
        return api_response({"documents": [ehr.serialize_document(d) for d in docs]})


@patient_bp.route("/patient/documents", methods=["POST"])
@patient_only
def upload_document():
    upload = request.files.get("file")
    blob = ehr.read_upload(upload, _max_bytes())
    sniffed = ehr.sniff_type(blob)
    if sniffed is None:
        raise ehr.EhrError(
            "Upload a PDF, JPG, PNG, WEBP or DICOM file.", 415, "UNSUPPORTED_MEDIA_TYPE"
        )
    category = request.form.get("category", "other")
    if category not in ehr.DOCUMENT_CATEGORIES:
        raise ehr.EhrError("Choose a category.")
    filename = ehr.safe_filename(upload.filename)
    title = (request.form.get("title") or "").strip()[:200] or filename.rsplit(".", 1)[0]

    store = _store()
    rel = store.save(_uid(), "documents", blob, sniffed[1])
    try:
        with get_db() as db:
            doc = PatientDocument(
                user_id=_uid(),
                title=title,
                category=category,
                record_date=ehr.parse_date(request.form.get("record_date"), "record_date"),
                provider=(request.form.get("provider") or "").strip()[:150] or None,
                notes=(request.form.get("notes") or "").strip()[:2000] or None,
                original_filename=filename,
                content_type=sniffed[0],
                size_bytes=len(blob),
                sha256=ehr.sha256(blob),
                storage_path=rel,
            )
            db.add(doc)
            db.flush()
            _audit(
                db,
                "ehr.document.upload",
                "document",
                doc.id,
                {"category": category, "bytes": len(blob)},
            )
            return api_response({"document": ehr.serialize_document(doc)}, 201)
    except Exception:
        store.delete(rel)
        raise


@patient_bp.route("/patient/documents/<doc_id>/file", methods=["GET"])
@patient_only
def download_document(doc_id):
    with get_db() as db:
        doc = _owned(db, PatientDocument, doc_id)
        path = _store().path(doc.storage_path)
        _audit(db, "ehr.document.download", "document", doc.id)
        name, ctype = doc.original_filename, doc.content_type
    inline = request.args.get("download") != "1" and ctype != "application/dicom"
    return _send(path, ctype, name, not inline)


@patient_bp.route("/patient/documents/<doc_id>", methods=["DELETE"])
@patient_only
def delete_document(doc_id):
    with get_db() as db:
        doc = _owned(db, PatientDocument, doc_id)
        rel = doc.storage_path
        db.delete(doc)
        _audit(db, "ehr.document.delete", "document", doc_id)
    _store().delete(rel)
    return api_response({"deleted": True})


# ---------------------------------------------------------------------------
# Chest X-rays
# ---------------------------------------------------------------------------


@patient_bp.route("/patient/xrays", methods=["GET"])
@patient_only
def list_xrays():
    with get_db() as db:
        studies = (
            db.query(XrayStudy)
            .filter_by(user_id=_uid())
            .order_by(XrayStudy.created_at.desc())
            .all()
        )
        reviewed = care.reviewed_targets(db, _uid())
        items = []
        for s in studies:
            item = ehr.serialize_xray(s)
            item["reviewed"] = s.id in reviewed
            items.append(item)
        return api_response({"xrays": items})


@patient_bp.route("/patient/xrays", methods=["POST"])
@patient_only
def upload_xray():
    from app.services.dicom_service import is_valid_chest_image

    upload = request.files.get("file")
    blob = ehr.read_upload(upload, _max_bytes())
    filename = ehr.safe_filename(upload.filename)
    sniffed = ehr.sniff_type(blob)
    ok, err = is_valid_chest_image(blob, filename)
    if sniffed is None or sniffed[0] == "application/pdf" or not ok:
        raise ehr.EhrError(
            err or "Upload a chest X-ray as DICOM (.dcm), JPG, PNG or WEBP.",
            415,
            "UNSUPPORTED_MEDIA_TYPE",
        )

    store = _store()
    rel = store.save(_uid(), "xray", blob, sniffed[1])
    with get_db() as db:
        study = XrayStudy(
            user_id=_uid(),
            title=(request.form.get("title") or "").strip()[:200] or None,
            taken_on=ehr.parse_date(request.form.get("taken_on"), "taken_on"),
            original_filename=filename,
            content_type=sniffed[0],
            size_bytes=len(blob),
            sha256=ehr.sha256(blob),
            storage_path=rel,
            status="processing",
        )
        db.add(study)
        db.flush()
        ehr.analyze_xray(study, blob, store)
        _audit(
            db,
            "ehr.xray.upload",
            "xray_study",
            study.id,
            {"status": study.status, "bytes": len(blob)},
        )
        care.alert_on_screening(db, _me(db), study)
        # Tells the patient assistant (chat service) once the row is committed; see app/services/events.py.
        events.publish_on_commit(
            db, _uid(), "xray.added", study_id=study.id, status=study.status, severity=study.severity
        )
        logger.info(
            "patient_xray_uploaded", study_id=study.id, status=study.status, severity=study.severity
        )
        return api_response({"xray": ehr.serialize_xray(study, detail=True)}, 201)


@patient_bp.route("/patient/xrays/<study_id>", methods=["GET"])
@patient_only
def get_xray(study_id):
    with get_db() as db:
        study = _owned(db, XrayStudy, study_id)
        out = ehr.serialize_xray(study, detail=True)
        out["reviews"] = [care.serialize_review(r) for r in care.reviews_for(db, "xray_study", study.id)]
        return api_response({"xray": out})


@patient_bp.route("/patient/xrays/<study_id>/image", methods=["GET"])
@patient_only
def xray_image(study_id):
    kind = request.args.get("kind", "preview")
    with get_db() as db:
        study = _owned(db, XrayStudy, study_id)
        rel = {
            "original": study.storage_path,
            "preview": study.preview_path,
            "heatmap": study.heatmap_path,
        }.get(kind)
        ctype = study.content_type if kind == "original" else "image/png"
        name = study.original_filename if kind == "original" else f"xray-{kind}.png"
    return _send(_store().path(rel), ctype, name, kind == "original")


@patient_bp.route("/patient/xrays/<study_id>", methods=["DELETE"])
@patient_only
def delete_xray(study_id):
    with get_db() as db:
        study = _owned(db, XrayStudy, study_id)
        rels = (study.storage_path, study.preview_path, study.heatmap_path)
        db.delete(study)
        _audit(db, "ehr.xray.delete", "xray_study", study_id)
        events.publish_on_commit(db, _uid(), "xray.deleted", study_id=study_id)
    _store().delete(*rels)
    return api_response({"deleted": True})


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


@patient_bp.route("/patient/export", methods=["GET"])
@patient_only
def export_record():
    with get_db() as db:
        payload = ehr.export_all(db, _uid())
        payload["care_team"] = [
            care.serialize_link(db, l, viewer="patient") for l in care.links_for(db, _uid(), "patient")
        ]
        payload["shared_reports"] = [
            panel.serialize_for_patient(db, s, detail=True) for s in panel.shared_reports(db, _uid())
        ]
        _audit(db, "ehr.export", "patient_record", _uid())
    response = current_app.response_class(
        json.dumps(payload, indent=2), mimetype="application/json"
    )
    response.headers["Content-Disposition"] = "attachment; filename=mipaas-health-record.json"
    response.headers["Cache-Control"] = "private, no-store"
    return response


# ---------------------------------------------------------------------------
# Care team
# ---------------------------------------------------------------------------


@patient_bp.route("/patient/doctors", methods=["GET"])
@patient_only
def doctors_directory():
    with get_db() as db:
        return api_response({"doctors": care.doctor_directory(db, request.args.get("q", ""))})


@patient_bp.route("/patient/care-team", methods=["GET"])
@patient_only
def care_team():
    status = request.args.get("status", "all")
    statuses = {"active": ("active",), "pending": ("pending",), "all": None}.get(status)
    with get_db() as db:
        links = care.links_for(db, _uid(), "patient", statuses=statuses)
        return api_response(
            {
                "links": [care.serialize_link(db, l, viewer="patient") for l in links],
                "email_verified": _me(db).email_verified_at is not None,
            }
        )


@patient_bp.route("/patient/care-team/invite", methods=["POST"])
@patient_only
def invite_doctor():
    if get_rate_limiter().hit("care_invite", _uid(), LIMITS["care_invite"]):
        return api_error("Too many invitations. Try again later.", 429, "RATE_LIMITED")
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        me = _me(db)
        accounts.require_verified_email(me)
        doctor = care.find_doctor(db, email=data.get("doctor_email"), code=data.get("doctor_code"))
        link = care.patient_invite(db, me, doctor, scopes=data.get("scopes"), message=data.get("message"))
        _audit(db, "care.invite", "care_link", link.id, {"by": "patient"})
        return api_response({"link": care.serialize_link(db, link, viewer="patient")}, 201)


@patient_bp.route("/patient/care-team/<link_id>/respond", methods=["POST"])
@patient_only
def respond_doctor(link_id):
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        link = care.get_link(db, link_id, _uid())
        care.respond(db, link, actor=_me(db), accept=bool(data.get("accept")), scopes=data.get("scopes"))
        _audit(db, "care.respond", "care_link", link.id, {"accept": bool(data.get("accept"))})
        return api_response({"link": care.serialize_link(db, link, viewer="patient")})


@patient_bp.route("/patient/care-team/<link_id>", methods=["PATCH"])
@patient_only
def update_scopes(link_id):
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        link = care.get_link(db, link_id, _uid())
        care.update_scopes(db, link, data.get("scopes"))
        _audit(db, "care.scopes", "care_link", link.id, {"scopes": care.scopes_of(link)})
        return api_response({"link": care.serialize_link(db, link, viewer="patient")})


@patient_bp.route("/patient/care-team/<link_id>", methods=["DELETE"])
@patient_only
def end_link(link_id):
    with get_db() as db:
        link = care.get_link(db, link_id, _uid())
        care.end_link(db, link, actor=_me(db))
        _audit(db, "care.end", "care_link", link.id)
        return api_response({"link": care.serialize_link(db, link, viewer="patient")})


# ---------------------------------------------------------------------------
# Consultations
# ---------------------------------------------------------------------------


@patient_bp.route("/patient/consults", methods=["GET"])
@patient_only
def list_consults():
    with get_db() as db:
        rows = care.list_consults(db, _uid(), "patient", status=request.args.get("status") or None)
        return api_response({"consults": [care.serialize_consult(db, c, viewer="patient") for c in rows]})


@patient_bp.route("/patient/consults", methods=["POST"])
@patient_only
def request_consult():
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        link = care.get_link(db, str(data.get("link_id") or ""), _uid())
        consult = care.request_consult(
            db, link, _me(db),
            reason=str(data.get("reason") or ""),
            mode=str(data.get("mode") or "video"),
            preferred_at=data.get("preferred_at"),
        )
        _audit(db, "consult.request", "consult", consult.id, {"mode": consult.mode})
        return api_response({"consult": care.serialize_consult(db, consult, viewer="patient")}, 201)


@patient_bp.route("/patient/consults/<consult_id>/cancel", methods=["POST"])
@patient_only
def cancel_consult(consult_id):
    with get_db() as db:
        consult = care.get_consult(db, consult_id, _uid())
        care.cancel_consult(db, consult, _me(db))
        _audit(db, "consult.cancel", "consult", consult.id)
        return api_response({"consult": care.serialize_consult(db, consult, viewer="patient")})


# ---------------------------------------------------------------------------
# Reports shared by doctors
# ---------------------------------------------------------------------------


@patient_bp.route("/patient/reports", methods=["GET"])
@patient_only
def list_reports():
    with get_db() as db:
        return api_response(
            {"reports": [panel.serialize_for_patient(db, s) for s in panel.shared_reports(db, _uid())]}
        )


@patient_bp.route("/patient/reports/<study_id>", methods=["GET"])
@patient_only
def get_report(study_id):
    with get_db() as db:
        study = panel.shared_report(db, _uid(), study_id)
        _audit(db, "ehr.report.view", "doctor_study", study.id)
        return api_response({"report": panel.serialize_for_patient(db, study, detail=True)})


@patient_bp.route("/patient/reports/<study_id>/image", methods=["GET"])
@patient_only
def report_image(study_id):
    kind = request.args.get("kind", "preview")
    if kind not in ("preview", "heatmap"):
        return api_error("kind must be preview or heatmap.", 400)
    with get_db() as db:
        study = panel.shared_report(db, _uid(), study_id)
        rel = study.preview_path if kind == "preview" else study.heatmap_path
    return _send(_doctor_store().path(rel), "image/png", f"report-{kind}.png", False)
