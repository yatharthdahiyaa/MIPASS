"""Twilio add-on: sender selection per channel and the trial-account message (no network)."""

import pytest

from twilio_phone import provider

ENV = (
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_VERIFY_SERVICE_SID",
    "TWILIO_SMS_FROM",
    "TWILIO_MESSAGING_SERVICE_SID",
    "TWILIO_WHATSAPP_FROM",
)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in ENV:
        monkeypatch.delenv(name, raising=False)


def _configure(monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACtest")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "token")
    monkeypatch.setenv("TWILIO_VERIFY_SERVICE_SID", "VAtest")


def test_configured_needs_account_token_and_verify_service(monkeypatch):
    assert provider.configured() is False
    _configure(monkeypatch)
    assert provider.configured() is True


def test_sms_sender_selection(monkeypatch):
    _configure(monkeypatch)
    assert provider.can_send_updates("sms") is False  # codes work, updates need a sender
    monkeypatch.setenv("TWILIO_SMS_FROM", "+15005550006")
    assert provider._message_fields("+919876543210", "hi", "sms") == {
        "From": "+15005550006",
        "To": "+919876543210",
        "Body": "hi",
    }
    monkeypatch.setenv("TWILIO_MESSAGING_SERVICE_SID", "MG123")
    assert provider._message_fields("+919876543210", "hi", "sms")["MessagingServiceSid"] == "MG123"
    assert provider.can_send_updates("sms") is True


def test_whatsapp_sender_selection(monkeypatch):
    _configure(monkeypatch)
    monkeypatch.setenv("TWILIO_SMS_FROM", "+15005550006")
    assert provider._message_fields("+919876543210", "hi", "whatsapp") is None  # no WhatsApp sender yet
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "+14155238886")
    fields = provider._message_fields("+919876543210", "hi", "whatsapp")
    assert fields["From"] == "whatsapp:+14155238886" and fields["To"] == "whatsapp:+919876543210"


def test_trial_restriction_is_explained(monkeypatch):
    _configure(monkeypatch)

    def refuse(url, fields):
        raise provider.ProviderError("Twilio rejected the request.", 502, "twilio_400", "the recipient must be a verified tester.")

    monkeypatch.setattr(provider, "_post", refuse)
    with pytest.raises(provider.ProviderError) as err:
        provider.start_verification("+919876543210", "sms")
    assert err.value.code == "trial_unverified" and "verified" in err.value.message


def test_check_treats_missing_verification_as_wrong_code(monkeypatch):
    _configure(monkeypatch)

    def gone(url, fields):
        raise provider.ProviderError("Twilio rejected the request.", 502, "twilio_404")

    monkeypatch.setattr(provider, "_post", gone)
    assert provider.check_verification("+919876543210", "123456") is False


def test_send_text_without_a_sender_fails_clearly(monkeypatch):
    _configure(monkeypatch)
    with pytest.raises(provider.ProviderError) as err:
        provider.send_text("+919876543210", "hi", "sms")
    assert err.value.code == "no_sender"
