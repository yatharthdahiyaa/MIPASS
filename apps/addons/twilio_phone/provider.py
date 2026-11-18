"""
Twilio provider for phone one-time codes and text updates (SMS or WhatsApp).

This is an add-on: the backend (``apps/backend/app/services/messaging.py``) knows nothing about
Twilio and loads this package only when ``PHONE_BACKEND=twilio``. Settings are read from the
environment, and from ``apps/addons/twilio_phone/.env`` when that file exists (see ``.env.example``).

Contract with the backend (every phone provider implements these):

    configured() -> bool
    start_verification(phone, channel)         send a one-time code (Twilio Verify)
    check_verification(phone, code) -> bool
    can_send_updates(channel) -> bool          a sender is set up for ``channel``
    send_text(phone, body, channel)            plain message (Twilio Messages)
    ProviderError(message, status, code, detail)

``channel`` is ``"sms"`` or ``"whatsapp"``. Phone numbers arrive in E.164. Only the standard
library is used for HTTP.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:  # python-dotenv ships with the backend; a plain environment works without it
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env", override=False)
except ImportError:  # pragma: no cover
    pass

logger = logging.getLogger("twilio_phone")

_TIMEOUT = 15


class ProviderError(Exception):
    """Delivery or verification failed; ``message`` is safe to show the user."""

    def __init__(self, message: str, status: int = 502, code: str = "send_failed", detail: str = "") -> None:
        super().__init__(message)
        self.message, self.status, self.code, self.detail = message, status, code, detail


def _env(name: str) -> str | None:
    return os.getenv(name) or None


def configured() -> bool:
    """Codes can be delivered: account, token and Verify service are all set."""
    return bool(_env("TWILIO_ACCOUNT_SID") and _env("TWILIO_AUTH_TOKEN") and _env("TWILIO_VERIFY_SERVICE_SID"))


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------


def _post(url: str, fields: dict[str, str]) -> dict:
    auth = base64.b64encode(f"{_env('TWILIO_ACCOUNT_SID')}:{_env('TWILIO_AUTH_TOKEN')}".encode()).decode()
    req = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(fields).encode(),
        headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:  # noqa: S310 (fixed https hosts)
            return json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read() or b"{}")
        except ValueError:
            body = {}
        logger.warning("twilio_error status=%s twilio_code=%s detail=%s", exc.code, body.get("code"), body.get("message"))
        raise ProviderError(
            "Twilio rejected the request.", 502, f"twilio_{exc.code}", str(body.get("message") or "")
        ) from exc
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        logger.warning("twilio_unreachable error=%s", exc)
        raise ProviderError("Couldn't reach the messaging service. Please try again.", 503, "unreachable") from exc


# ---------------------------------------------------------------------------
# One-time codes
# ---------------------------------------------------------------------------


def start_verification(phone: str, channel: str = "sms") -> None:
    try:
        _post(
            f"https://verify.twilio.com/v2/Services/{_env('TWILIO_VERIFY_SERVICE_SID')}/Verifications",
            {"To": phone, "Channel": channel},
        )
    except ProviderError as exc:
        if exc.code == "twilio_429":
            raise ProviderError("Too many codes requested. Please wait a few minutes.", 429, "locked") from exc
        detail = exc.detail.lower()
        if "verified tester" in detail or "unverified" in detail:
            # Twilio trial accounts only deliver to numbers added in the Twilio console.
            raise ProviderError(
                "This number isn't allowed yet: the Twilio trial can only text numbers verified in the Twilio console.",
                502,
                "trial_unverified",
            ) from exc
        raise ProviderError("We couldn't send a code to that number.", 502, "send_failed") from exc


def check_verification(phone: str, code: str) -> bool:
    try:
        out = _post(
            f"https://verify.twilio.com/v2/Services/{_env('TWILIO_VERIFY_SERVICE_SID')}/VerificationCheck",
            {"To": phone, "Code": code},
        )
    except ProviderError as exc:
        # 404: no pending verification (expired, already used or too many attempts).
        if exc.code in ("twilio_404", "twilio_429"):
            return False
        raise
    return out.get("status") == "approved"


# ---------------------------------------------------------------------------
# Updates
# ---------------------------------------------------------------------------


def _message_fields(phone: str, body: str, channel: str) -> dict[str, str] | None:
    """Twilio Messages parameters for ``channel``, or None when no sender is set up for it."""
    if channel == "whatsapp":
        sender = _env("TWILIO_WHATSAPP_FROM")
        if not sender:
            return None
        sender = sender if sender.startswith("whatsapp:") else f"whatsapp:{sender}"
        return {"From": sender, "To": f"whatsapp:{phone}", "Body": body}
    if _env("TWILIO_MESSAGING_SERVICE_SID"):
        return {"MessagingServiceSid": _env("TWILIO_MESSAGING_SERVICE_SID") or "", "To": phone, "Body": body}
    if _env("TWILIO_SMS_FROM"):
        return {"From": _env("TWILIO_SMS_FROM") or "", "To": phone, "Body": body}
    return None


def can_send_updates(channel: str = "sms") -> bool:
    return configured() and _message_fields("+10000000000", "", channel) is not None


def send_text(phone: str, body: str, channel: str = "sms") -> None:
    fields = _message_fields(phone, body[:1000], channel)
    if fields is None:
        raise ProviderError("No sender is configured for this channel.", 503, "no_sender")
    _post(f"https://api.twilio.com/2010-04-01/Accounts/{_env('TWILIO_ACCOUNT_SID')}/Messages.json", fields)
