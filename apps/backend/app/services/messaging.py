"""
Phone delivery for one-time codes and short account updates, over SMS or WhatsApp.

The backend itself only knows how to *ask* for these; the carrier integration is an add-on
(``apps/addons``, see its README), loaded on demand.

``PHONE_BACKEND`` selects the mode:

* ``off`` (default)  nothing is sent; the phone features are hidden.
* ``console``        development: codes are generated locally and printed to the server log,
                     updates are logged. Nothing leaves the machine.
* ``<name>``         use the add-on package ``<name>_phone`` (for example ``twilio``). If the
                     add-on is missing or not configured the phone features stay hidden.

``PHONE_CHANNEL`` is ``sms`` (default) or ``whatsapp``; it is passed to the add-on.
``ADDONS_DIR`` overrides where add-ons are looked up (default ``<repo>/apps/addons``).

Phone numbers must be E.164 (``+<country code><number>``); see :func:`normalize_phone`.

Privacy: updates carry a short generic sentence and a link, never clinical detail.
"""

from __future__ import annotations

import importlib
import os
import re
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType

import structlog

from app.paths import REPO_ROOT

logger = structlog.get_logger()

_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="phone-msg")
_pool_lock = threading.Lock()

_E164 = re.compile(r"^\+[1-9][0-9]{7,14}$")
_NAME = re.compile(r"^[a-z][a-z0-9_]{0,30}$")
CHANNELS = ("sms", "whatsapp")
_BUILTIN_MODES = ("off", "console")


class MessagingError(Exception):
    """Delivery or verification failed; ``message`` is safe to show the user."""

    def __init__(self, message: str, status: int = 502, code: str = "send_failed", detail: str = "") -> None:
        super().__init__(message)
        self.message, self.status, self.code, self.detail = message, status, code, detail


@dataclass(frozen=True)
class Settings:
    backend: str
    channel: str

    @classmethod
    def from_env(cls) -> Settings:
        channel = (os.getenv("PHONE_CHANNEL") or "sms").strip().lower()
        return cls(
            backend=(os.getenv("PHONE_BACKEND") or "off").strip().lower(),
            channel=channel if channel in CHANNELS else "sms",
        )


def settings() -> Settings:
    return Settings.from_env()


def channel() -> str:
    return settings().channel


# ---------------------------------------------------------------------------
# Add-on loading
# ---------------------------------------------------------------------------


def addons_dir() -> Path:
    return Path(os.getenv("ADDONS_DIR") or REPO_ROOT / "apps" / "addons").expanduser().resolve()


def _provider() -> ModuleType | None:
    """The add-on module for the configured backend, or None (not a provider mode, or not installed)."""
    name = settings().backend
    if name in _BUILTIN_MODES or not _NAME.match(name):
        return None
    folder = str(addons_dir())
    if folder not in sys.path:
        sys.path.append(folder)
    try:
        return importlib.import_module(f"{name}_phone")
    except ImportError:
        logger.warning("phone_addon_missing", addon=f"{name}_phone", looked_in=folder)
        return None


def _wrap(exc: Exception) -> MessagingError:
    """Turn an add-on's ``ProviderError`` into ours (duck-typed, so add-ons need not import the backend)."""
    if all(hasattr(exc, a) for a in ("message", "status", "code")):
        return MessagingError(exc.message, exc.status, exc.code, getattr(exc, "detail", ""))
    logger.warning("phone_addon_error", error=repr(exc))
    return MessagingError("We couldn't send a code to that number.", 502, "send_failed")


def enabled() -> bool:
    """True when codes can actually be delivered in this environment."""
    if settings().backend == "console":
        return True
    provider = _provider()
    return bool(provider and provider.configured())


def uses_local_codes() -> bool:
    """Console mode: this app generates and checks the code itself."""
    return settings().backend == "console"


def can_send_updates() -> bool:
    """True when account updates (not just codes) can be delivered."""
    if settings().backend == "console":
        return True
    provider = _provider()
    return bool(provider and provider.configured() and provider.can_send_updates(channel()))


# ---------------------------------------------------------------------------
# Numbers
# ---------------------------------------------------------------------------


def normalize_phone(raw: str | None) -> str | None:
    """E.164 form of ``raw`` (spaces, dashes and brackets removed), or None if it isn't one.

    A country code is required; guessing one for a bare national number would send a code to
    a stranger.
    """
    cleaned = re.sub(r"[\s().-]", "", (raw or "").strip())
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    return cleaned if _E164.match(cleaned) else None


def mask(phone: str) -> str:
    return f"{phone[:3]}{'*' * max(0, len(phone) - 6)}{phone[-3:]}" if len(phone) > 6 else "***"


# ---------------------------------------------------------------------------
# Codes and updates
# ---------------------------------------------------------------------------


def start_verification(phone: str) -> None:
    """Have the add-on send a one-time code to ``phone`` (not used in console mode)."""
    provider = _provider()
    if provider is None:
        raise MessagingError("Phone codes aren't available right now.", 503, "messaging_unavailable")
    try:
        provider.start_verification(phone, channel())
    except Exception as exc:  # noqa: BLE001 (add-on errors are wrapped, never leaked)
        raise _wrap(exc) from exc


def check_verification(phone: str, code: str) -> bool:
    provider = _provider()
    if provider is None:
        raise MessagingError("Phone codes aren't available right now.", 503, "messaging_unavailable")
    try:
        return bool(provider.check_verification(phone, code))
    except Exception as exc:  # noqa: BLE001
        raise _wrap(exc) from exc


def _send_text(phone: str, body: str) -> None:
    cfg = settings()
    if cfg.backend == "console":
        logger.info("phone_message_console", channel=cfg.channel, to=mask(phone), body=body)
        return
    provider = _provider()
    if provider is None or not provider.configured():
        return
    try:
        provider.send_text(phone, body, cfg.channel)
    except Exception as exc:  # noqa: BLE001 (an update that fails must never break the request)
        logger.warning("phone_update_failed", channel=cfg.channel, to=mask(phone), error=_wrap(exc).code)


def send_update(db, phone: str, body: str) -> None:
    """Send ``body`` to ``phone`` after the caller's transaction commits (never blocks it)."""
    from sqlalchemy import event

    def after_commit(session, *_):
        with _pool_lock:
            _pool.submit(_send_text, phone, body)

    event.listen(db, "after_commit", after_commit, once=True)
