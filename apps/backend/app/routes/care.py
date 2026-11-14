"""
Routes shared by patients and doctors: notifications and secure messaging inside a care link.

    GET  /notifications?unread=1&limit=50
    GET  /notifications/badge                 {notifications: n, messages: n}  (cheap poll)
    POST /notifications/<id>/read
    POST /notifications/read-all
    GET  /notifications/preferences           PUT /notifications/preferences

    GET  /care/threads                        active links with last message + unread count
    GET  /care/<link_id>/messages?after=<id>
    POST /care/<link_id>/messages             {body, ref_type?, ref_id?}
    POST /care/<link_id>/messages/read
"""

from functools import wraps

import structlog
from flask import Blueprint, g, request

from app.database.models.iam import User
from app.database.session import get_db
from app.middleware.auth_middleware import get_authenticated_user
from app.services import care, notify
from app.services.rbac import Role
from app.services.security import LIMITS, get_rate_limiter
from app.utils.response import api_error, api_response

logger = structlog.get_logger()
care_bp = Blueprint("care", __name__)


def signed_in(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_authenticated_user()
        if user is None:
            return api_error("Please sign in.", 401)
        try:
            return fn(*args, **kwargs)
        except care.CareError as exc:
            return api_error(exc.message, exc.status, exc.code)

    return wrapper


def _uid() -> str:
    return g.current_user.id


def _role() -> str:
    return "patient" if g.current_user.role == Role.PATIENT else "doctor"


# --------------------------------------------------------------------------- notifications


@care_bp.route("/notifications", methods=["GET"])
@signed_in
def list_notifications():
    unread = request.args.get("unread") in ("1", "true")
    try:
        limit = int(request.args.get("limit", 50))
    except ValueError:
        limit = 50
    with get_db() as db:
        rows = notify.list_for(db, _uid(), unread_only=unread, limit=limit)
        return api_response(
            {
                "notifications": [notify.serialize(n) for n in rows],
                "unread": notify.unread_count(db, _uid()),
            }
        )


@care_bp.route("/notifications/badge", methods=["GET"])
@signed_in
def badge():
    with get_db() as db:
        return api_response(
            {
                "notifications": notify.unread_count(db, _uid()),
                "messages": care.unread_messages(db, _uid(), _role()),
            }
        )


@care_bp.route("/notifications/<notification_id>/read", methods=["POST"])
@signed_in
def read_notification(notification_id):
    with get_db() as db:
        count = notify.mark_read(db, _uid(), notification_id)
        return api_response({"read": count})


@care_bp.route("/notifications/read-all", methods=["POST"])
@signed_in
def read_all():
    with get_db() as db:
        return api_response({"read": notify.mark_read(db, _uid())})


@care_bp.route("/notifications/preferences", methods=["GET"])
@signed_in
def get_preferences():
    with get_db() as db:
        return api_response({"preferences": notify.preferences(db, _uid()), "kinds": list(notify.KINDS)})


@care_bp.route("/notifications/preferences", methods=["PUT"])
@signed_in
def put_preferences():
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        prefs = notify.update_preferences(db, _uid(), data.get("preferences") or data)
        return api_response({"preferences": prefs})


# --------------------------------------------------------------------------- messaging


@care_bp.route("/care/threads", methods=["GET"])
@signed_in
def threads():
    with get_db() as db:
        return api_response({"threads": care.threads_for(db, _uid(), _role())})


@care_bp.route("/care/<link_id>/messages", methods=["GET"])
@signed_in
def list_messages(link_id):
    with get_db() as db:
        link = care.get_link(db, link_id, _uid())
        rows = care.list_messages(db, link, after_id=request.args.get("after") or None)
        return api_response(
            {
                "link": care.serialize_link(db, link, viewer=_role()),
                "messages": [care.serialize_message(m, _uid()) for m in rows],
            }
        )


@care_bp.route("/care/<link_id>/messages", methods=["POST"])
@signed_in
def post_message(link_id):
    if get_rate_limiter().hit("message", _uid(), LIMITS["message"]):
        return api_error("You're sending messages too quickly.", 429, "RATE_LIMITED")
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        link = care.get_link(db, link_id, _uid())
        sender = db.get(User, _uid())
        msg = care.post_message(
            db,
            link,
            sender,
            str(data.get("body") or ""),
            ref_type=data.get("ref_type") or None,
            ref_id=str(data.get("ref_id") or "")[:64] or None,
        )
        return api_response({"message": care.serialize_message(msg, _uid())}, 201)


@care_bp.route("/care/<link_id>/messages/read", methods=["POST"])
@signed_in
def read_thread(link_id):
    with get_db() as db:
        link = care.get_link(db, link_id, _uid())
        return api_response({"read": care.mark_thread_read(db, link, _uid())})
