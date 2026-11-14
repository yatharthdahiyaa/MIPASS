"""
Doctor workstation API, used by the web workstation (apps/frontend /doctor) and the desktop
app (apps/desktop).

Only verified clinicians (roles doctor, radiologist, admin) can call these routes, and each
doctor only sees their own studies and their own care-linked patients. Signing a report locks it.
Business rules live in ``app.services.doctor_panel`` and ``app.services.care``.

Studies
    GET    /doctor/analyzers               study types on this server and whether each has a model
    GET    /doctor/summary
    GET    /doctor/dashboard               summary + urgent queue + consults + inbox + patients
    GET    /doctor/studies?filter=all|draft|signed|urgent|pending|failed|shared
                                           &q=&modality=&sort=newest|oldest|severity|patient
                                           &page=&page_size=   (without page: first 500)
    POST   /doctor/studies                 multipart: file [+ analyzer, modality, patient fields,
                                           patient_link_id]; analysed automatically on upload
    POST   /doctor/studies/analyze         analyse every waiting draft whose model is now installed
    GET    /doctor/studies/<id>
    PATCH  /doctor/studies/<id>            patient fields, notes, impression, patient_link_id (drafts)
    POST   /doctor/studies/<id>/analyze    re-run the analysis (drafts only)
    POST   /doctor/studies/<id>/sign       finalise the report (requires reports:sign)
    GET    /doctor/studies/<id>/image?kind=preview|heatmap|original
    DELETE /doctor/studies/<id>            drafts only

Patients (care links)
    GET    /doctor/profile                 clinician profile incl. share code
    GET    /doctor/patients?status=active|pending|all
    POST   /doctor/patients/invite         {email, message?}
    POST   /doctor/patients/<link>/respond {accept: bool}
    DELETE /doctor/patients/<link>
    GET    /doctor/patients/<link>/record?days=30
    GET    /doctor/patients/<link>/xrays/<id>/image?kind=
    GET    /doctor/patients/<link>/documents/<id>/file
    POST   /doctor/patients/<link>/xrays/<id>/review   {impression, recommendation?, urgency}

Consultations
    GET    /doctor/consults?status=&upcoming=1
    POST   /doctor/consults/<id>/respond   {action: schedule|decline|complete, scheduled_at?, note?}
"""

import json
from functools import wraps

import structlog
from flask import Blueprint, current_app, g, request, send_file

from app.database.models.iam import AuditLog, User
from app.database.session import get_db
from app.middleware.auth_middleware import get_authenticated_user
from app.services import accounts, care, notify
from app.services import doctor_panel as panel
from app.services import patient_ehr as ehr
from app.services import study_analysis as sa
from app.services.rbac import Permission, Role, get_rbac_service
from app.services.security import LIMITS, get_rate_limiter
from app.utils.response import api_error, api_response

logger = structlog.get_logger()
doctor_bp = Blueprint("doctor_panel", __name__)

CLINICIAN_ROLES = {Role.DOCTOR, Role.RADIOLOGIST, Role.ADMIN}


def clinician_only(
    permission: str | None = None, denied: str = "You don't have permission to do that."
):
    """Require a verified clinician (and optionally an RBAC permission); map service errors."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_authenticated_user()
            if user is None:
                return api_error("Please sign in.", 401)
            if user.role not in CLINICIAN_ROLES:
                if user.role == Role.DOCTOR_PENDING:
                    return api_error(
                        "Your doctor account is still being verified.", 403, "VERIFICATION_PENDING"
                    )
                return api_error("This panel is for verified doctors only.", 403)
            if permission and not get_rbac_service().has_permission(user, permission):
                return api_error(denied, 403)
            try:
                return fn(*args, **kwargs)
            except (ehr.EhrError, sa.AnalysisError) as exc:
                return api_error(exc.message, exc.status, exc.code)
            except accounts.AccountError as exc:
                return api_error(exc.message, exc.status, exc.code)

        return wrapper

    return decorator


def _uid() -> str:
    return g.current_user.id


def _me(db) -> User:
    return db.get(User, _uid())


def _audit(db, action: str, resource_id: str | None = None, details: dict | None = None, resource_type: str = "doctor_study") -> None:
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
    return ehr.FileStore(current_app.config["DOCTOR_FILES_DIR"])


def _patient_store() -> ehr.FileStore:
    return ehr.FileStore(current_app.config["PATIENT_FILES_DIR"])


def _study_response(study, status: int = 200):
    return api_response({"study": panel.serialize(study, detail=True)}, status)


def _send(path, ctype, name, attachment):
    if path is None:
        return api_error("File not available.", 404)
    response = send_file(path, mimetype=ctype, as_attachment=attachment, download_name=name, max_age=0)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


# --------------------------------------------------------------------------- catalogue


@doctor_bp.route("/doctor/analyzers", methods=["GET"])
@clinician_only()
def analyzers():
    return api_response({"analyzers": [a.describe() for a in sa.list_analyzers()]})


@doctor_bp.route("/doctor/summary", methods=["GET"])
@clinician_only()
def summary():
    with get_db() as db:
        return api_response(panel.summary(db, _uid()))


@doctor_bp.route("/doctor/dashboard", methods=["GET"])
@clinician_only()
def dashboard():
    with get_db() as db:
        urgent, _ = panel.list_studies(db, _uid(), flt="urgent", sort="newest", page=1, page_size=8)
        recent, _ = panel.list_studies(db, _uid(), flt="all", sort="newest", page=1, page_size=8)
        links = care.links_for(db, _uid(), "doctor", statuses=("active",))
        pending = care.links_for(db, _uid(), "doctor", statuses=("pending",))
        return api_response(
            {
                "summary": panel.summary(db, _uid()),
                "urgent": [panel.serialize(s) for s in urgent if s.report_status == "draft"],
                "recent": [panel.serialize(s) for s in recent],
                "patients": {
                    "active": len(links),
                    "pending_invites": [
                        care.serialize_link(db, l, viewer="doctor") for l in pending if l.requested_by == "patient"
                    ],
                },
                "consults": {
                    "requested": [
                        care.serialize_consult(db, c, viewer="doctor")
                        for c in care.list_consults(db, _uid(), "doctor", status="requested")[:8]
                    ],
                    "upcoming": [
                        care.serialize_consult(db, c, viewer="doctor")
                        for c in care.list_consults(db, _uid(), "doctor", upcoming=True)[:8]
                    ],
                },
                "inbox": {
                    "unread_messages": care.unread_messages(db, _uid(), "doctor"),
                    "unread_notifications": notify.unread_count(db, _uid()),
                },
                "analyzers": [a.describe() for a in sa.list_analyzers()],
            }
        )


@doctor_bp.route("/doctor/profile", methods=["GET"])
@clinician_only()
def profile():
    with get_db() as db:
        me = _me(db)
        prof = accounts.clinician_profile(db, me.id)
        if prof is not None and prof.verified_at is not None:
            accounts.ensure_share_code(db, prof)
        return api_response({"user": accounts.serialize_user(me, db)})


# --------------------------------------------------------------------------- studies


@doctor_bp.route("/doctor/studies", methods=["GET"])
@clinician_only()
def list_studies():
    page = request.args.get("page", type=int)
    page_size = request.args.get("page_size", default=50, type=int)
    with get_db() as db:
        studies, total = panel.list_studies(
            db,
            _uid(),
            flt=request.args.get("filter", "all"),
            q=request.args.get("q", ""),
            modality=request.args.get("modality") or None,
            patient_user_id=request.args.get("patient") or None,
            sort=request.args.get("sort", "newest"),
            page=page,
            page_size=page_size or 50,
        )
        return api_response(
            {
                "studies": [panel.serialize(s) for s in studies],
                "total": total,
                "page": page or 1,
                "page_size": min(page_size or 50, panel.MAX_PAGE_SIZE) if page else len(studies),
            }
        )


@doctor_bp.route("/doctor/studies", methods=["POST"])
@clinician_only(Permission.JOBS_CREATE, "You don't have permission to upload studies.")
def upload_study():
    upload = request.files.get("file")
    blob = ehr.read_upload(upload, int(current_app.config["PATIENT_MAX_UPLOAD_BYTES"]))
    reserved = {"file", "analyzer", "modality", "patient_link_id"}
    with get_db() as db:
        study = panel.create_study(
            db,
            _uid(),
            blob=blob,
            filename=ehr.safe_filename(upload.filename),
            fields={k: v for k, v in request.form.items() if k not in reserved},
            store=_store(),
            analyzer_id=request.form.get("analyzer") or None,
            modality=request.form.get("modality") or None,
        )
        if request.form.get("patient_link_id"):
            panel.link_patient(db, study, _uid(), request.form.get("patient_link_id"))
        _audit(
            db,
            "doctor.study.upload",
            study.id,
            {"analyzer": study.analyzer_id, "status": study.status, "severity": study.severity},
        )
        logger.info(
            "doctor_study_uploaded",
            study_id=study.id,
            analyzer=study.analyzer_id,
            status=study.status,
            severity=study.severity,
        )
        return _study_response(study, 201)


@doctor_bp.route("/doctor/studies/analyze", methods=["POST"])
@clinician_only(Permission.JOBS_CREATE, "You don't have permission to run analyses.")
def analyze_waiting():
    with get_db() as db:
        out = panel.analyze_waiting(db, _uid(), _store())
        if out["attempted"]:
            _audit(db, "doctor.study.analyze_waiting", None, out["results"])
        return api_response(out)


@doctor_bp.route("/doctor/studies/<study_id>", methods=["GET"])
@clinician_only()
def get_study(study_id):
    with get_db() as db:
        study = panel.get_owned(db, _uid(), study_id)
        _audit(db, "doctor.study.view", study.id)
        out = panel.serialize(study, detail=True)
        if study.patient_user_id:
            link = care.active_link_between(db, study.patient_user_id, _uid())
            out["patient_link"] = care.serialize_link(db, link, viewer="doctor") if link else None
        return api_response({"study": out})


@doctor_bp.route("/doctor/studies/<study_id>", methods=["PATCH"])
@clinician_only()
def update_study(study_id):
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        study = panel.update_study(panel.get_owned(db, _uid(), study_id), data)
        if "patient_link_id" in data:
            panel.link_patient(db, study, _uid(), data.get("patient_link_id") or None)
        db.flush()
        _audit(db, "doctor.study.update", study.id, {"fields": sorted(data.keys())[:20]})
        return _study_response(study)


@doctor_bp.route("/doctor/studies/<study_id>/analyze", methods=["POST"])
@clinician_only(Permission.JOBS_CREATE, "You don't have permission to run analyses.")
def analyze_study(study_id):
    with get_db() as db:
        study = panel.analyze(db, panel.get_owned(db, _uid(), study_id), _store())
        _audit(db, "doctor.study.analyze", study.id, {"status": study.status})
        return _study_response(study)


@doctor_bp.route("/doctor/studies/<study_id>/sign", methods=["POST"])
@clinician_only(Permission.REPORTS_SIGN, "You don't have permission to sign reports.")
def sign_study(study_id):
    with get_db() as db:
        study = panel.sign_study(db, panel.get_owned(db, _uid(), study_id), _me(db))
        db.flush()
        _audit(db, "doctor.report.sign", study.id, {"severity": study.severity, "shared": bool(study.patient_user_id)})
        return _study_response(study)


@doctor_bp.route("/doctor/studies/<study_id>/image", methods=["GET"])
@clinician_only()
def study_image(study_id):
    with get_db() as db:
        rel, ctype, name, attachment = panel.image_ref(
            panel.get_owned(db, _uid(), study_id), request.args.get("kind", "preview")
        )
    return _send(_store().path(rel), ctype, name, attachment)


@doctor_bp.route("/doctor/studies/<study_id>", methods=["DELETE"])
@clinician_only()
def delete_study(study_id):
    with get_db() as db:
        rels = panel.delete_study(db, panel.get_owned(db, _uid(), study_id))
        _audit(db, "doctor.study.delete", study_id)
    _store().delete(*rels)
    return api_response({"deleted": True})


# --------------------------------------------------------------------------- patients


@doctor_bp.route("/doctor/patients", methods=["GET"])
@clinician_only()
def list_patients():
    status = request.args.get("status", "active")
    statuses = {"active": ("active",), "pending": ("pending",), "all": None, "ended": ("declined", "revoked")}.get(status, ("active",))
    with get_db() as db:
        links = care.links_for(db, _uid(), "doctor", statuses=statuses)
        items = []
        for link in links:
            item = care.serialize_link(db, link, viewer="doctor")
            if link.status == "active":
                item["unread_messages"] = care.unread_for_link(db, link, _uid())
            items.append(item)
        return api_response({"patients": items})


@doctor_bp.route("/doctor/patients/invite", methods=["POST"])
@clinician_only()
def invite_patient():
    if get_rate_limiter().hit("care_invite", _uid(), LIMITS["care_invite"]):
        return api_error("Too many invitations. Try again later.", 429, "RATE_LIMITED")
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        me = _me(db)
        accounts.require_verified_email(me)
        link = care.doctor_invite(db, me, str(data.get("email") or ""), message=data.get("message"))
        _audit(db, "care.invite", link.id, {"by": "doctor"}, resource_type="care_link")
        return api_response({"link": care.serialize_link(db, link, viewer="doctor")}, 201)


@doctor_bp.route("/doctor/patients/<link_id>/respond", methods=["POST"])
@clinician_only()
def respond_patient(link_id):
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        link = care.get_link(db, link_id, _uid())
        care.respond(db, link, actor=_me(db), accept=bool(data.get("accept")))
        _audit(db, "care.respond", link.id, {"accept": bool(data.get("accept"))}, resource_type="care_link")
        return api_response({"link": care.serialize_link(db, link, viewer="doctor")})


@doctor_bp.route("/doctor/patients/<link_id>", methods=["DELETE"])
@clinician_only()
def end_patient_link(link_id):
    with get_db() as db:
        link = care.get_link(db, link_id, _uid())
        care.end_link(db, link, actor=_me(db))
        _audit(db, "care.end", link.id, resource_type="care_link")
        return api_response({"link": care.serialize_link(db, link, viewer="doctor")})


@doctor_bp.route("/doctor/patients/<link_id>/record", methods=["GET"])
@clinician_only(Permission.PHI_READ, "You don't have permission to read patient records.")
def patient_record(link_id):
    days = request.args.get("days", default=30, type=int) or 30
    with get_db() as db:
        link = care.get_link(db, link_id, _uid())
        record = care.shared_record(db, link, days=max(7, min(days, 366)))
        _audit(db, "care.record.view", link.id, {"scopes": record["scopes"]}, resource_type="care_link")
        return api_response(record)


@doctor_bp.route("/doctor/patients/<link_id>/xrays/<xray_id>/image", methods=["GET"])
@clinician_only(Permission.PHI_READ, "You don't have permission to read patient records.")
def patient_xray_image(link_id, xray_id):
    kind = request.args.get("kind", "preview")
    with get_db() as db:
        study = care.patient_xray(db, care.get_link(db, link_id, _uid()), xray_id)
        rel = {"original": study.storage_path, "preview": study.preview_path, "heatmap": study.heatmap_path}.get(kind)
        ctype = study.content_type if kind == "original" else "image/png"
        name = study.original_filename if kind == "original" else f"xray-{kind}.png"
    return _send(_patient_store().path(rel), ctype, name, kind == "original")


@doctor_bp.route("/doctor/patients/<link_id>/documents/<doc_id>/file", methods=["GET"])
@clinician_only(Permission.PHI_READ, "You don't have permission to read patient records.")
def patient_document_file(link_id, doc_id):
    with get_db() as db:
        doc = care.patient_document(db, care.get_link(db, link_id, _uid()), doc_id)
        _audit(db, "care.document.view", doc.id, resource_type="document")
        path, ctype, name = _patient_store().path(doc.storage_path), doc.content_type, doc.original_filename
    inline = request.args.get("download") != "1" and ctype != "application/dicom"
    return _send(path, ctype, name, not inline)


@doctor_bp.route("/doctor/patients/<link_id>/xrays/<xray_id>/review", methods=["POST"])
@clinician_only(Permission.REPORTS_SIGN, "You don't have permission to write reviews.")
def review_xray(link_id, xray_id):
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        link = care.get_link(db, link_id, _uid())
        study = care.patient_xray(db, link, xray_id)
        review = care.create_review(
            db,
            link,
            _me(db),
            study,
            impression=str(data.get("impression") or ""),
            recommendation=data.get("recommendation"),
            urgency=str(data.get("urgency") or "routine"),
        )
        _audit(db, "care.review", review.id, {"xray": xray_id, "urgency": review.urgency}, resource_type="review")
        return api_response({"review": care.serialize_review(review)}, 201)


# --------------------------------------------------------------------------- consultations


@doctor_bp.route("/doctor/consults", methods=["GET"])
@clinician_only()
def list_consults():
    with get_db() as db:
        rows = care.list_consults(
            db, _uid(), "doctor",
            status=request.args.get("status") or None,
            upcoming=request.args.get("upcoming") in ("1", "true"),
        )
        return api_response({"consults": [care.serialize_consult(db, c, viewer="doctor") for c in rows]})


@doctor_bp.route("/doctor/consults/<consult_id>/respond", methods=["POST"])
@clinician_only()
def respond_consult(consult_id):
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        consult = care.get_consult(db, consult_id, _uid())
        care.respond_consult(
            db, consult, _me(db),
            action=str(data.get("action") or ""),
            scheduled_at=data.get("scheduled_at"),
            note=data.get("note"),
        )
        _audit(db, "consult.respond", consult.id, {"action": data.get("action")}, resource_type="consult")
        return api_response({"consult": care.serialize_consult(db, consult, viewer="doctor")})
