"""
Administration API (role ``admin``; permissions ``users:manage`` / ``audit:read``).

    GET   /admin/overview                      counts for the dashboard
    GET   /admin/users?q=&role=&page=&page_size=
    PATCH /admin/users/<id>                    {role?, is_active?}
    GET   /admin/doctors/pending               clinicians awaiting licence verification
    POST  /admin/doctors/<id>/verify           {note?}
    POST  /admin/doctors/<id>/reject           {reason}
    GET   /admin/audit?action=&user=&status=&page=&page_size=
    GET   /admin/outbox?status=&page=          e-mails the platform produced (the dev inbox)
    GET   /admin/agents?days=30                per AI agent: runs, failures, model use, withheld text, reviews
"""

import json
from datetime import UTC, datetime, timedelta

import structlog
from flask import Blueprint, g, request
from sqlalchemy import func, or_

from app.database.models.care import CareLink, ConsultRequest
from app.database.models.doctor_panel import DoctorStudy
from app.database.models.iam import AuditLog, EmailOutbox, User
from app.database.models.patient_ehr import ClinicianProfile, XrayStudy
from app.database.session import get_db
from app.middleware.auth_middleware import require_permission
from app.services import accounts, mailer
from app.services.rbac import Permission, Role
from app.utils.response import api_error, api_response

logger = structlog.get_logger()
admin_bp = Blueprint("admin", __name__)

ASSIGNABLE_ROLES = {r.value for r in Role}


def _page() -> tuple[int, int]:
    try:
        page = max(1, int(request.args.get("page", 1)))
        size = max(1, min(int(request.args.get("page_size", 25)), 100))
    except ValueError:
        page, size = 1, 25
    return page, size


def _ctx() -> accounts.RequestContext:
    return accounts.RequestContext(ip=request.remote_addr, user_agent=request.headers.get("User-Agent"))


def _admin_user(db) -> User:
    return db.get(User, g.current_user.id)


def _user_row(db, user: User) -> dict:
    out = accounts.serialize_user(user, db)
    out["is_active"] = bool(user.is_active)
    return out


@admin_bp.route("/admin/overview", methods=["GET"])
@require_permission(Permission.USERS_MANAGE)
def overview():
    now = datetime.now(UTC)
    with get_db() as db:
        by_role = dict(db.query(User.role, func.count(User.id)).group_by(User.role).all())
        week = now - timedelta(days=7)
        return api_response(
            {
                "users": {
                    "total": sum(by_role.values()),
                    "by_role": by_role,
                    "new_7d": db.query(func.count(User.id)).filter(User.created_at >= week).scalar() or 0,
                    "unverified_email": db.query(func.count(User.id)).filter(User.email_verified_at.is_(None)).scalar() or 0,
                    "mfa_enabled": db.query(func.count(User.id)).filter(User.is_mfa_enabled.is_(True)).scalar() or 0,
                },
                "doctors": {
                    "pending": by_role.get(Role.DOCTOR_PENDING.value, 0),
                    "verified": db.query(func.count(ClinicianProfile.id)).filter(ClinicianProfile.verified_at.isnot(None)).scalar() or 0,
                },
                "care": {
                    "links_active": db.query(func.count(CareLink.id)).filter(CareLink.status == "active").scalar() or 0,
                    "links_pending": db.query(func.count(CareLink.id)).filter(CareLink.status == "pending").scalar() or 0,
                    "consults_open": db.query(func.count(ConsultRequest.id)).filter(ConsultRequest.status.in_(("requested", "scheduled"))).scalar() or 0,
                },
                "imaging": {
                    "patient_xrays": db.query(func.count(XrayStudy.id)).scalar() or 0,
                    "patient_xrays_7d": db.query(func.count(XrayStudy.id)).filter(XrayStudy.created_at >= week).scalar() or 0,
                    "doctor_studies": db.query(func.count(DoctorStudy.id)).scalar() or 0,
                    "signed_reports": db.query(func.count(DoctorStudy.id)).filter(DoctorStudy.report_status == "signed").scalar() or 0,
                },
                "audit": {
                    "events_24h": db.query(func.count(AuditLog.id)).filter(AuditLog.created_at >= now - timedelta(hours=24)).scalar() or 0,
                    "denied_24h": db.query(func.count(AuditLog.id)).filter(AuditLog.created_at >= now - timedelta(hours=24), AuditLog.status != "success").scalar() or 0,
                },
                "mail": {
                    "failed": db.query(func.count(EmailOutbox.id)).filter(EmailOutbox.status == "failed").scalar() or 0,
                    "queued": db.query(func.count(EmailOutbox.id)).filter(EmailOutbox.status == "queued").scalar() or 0,
                },
            }
        )


@admin_bp.route("/admin/users", methods=["GET"])
@require_permission(Permission.USERS_MANAGE)
def list_users():
    page, size = _page()
    q = (request.args.get("q") or "").strip().lower()[:100]
    role = (request.args.get("role") or "").strip()
    with get_db() as db:
        query = db.query(User)
        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    func.lower(User.email).like(like),
                    func.lower(User.username).like(like),
                    func.lower(func.coalesce(User.first_name, "")).like(like),
                    func.lower(func.coalesce(User.last_name, "")).like(like),
                    func.lower(func.coalesce(User.organization, "")).like(like),
                )
            )
        if role in ASSIGNABLE_ROLES:
            query = query.filter(User.role == role)
        total = query.count()
        rows = query.order_by(User.created_at.desc()).offset((page - 1) * size).limit(size).all()
        return api_response(
            {"users": [_user_row(db, u) for u in rows], "total": total, "page": page, "page_size": size}
        )


@admin_bp.route("/admin/users/<user_id>", methods=["PATCH"])
@require_permission(Permission.USERS_MANAGE)
def patch_user(user_id):
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        user = db.get(User, user_id)
        if user is None:
            return api_error("User not found.", 404)
        actor = _admin_user(db)
        changes = {}
        if "role" in data:
            role = str(data.get("role") or "")
            if role not in ASSIGNABLE_ROLES:
                return api_error("Unknown role.", 422)
            if user.id == actor.id and role != Role.ADMIN.value:
                return api_error("You can't remove your own administrator role.", 409)
            if user.role != role:
                changes["role"] = [user.role, role]
                user.role = role
                accounts.revoke_all_sessions(db, user)
        if "is_active" in data:
            active = bool(data.get("is_active"))
            if user.id == actor.id and not active:
                return api_error("You can't deactivate your own account.", 409)
            if user.is_active != active:
                changes["is_active"] = [user.is_active, active]
                user.is_active = active
                if not active:
                    accounts.revoke_all_sessions(db, user)
        if "email_verified" in data and data.get("email_verified") and user.email_verified_at is None:
            user.email_verified_at = datetime.now(UTC)
            changes["email_verified"] = [False, True]
        if changes:
            accounts.record_audit(
                db, "admin.user.update", _ctx(), user=actor, resource_type="user",
                resource_id=user.id, details_json=json.dumps(changes),
            )
        return api_response({"user": _user_row(db, user)})


@admin_bp.route("/admin/doctors/pending", methods=["GET"])
@require_permission(Permission.USERS_MANAGE)
def doctors_pending():
    with get_db() as db:
        rows = accounts.pending_doctors(db)
        return api_response(
            {
                "doctors": [
                    {**_user_row(db, u), "clinician": accounts.serialize_clinician(p)} for u, p in rows
                ]
            }
        )


@admin_bp.route("/admin/doctors/<user_id>/verify", methods=["POST"])
@require_permission(Permission.USERS_MANAGE)
def doctor_verify(user_id):
    data = request.get_json(silent=True) or {}
    try:
        with get_db() as db:
            user = db.get(User, user_id)
            if user is None:
                return api_error("User not found.", 404)
            actor = _admin_user(db)
            accounts.verify_doctor(db, user, by=actor.email, note=(data.get("note") or "").strip()[:500] or None)
            accounts.record_audit(
                db, "admin.doctor.verify", _ctx(), user=actor, resource_type="user", resource_id=user.id
            )
            return api_response({"user": _user_row(db, user)})
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)


@admin_bp.route("/admin/doctors/<user_id>/reject", methods=["POST"])
@require_permission(Permission.USERS_MANAGE)
def doctor_reject(user_id):
    data = request.get_json(silent=True) or {}
    try:
        with get_db() as db:
            user = db.get(User, user_id)
            if user is None:
                return api_error("User not found.", 404)
            actor = _admin_user(db)
            accounts.reject_doctor(db, user, by=actor.email, reason=data.get("reason") or "")
            accounts.record_audit(
                db, "admin.doctor.reject", _ctx(), user=actor, resource_type="user", resource_id=user.id,
                details_json=json.dumps({"reason": data.get("reason")}),
            )
            return api_response({"user": _user_row(db, user)})
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)


@admin_bp.route("/admin/audit", methods=["GET"])
@require_permission(Permission.AUDIT_READ)
def audit():
    page, size = _page()
    action = (request.args.get("action") or "").strip()[:100]
    who = (request.args.get("user") or "").strip().lower()[:100]
    status = (request.args.get("status") or "").strip()[:50]
    with get_db() as db:
        query = db.query(AuditLog)
        if action:
            query = query.filter(AuditLog.action.like(f"{action}%"))
        if who:
            query = query.filter(func.lower(func.coalesce(AuditLog.username, "")).like(f"%{who}%"))
        if status:
            query = query.filter(AuditLog.status == status)
        total = query.count()
        rows = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * size).limit(size).all()
        return api_response(
            {
                "events": [
                    {
                        "id": r.id,
                        "timestamp": r.created_at.isoformat() if r.created_at else None,
                        "user_id": r.user_id,
                        "username": r.username,
                        "action": r.action,
                        "resource_type": r.resource_type,
                        "resource_id": r.resource_id,
                        "status": r.status,
                        "ip_address": r.ip_address,
                        "user_agent": r.user_agent,
                        "details": json.loads(r.details_json) if r.details_json else None,
                    }
                    for r in rows
                ],
                "total": total,
                "page": page,
                "page_size": size,
            }
        )


@admin_bp.route("/admin/agents", methods=["GET"])
@require_permission(Permission.USERS_MANAGE)
def agent_stats():
    from app.services import agents

    try:
        days = max(1, min(int(request.args.get("days", 30)), 365))
    except ValueError:
        days = 30
    with get_db() as db:
        return api_response(
            {
                "days": days,
                "agents": agents.stats(db, days),
                "service_configured": agents.agents_url() is not None,
                "consented_patients": db.query(func.count(User.id)).filter(User.ai_consent_at.isnot(None)).scalar() or 0,
            }
        )


@admin_bp.route("/admin/outbox", methods=["GET"])
@require_permission(Permission.USERS_MANAGE)
def outbox():
    page, size = _page()
    status = (request.args.get("status") or "").strip()[:20]
    # Bodies contain live verification and password-reset links for other people's accounts.
    # They are readable here only in the dev-inbox modes; with real SMTP delivery an
    # administrator sees who was mailed and whether it worked, not the content.
    show_bodies = mailer.settings().backend != "smtp"
    with get_db() as db:
        query = db.query(EmailOutbox)
        if status:
            query = query.filter(EmailOutbox.status == status)
        total = query.count()
        rows = query.order_by(EmailOutbox.created_at.desc()).offset((page - 1) * size).limit(size).all()
        return api_response(
            {
                "emails": [
                    {
                        "id": r.id,
                        "to": r.to_address,
                        "subject": r.subject,
                        "kind": r.kind,
                        "status": r.status,
                        "error": r.error,
                        "text": r.text_body if show_bodies else None,
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                        "sent_at": r.sent_at.isoformat() if r.sent_at else None,
                    }
                    for r in rows
                ],
                "total": total,
                "page": page,
                "page_size": size,
                "bodies_visible": show_bodies,
            }
        )
