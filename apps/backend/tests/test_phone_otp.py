"""
Phone verification and sign-in with a one-time code (SMS or WhatsApp), in the local ``console`` mode
(the code is generated and checked by the app, so no carrier account is needed).

Pure helpers run without a database; the route tests need PostgreSQL like the rest of the suite.
"""

import uuid

import pytest

from app.services import accounts, messaging
from tests.conftest import PASSWORD, login, register, unwrap

CODE = "424242"


def _phone() -> str:
    # Unique per test: a verified number belongs to one account.
    return f"+9198{uuid.uuid4().int % 10**8:08d}"


@pytest.fixture
def console_phone(monkeypatch):
    monkeypatch.setenv("PHONE_BACKEND", "console")
    monkeypatch.setattr(accounts.secrets, "randbelow", lambda n: int(CODE))


def _verified_patient(client):
    email, user = register(client, "patient")
    phone = _phone()
    assert client.patch("/api/v1/auth/profile", json={"phone": phone}).status_code == 200
    assert client.post("/api/v1/auth/phone/verify/request").status_code == 200
    res = client.post("/api/v1/auth/phone/verify/confirm", json={"code": CODE})
    assert res.status_code == 200, res.data
    return email, phone


def test_normalize_phone():
    assert messaging.normalize_phone("+91 98765-43210") == "+919876543210"
    assert messaging.normalize_phone("0091 (98765) 43210") == "+919876543210"
    # No country code: refuse rather than guess whose number it is.
    assert messaging.normalize_phone("9876543210") is None
    assert messaging.normalize_phone("+0123456789") is None
    assert messaging.normalize_phone("") is None and messaging.normalize_phone(None) is None


def test_channel_defaults_to_sms(monkeypatch):
    monkeypatch.delenv("PHONE_CHANNEL", raising=False)
    assert messaging.channel() == "sms"
    monkeypatch.setenv("PHONE_CHANNEL", "whatsapp")
    assert messaging.channel() == "whatsapp"
    monkeypatch.setenv("PHONE_CHANNEL", "carrier-pigeon")
    assert messaging.channel() == "sms"  # unknown values fall back, never to WhatsApp by accident


def _fake_addon(tmp_path, monkeypatch, body: str):
    """An add-on package ``fake_phone`` in a temporary add-ons folder."""
    import sys

    pkg = tmp_path / "fake_phone"
    pkg.mkdir()
    (pkg / "__init__.py").write_text(body)
    monkeypatch.setenv("ADDONS_DIR", str(tmp_path))
    monkeypatch.setenv("PHONE_BACKEND", "fake")
    monkeypatch.delitem(sys.modules, "fake_phone", raising=False)
    monkeypatch.setattr(sys, "path", list(sys.path))


def test_backend_loads_an_addon_and_wraps_its_errors(tmp_path, monkeypatch):
    _fake_addon(
        tmp_path,
        monkeypatch,
        """
class ProviderError(Exception):
    def __init__(self, message, status=502, code="send_failed", detail=""):
        super().__init__(message)
        self.message, self.status, self.code, self.detail = message, status, code, detail

calls = []
def configured(): return True
def can_send_updates(channel): return channel == "sms"
def start_verification(phone, channel):
    if phone.endswith("0000"):
        raise ProviderError("Nope.", 502, "trial_unverified")
    calls.append((phone, channel))
def check_verification(phone, code): return code == "123456"
def send_text(phone, body, channel): calls.append(("text", phone, body, channel))
""",
    )
    assert messaging.enabled() and messaging.can_send_updates()
    messaging.start_verification("+919876543210")
    assert messaging.check_verification("+919876543210", "123456") is True
    assert messaging.check_verification("+919876543210", "000000") is False
    with pytest.raises(messaging.MessagingError) as err:
        messaging.start_verification("+919876540000")
    assert err.value.code == "trial_unverified" and err.value.message == "Nope."
    monkeypatch.setenv("PHONE_CHANNEL", "whatsapp")
    assert messaging.can_send_updates() is False  # the add-on has no WhatsApp sender


def test_missing_addon_hides_the_feature(tmp_path, monkeypatch):
    monkeypatch.setenv("ADDONS_DIR", str(tmp_path))  # empty folder
    monkeypatch.setenv("PHONE_BACKEND", "nosuch")
    assert messaging.enabled() is False and messaging.can_send_updates() is False
    with pytest.raises(messaging.MessagingError):
        messaging.start_verification("+919876543210")
    # A backend name that isn't a plain identifier is never imported.
    monkeypatch.setenv("PHONE_BACKEND", "../evil")
    assert messaging.enabled() is False


def test_unavailable_when_off(client, monkeypatch):
    monkeypatch.setenv("PHONE_BACKEND", "off")
    register(client, "patient")
    client.patch("/api/v1/auth/profile", json={"phone": _phone()})
    res = client.post("/api/v1/auth/phone/verify/request")
    assert res.status_code == 503
    assert unwrap(client.get("/api/v1/auth/phone"))["data"]["available"] is False


def test_verify_phone_then_change_resets_it(client, console_phone):
    register(client, "patient")
    phone = _phone()
    client.patch("/api/v1/auth/profile", json={"phone": phone})
    assert client.post("/api/v1/auth/phone/verify/confirm", json={"code": CODE}).status_code == 401  # none sent
    assert client.post("/api/v1/auth/phone/verify/request").status_code == 200
    assert client.post("/api/v1/auth/phone/verify/confirm", json={"code": "000000"}).status_code == 401
    res = client.post("/api/v1/auth/phone/verify/confirm", json={"code": CODE})
    assert res.status_code == 200 and unwrap(res)["data"]["user"]["phone_verified"] is True
    # The code is single use.
    assert client.post("/api/v1/auth/phone/verify/confirm", json={"code": CODE}).status_code == 401
    # A different number has to be confirmed again.
    client.patch("/api/v1/auth/profile", json={"phone": _phone()})
    assert unwrap(client.get("/api/v1/auth/phone"))["data"]["verified"] is False


def test_code_locks_after_too_many_wrong_attempts(client, console_phone):
    register(client, "patient")
    client.patch("/api/v1/auth/profile", json={"phone": _phone()})
    client.post("/api/v1/auth/phone/verify/request")
    for _ in range(accounts.PHONE_OTP_MAX_ATTEMPTS):
        assert client.post("/api/v1/auth/phone/verify/confirm", json={"code": "111111"}).status_code == 401
    # Even the right code no longer works: the attempt budget for that code is spent.
    assert client.post("/api/v1/auth/phone/verify/confirm", json={"code": CODE}).status_code == 401


def test_phone_login(client, console_phone):
    email, phone = _verified_patient(client)
    client.post("/api/v1/auth/logout")

    res = client.post("/api/v1/auth/phone/login/request", json={"phone": phone})
    assert res.status_code == 200
    bad = client.post("/api/v1/auth/phone/login/confirm", json={"phone": phone, "code": "000000"})
    assert bad.status_code == 401
    assert unwrap(client.get("/api/v1/auth/session"))["data"]["authenticated"] is False

    res = client.post("/api/v1/auth/phone/login/confirm", json={"phone": phone, "code": CODE})
    assert res.status_code == 200, res.data
    assert unwrap(res)["data"]["user"]["email"] == email
    assert unwrap(client.get("/api/v1/auth/session"))["data"]["authenticated"] is True


def test_phone_login_does_not_reveal_unknown_numbers(client, console_phone):
    res = client.post("/api/v1/auth/phone/login/request", json={"phone": _phone()})
    assert res.status_code == 200 and unwrap(res)["data"]["sent"] is True
    res = client.post("/api/v1/auth/phone/login/confirm", json={"phone": _phone(), "code": CODE})
    assert res.status_code == 401
    # A malformed number is the caller's mistake, not information about an account.
    assert client.post("/api/v1/auth/phone/login/request", json={"phone": "12345"}).status_code == 422


def test_phone_login_still_asks_for_the_authenticator_code(client, console_phone):
    from app.services import security

    email, phone = _verified_patient(client)
    secret = unwrap(client.post("/api/v1/auth/mfa/setup"))["data"]["secret"]
    assert client.post("/api/v1/auth/mfa/enable", json={"code": security.totp_code(secret)}).status_code == 200
    client.post("/api/v1/auth/logout")

    client.post("/api/v1/auth/phone/login/request", json={"phone": phone})
    res = client.post("/api/v1/auth/phone/login/confirm", json={"phone": phone, "code": CODE})
    data = unwrap(res)["data"]
    assert res.status_code == 200 and data.get("mfa_required") is True
    assert unwrap(client.get("/api/v1/auth/session"))["data"]["authenticated"] is False


def test_one_verified_number_per_account(client, console_phone):
    _, phone = _verified_patient(client)
    client.post("/api/v1/auth/logout")
    register(client, "patient")
    client.patch("/api/v1/auth/profile", json={"phone": phone})
    res = client.post("/api/v1/auth/phone/verify/request")
    assert res.status_code == 409 and unwrap(res)["error"]["type"] == "phone_unavailable"


def test_doctors_cannot_use_phone_login(client, console_phone):
    register(client, "doctor", license_number="MCI-99001", specialty="Cardiology")
    phone = _phone()
    client.patch("/api/v1/auth/profile", json={"phone": phone})
    assert client.post("/api/v1/auth/phone/verify/request").status_code == 200
    assert client.post("/api/v1/auth/phone/verify/confirm", json={"code": CODE}).status_code == 200
    client.post("/api/v1/auth/logout")
    client.post("/api/v1/auth/phone/login/request", json={"phone": phone})
    res = client.post("/api/v1/auth/phone/login/confirm", json={"phone": phone, "code": CODE})
    assert res.status_code == 401
    assert login(client, "nobody@example.test", PASSWORD).status_code == 401  # password sign-in is unaffected


def test_updates_are_opt_in_and_carry_no_clinical_detail(client, console_phone, monkeypatch):
    from app.database.models.iam import User
    from app.database.session import get_db
    from app.services import notify

    email, phone = _verified_patient(client)
    sent: list[str] = []
    monkeypatch.setattr(messaging, "send_update", lambda db, to, body: sent.append(body))

    with get_db() as db:
        uid = db.query(User).filter(User.email == email).one().id
        notify.notify(db, uid, "vitals.alert", "Blood pressure 190/120", "Call someone")  # off by default
        notify.notify(db, uid, "account.security", "New sign-in to your account", "from Chrome")  # on by default
        notify.update_preferences(db, uid, {"screening.result": {"phone": True}})
        notify.notify(db, uid, "screening.result", "Pneumonia suspected", "HIGH")

    assert len(sent) == 2
    assert all("190" not in m and "Pneumonia" not in m and "Chrome" not in m for m in sent)
    assert "security update" in sent[0] and "result is ready" in sent[1]
