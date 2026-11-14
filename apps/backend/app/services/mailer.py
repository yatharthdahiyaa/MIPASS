"""
Outgoing e-mail.

Every message is written to the ``email_outbox`` table first (an audit trail and the
development inbox), then delivered by the configured backend:

* ``MAIL_BACKEND=outbox`` (default)  keep it in the table only; the admin panel shows it.
* ``MAIL_BACKEND=smtp``              deliver through ``SMTP_HOST`` (STARTTLS unless SMTP_TLS=0).
* ``MAIL_BACKEND=console``           outbox + print the text body to the server log.

Delivery runs on a small background pool so requests never wait on an SMTP server.
"""

from __future__ import annotations

import os
import smtplib
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from email.message import EmailMessage

import structlog

logger = structlog.get_logger()

_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="mail")
_pool_lock = threading.Lock()


@dataclass(frozen=True)
class MailSettings:
    backend: str
    host: str | None
    port: int
    user: str | None
    password: str | None
    tls: bool
    sender: str
    app_name: str
    base_url: str

    @classmethod
    def from_env(cls) -> MailSettings:
        return cls(
            backend=(os.getenv("MAIL_BACKEND") or "outbox").strip().lower(),
            host=os.getenv("SMTP_HOST"),
            port=int(os.getenv("SMTP_PORT", "587")),
            user=os.getenv("SMTP_USER"),
            password=os.getenv("SMTP_PASSWORD"),
            tls=os.getenv("SMTP_TLS", "1") not in ("0", "false", "no"),
            sender=os.getenv("MAIL_FROM", "MIPAAS <no-reply@mipaas.local>"),
            app_name=os.getenv("APP_NAME", "MIPAAS"),
            base_url=(os.getenv("APP_BASE_URL") or "http://localhost:3000").rstrip("/"),
        )


def settings() -> MailSettings:
    return MailSettings.from_env()


def link(path: str) -> str:
    """Absolute URL into the web app for e-mails."""
    return f"{settings().base_url}{path}"


def _smtp_send(cfg: MailSettings, to: str, subject: str, text: str, html: str | None) -> None:
    msg = EmailMessage()
    msg["From"] = cfg.sender
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    with smtplib.SMTP(cfg.host, cfg.port, timeout=20) as smtp:
        if cfg.tls:
            smtp.starttls()
        if cfg.user:
            smtp.login(cfg.user, cfg.password or "")
        smtp.send_message(msg)


def _deliver(outbox_id: str) -> None:
    """Background: deliver one outbox row and record the outcome."""
    from app.database.models.iam import EmailOutbox
    from app.database.session import get_db

    cfg = settings()
    with get_db() as db:
        row = db.get(EmailOutbox, outbox_id)
        if row is None:
            return
        try:
            if cfg.backend == "smtp":
                if not cfg.host:
                    raise RuntimeError("SMTP_HOST is not configured")
                _smtp_send(cfg, row.to_address, row.subject, row.text_body, row.html_body)
                row.status, row.sent_at = "sent", datetime.now(UTC)
            else:
                if cfg.backend == "console":
                    logger.info(
                        "mail_console", to=row.to_address, subject=row.subject, body=row.text_body
                    )
                row.status, row.sent_at = "outbox", datetime.now(UTC)
            row.error = None
        except Exception as exc:  # delivery problems must never break the request that queued it
            row.status, row.error = "failed", str(exc)[:2000]
            logger.warning("mail_delivery_failed", to=row.to_address, error=str(exc))


def send(
    db,
    *,
    to: str,
    subject: str,
    text: str,
    html: str | None = None,
    kind: str | None = None,
    user_id: str | None = None,
    sync: bool = False,
) -> str:
    """Queue an e-mail inside the caller's transaction; delivery happens after commit.

    Returns the outbox row id. ``sync=True`` delivers on this thread (tests, CLI).
    """
    from app.database.models.iam import EmailOutbox

    row = EmailOutbox(
        user_id=user_id,
        to_address=to,
        subject=subject[:255],
        text_body=text,
        html_body=html,
        kind=kind,
        status="queued",
    )
    db.add(row)
    db.flush()
    outbox_id = row.id

    def after_commit(session, *_):
        if sync:
            _deliver(outbox_id)
        else:
            with _pool_lock:
                _pool.submit(_deliver, outbox_id)

    from sqlalchemy import event

    event.listen(db, "after_commit", after_commit, once=True)
    return outbox_id


def html_wrap(title: str, paragraphs: list[str], cta: tuple[str, str] | None = None) -> str:
    """Minimal, inline-styled HTML body that renders the same everywhere."""
    cfg = settings()
    body = "".join(
        f'<p style="margin:0 0 14px;font-size:15px;line-height:22px;color:#1f2328">{p}</p>'
        for p in paragraphs
    )
    button = (
        f'<p style="margin:22px 0"><a href="{cta[1]}" style="display:inline-block;padding:12px 20px;'
        f'border-radius:8px;background:#0f1010;color:#fff;text-decoration:none;font-weight:600">'
        f"{cta[0]}</a></p>"
        if cta
        else ""
    )
    return (
        '<div style="max-width:560px;margin:0 auto;padding:28px;font-family:Inter,Segoe UI,Arial,sans-serif">'
        f'<p style="margin:0 0 20px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">{cfg.app_name}</p>'
        f'<h1 style="margin:0 0 18px;font-size:22px;line-height:28px;color:#0f1010">{title}</h1>'
        f"{body}{button}"
        '<p style="margin:26px 0 0;font-size:12px;color:#6b7280">If you did not expect this e-mail you can ignore it. '
        "AI results on MIPAAS are for information only and are not a diagnosis.</p></div>"
    )
