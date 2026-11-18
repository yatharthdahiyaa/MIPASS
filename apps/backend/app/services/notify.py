"""
In-app notifications and their e-mail copies.

``notify(db, user_id, kind, title, body, link)`` inserts a ``notifications`` row inside the
caller's transaction and, when the user's preferences allow it and their address is
verified, queues an e-mail through :mod:`app.services.mailer`.

Kinds (also the preference keys):

    care.invite          a doctor/patient asked to connect
    care.accepted        a care link became active
    care.message         new secure message
    care.review          a doctor reviewed something in the record
    consult.update       a consultation was requested / scheduled / declined / completed
    report.ready         a signed report was shared with the patient
    screening.result     an AI screening finished (HIGH / CRITICAL are flagged)
    vitals.alert         a self-logged reading is outside safe ranges
    account.security     sign-in from a new device, password / MFA changes, verification
    account.verification doctor licence verified / rejected
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models.iam import Notification, NotificationPreference, User
from app.services import mailer, messaging

logger = structlog.get_logger()

KINDS = (
    "care.invite",
    "care.accepted",
    "care.message",
    "care.review",
    "consult.update",
    "report.ready",
    "screening.result",
    "vitals.alert",
    "account.security",
    "account.verification",
)
# E-mail is on by default for everything except chat messages (those arrive often).
DEFAULT_EMAIL = {k: k != "care.message" for k in KINDS}
# Text messages are opt-in, except sign-in and password alerts once the person has verified a number.
DEFAULT_PHONE = {k: k == "account.security" for k in KINDS}

# SMS and WhatsApp are not clinical channels: messages say that something happened, never what it was.
PHONE_TEXT = {
    "care.invite": "A doctor has sent you a connection request.",
    "care.accepted": "Your care connection is now active.",
    "care.message": "You have a new secure message.",
    "care.review": "Your care team reviewed something in your record.",
    "consult.update": "There is an update on your consultation.",
    "report.ready": "A report has been shared with you.",
    "screening.result": "Your screening result is ready.",
    "vitals.alert": "A reading you logged needs your attention.",
    "account.security": "There was a security update on your account.",
    "account.verification": "There is an update on your account verification.",
}


def _utcnow() -> datetime:
    return datetime.now(UTC)


def preferences(db: Session, user_id: str) -> dict[str, dict[str, bool]]:
    row = db.query(NotificationPreference).filter_by(user_id=user_id).first()
    stored = json.loads(row.prefs_json) if row and row.prefs_json else {}
    return {
        k: {
            "email": bool(stored.get(k, {}).get("email", DEFAULT_EMAIL[k])),
            "phone": bool(stored.get(k, {}).get("phone", DEFAULT_PHONE[k])),
        }
        for k in KINDS
    }


def update_preferences(db: Session, user_id: str, patch: dict[str, Any]) -> dict:
    row = db.query(NotificationPreference).filter_by(user_id=user_id).first()
    if row is None:
        row = NotificationPreference(user_id=user_id, prefs_json="{}")
        db.add(row)
    current = preferences(db, user_id)
    for kind, value in (patch or {}).items():
        if kind in KINDS and isinstance(value, dict):
            for channel in ("email", "phone"):
                if channel in value:
                    current[kind][channel] = bool(value[channel])
    row.prefs_json = json.dumps(current)
    db.flush()
    return current


def serialize(n: Notification) -> dict:
    return {
        "id": n.id,
        "kind": n.kind,
        "severity": n.severity,
        "title": n.title,
        "body": n.body,
        "link": n.link,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


def notify(
    db: Session,
    user_id: str,
    kind: str,
    title: str,
    body: str | None = None,
    *,
    link: str | None = None,
    severity: str = "info",
    email: bool | None = None,
    email_cta: str | None = None,
) -> Notification:
    if kind not in KINDS:
        raise ValueError(f"unknown notification kind {kind!r}")
    row = Notification(
        user_id=user_id,
        kind=kind,
        severity=severity if severity in ("info", "warning", "critical") else "info",
        title=title[:200],
        body=body,
        link=link,
    )
    db.add(row)
    db.flush()

    wants_email = preferences(db, user_id)[kind]["email"] if email is None else email
    user = db.get(User, user_id)
    if wants_email and user is not None and user.email_verified_at is not None:
        cta = (email_cta or "Open MIPAAS", mailer.link(link or "/account"))
        mailer.send(
            db,
            to=user.email,
            subject=title,
            text=f"{title}\n\n{body or ''}\n\n{cta[1]}",
            html=mailer.html_wrap(title, [body or ""], cta),
            kind=kind,
            user_id=user_id,
        )
        row.emailed_at = _utcnow()

    if (
        user is not None
        and user.phone
        and user.phone_verified_at is not None
        and messaging.can_send_updates()
        and preferences(db, user_id)[kind]["phone"]
    ):
        messaging.send_update(
            db, user.phone, f"MIPAAS: {PHONE_TEXT[kind]} Open {mailer.link(link or '/account')}"
        )
    return row


def unread_count(db: Session, user_id: str) -> int:
    return (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == user_id, Notification.read_at.is_(None))
        .scalar()
        or 0
    )


def list_for(db: Session, user_id: str, *, unread_only: bool = False, limit: int = 50) -> list:
    q = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        q = q.filter(Notification.read_at.is_(None))
    return q.order_by(Notification.created_at.desc()).limit(max(1, min(limit, 200))).all()


def mark_read(db: Session, user_id: str, notification_id: str | None = None) -> int:
    q = db.query(Notification).filter(
        Notification.user_id == user_id, Notification.read_at.is_(None)
    )
    if notification_id:
        q = q.filter(Notification.id == notification_id)
    count = q.update({Notification.read_at: _utcnow()}, synchronize_session=False)
    return int(count or 0)
