"""Pure-logic tests for the security primitives (no database)."""

import time

from app.services import security


def test_totp_roundtrip_and_window():
    secret = security.totp_secret()
    now = time.time()
    code = security.totp_code(secret, now)
    assert len(code) == 6 and code.isdigit()
    assert security.totp_verify(secret, code)
    assert security.totp_verify(secret, security.totp_code(secret, now - 30))  # previous step
    assert not security.totp_verify(secret, security.totp_code(secret, now - 120))
    assert not security.totp_verify(secret, "abc")


def test_totp_known_vector():
    # RFC 6238 test vector (SHA-1, time 59 -> 94287082 for 8 digits; last 6 are 287082).
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    assert security.totp_code(secret, 59) == "287082"


def test_encrypt_roundtrip(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "unit-test-secret")
    token = security.encrypt_secret("JBSWY3DPEHPK3PXP")
    assert token != "JBSWY3DPEHPK3PXP"
    assert security.decrypt_secret(token) == "JBSWY3DPEHPK3PXP"


def test_rate_limiter_memory(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    limiter = security.RateLimiter()
    limit = security.Limit(3, 60)
    assert [limiter.hit("t", "a", limit) for _ in range(3)] == [0, 0, 0]
    assert limiter.hit("t", "a", limit) > 0
    assert limiter.hit("t", "b", limit) == 0  # other identity unaffected
    limiter.reset("t", "a")
    assert limiter.hit("t", "a", limit) == 0


def test_short_code_alphabet():
    code = security.short_code(8, "DR-")
    assert code.startswith("DR-") and len(code) == 11
    assert not set(code[3:]) & set("0O1IL")
