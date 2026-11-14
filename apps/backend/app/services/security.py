"""
Security primitives shared by the account, MFA and rate-limiting code.

* TOTP (RFC 6238) implemented on the standard library, so no extra dependency.
* Fernet encryption for secrets at rest (``MFA_ENCRYPTION_KEY`` or derived from SECRET_KEY).
* Opaque single-use tokens: random, only their SHA-256 is stored.
* A sliding-window rate limiter with an in-memory backend and an optional Redis backend
  (``REDIS_URL``) so limits hold across several API instances.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import struct
import threading
import time
from dataclasses import dataclass
from urllib.parse import quote

import structlog

logger = structlog.get_logger()

# --------------------------------------------------------------------------- hashing


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def new_token(nbytes: int = 32) -> str:
    """URL-safe random token (the caller stores ``sha256_hex(token)`` only)."""
    return secrets.token_urlsafe(nbytes)


# Letters/digits without look-alikes (no 0/O, 1/I/L).
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def short_code(length: int = 6, prefix: str = "") -> str:
    return prefix + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))


def numeric_code(digits: int = 6) -> str:
    return str(secrets.randbelow(10**digits)).zfill(digits)


# --------------------------------------------------------------------------- TOTP


def totp_secret() -> str:
    """A new base32 secret (160 bits), the format authenticator apps expect."""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def totp_code(secret_b32: str, at: float | None = None, step: int = 30, digits: int = 6) -> str:
    padded = secret_b32.upper() + "=" * (-len(secret_b32) % 8)
    key = base64.b32decode(padded, casefold=True)
    counter = int((time.time() if at is None else at) // step)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    number = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(number % (10**digits)).zfill(digits)


def totp_verify(secret_b32: str, code: str, window: int = 1, step: int = 30) -> bool:
    """Constant-time check of ``code`` against the current step +/- ``window`` steps."""
    code = (code or "").strip().replace(" ", "")
    if not code.isdigit():
        return False
    now = time.time()
    ok = False
    for offset in range(-window, window + 1):
        ok |= hmac.compare_digest(totp_code(secret_b32, now + offset * step, step), code)
    return ok


def otpauth_uri(secret_b32: str, account: str, issuer: str = "MIPAAS") -> str:
    return (
        f"otpauth://totp/{quote(issuer)}:{quote(account)}"
        f"?secret={secret_b32}&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30"
    )


# --------------------------------------------------------------------------- encryption


def _fernet():
    from cryptography.fernet import Fernet

    raw = os.getenv("MFA_ENCRYPTION_KEY")
    if raw:
        key = raw.encode("ascii")
    else:
        # Derive a stable key from SECRET_KEY so development works without extra config.
        secret = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
        key = base64.urlsafe_b64encode(hashlib.sha256(("mfa:" + secret).encode()).digest())
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str) -> str:
    return _fernet().decrypt(value.encode("ascii")).decode("utf-8")


# --------------------------------------------------------------------------- rate limiting


@dataclass(frozen=True)
class Limit:
    """``max_hits`` within ``window`` seconds."""

    max_hits: int
    window: int


class _MemoryBackend:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def hit(self, key: str, limit: Limit) -> int:
        """Record a hit and return seconds to wait (0 = allowed)."""
        now = time.monotonic()
        with self._lock:
            if now - self._last_sweep > 300:  # drop stale keys so memory stays bounded
                self._hits = {
                    k: [t for t in v if now - t < 3600] for k, v in self._hits.items() if v
                }
                self._last_sweep = now
            recent = [t for t in self._hits.get(key, []) if now - t < limit.window]
            if len(recent) >= limit.max_hits:
                self._hits[key] = recent
                return max(1, int(limit.window - (now - recent[0])))
            recent.append(now)
            self._hits[key] = recent
            return 0

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)


class _RedisBackend:
    def __init__(self, url: str) -> None:
        import redis

        self._r = redis.Redis.from_url(url, socket_timeout=1, socket_connect_timeout=1)

    def hit(self, key: str, limit: Limit) -> int:
        now = time.time()
        k = f"mipaas:rl:{key}"
        pipe = self._r.pipeline()
        pipe.zremrangebyscore(k, 0, now - limit.window)
        pipe.zcard(k)
        pipe.zrange(k, 0, 0, withscores=True)
        _, count, oldest = pipe.execute()
        if count >= limit.max_hits:
            first = oldest[0][1] if oldest else now
            return max(1, int(limit.window - (now - first)))
        pipe = self._r.pipeline()
        pipe.zadd(k, {f"{now:.6f}:{secrets.token_hex(4)}": now})
        pipe.expire(k, limit.window)
        pipe.execute()
        return 0

    def reset(self, key: str) -> None:
        self._r.delete(f"mipaas:rl:{key}")


class RateLimiter:
    """Sliding-window limiter. Falls back to memory if Redis is configured but unreachable."""

    def __init__(self) -> None:
        self._memory = _MemoryBackend()
        self._redis = None
        url = os.getenv("REDIS_URL")
        if url:
            try:
                self._redis = _RedisBackend(url)
                self._redis._r.ping()
                logger.info("rate_limiter_backend", backend="redis")
            except Exception as exc:  # pragma: no cover - depends on the environment
                logger.warning("rate_limiter_redis_unavailable", error=str(exc))
                self._redis = None

    @property
    def backend(self) -> str:
        return "redis" if self._redis else "memory"

    def hit(self, scope: str, identity: str, limit: Limit) -> int:
        key = f"{scope}:{identity}"
        if self._redis is not None:
            try:
                return self._redis.hit(key, limit)
            except Exception as exc:  # pragma: no cover
                logger.warning("rate_limiter_redis_error", error=str(exc))
        return self._memory.hit(key, limit)

    def reset(self, scope: str, identity: str) -> None:
        key = f"{scope}:{identity}"
        if self._redis is not None:
            try:
                self._redis.reset(key)
            except Exception:  # pragma: no cover
                pass
        self._memory.reset(key)


_limiter: RateLimiter | None = None


def get_rate_limiter() -> RateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = RateLimiter()
    return _limiter


# Limits used by the account routes (per identifier + IP unless noted).
LIMITS = {
    "login": Limit(5, 15 * 60),
    "register_ip": Limit(10, 60 * 60),
    "verify_request": Limit(3, 10 * 60),
    "password_forgot": Limit(3, 15 * 60),
    "mfa_verify": Limit(6, 10 * 60),
    "care_invite": Limit(20, 60 * 60),
    "message": Limit(60, 60),
    "agent_run": Limit(60, 60 * 60),
}
