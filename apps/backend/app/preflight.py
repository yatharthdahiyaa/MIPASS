"""
Start-up checks for staging and production.

Development is forgiving on purpose (default secret, e-mails kept in the outbox, in-memory rate
limits). None of that is acceptable once real health records are involved, so outside
development the app refuses to start until every item here is configured. Each problem is
phrased as what to set, because the person reading it is deploying, not debugging.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from urllib.parse import urlsplit

_WEAK_SECRETS = {"", "dev-secret-key-change-in-production", "change-me-in-production", "changeme", "secret"}
_DEV_DB_PASSWORDS = {"mipaas_dev_pass", "postgres", "password", ""}


def _https(url: str) -> bool:
    parts = urlsplit(url.strip())
    return parts.scheme == "https" and bool(parts.netloc)


def production_problems(env: Mapping[str, str] | None = None) -> list[str]:
    """Everything that makes this configuration unsafe to serve real users. Empty = ready."""
    env = os.environ if env is None else env
    problems: list[str] = []

    secret = env.get("SECRET_KEY", "")
    if secret in _WEAK_SECRETS or len(secret) < 32:
        problems.append("SECRET_KEY: set a random value of at least 32 characters.")

    mfa_key = env.get("MFA_ENCRYPTION_KEY", "")
    if not mfa_key:
        problems.append(
            "MFA_ENCRYPTION_KEY: set a Fernet key (see .env.example). Without it, two-step "
            "secrets are tied to SECRET_KEY and rotating that locks users out."
        )
    else:
        try:
            from cryptography.fernet import Fernet

            Fernet(mfa_key.encode("ascii"))
        except Exception:
            problems.append("MFA_ENCRYPTION_KEY: not a valid Fernet key.")

    db = env.get("DATABASE_URL", "")
    if not db.startswith(("postgresql://", "postgresql+psycopg2://")):
        problems.append("DATABASE_URL: set the PostgreSQL connection string.")
    elif (urlsplit(db).password or "") in _DEV_DB_PASSWORDS:
        problems.append("DATABASE_URL: still uses the development database password.")

    if not _https(env.get("APP_BASE_URL", "")):
        problems.append("APP_BASE_URL: set the public https:// address of the web app (used in e-mailed links).")

    origins = [o.strip() for o in env.get("CORS_ORIGINS", "").split(",") if o.strip()]
    if not origins or not all(_https(o) for o in origins):
        problems.append("CORS_ORIGINS: list the https:// origins that may call the API.")

    if env.get("MAIL_BACKEND", "outbox").strip().lower() != "smtp" or not env.get("SMTP_HOST"):
        problems.append(
            "MAIL_BACKEND=smtp and SMTP_HOST: without real delivery nobody can confirm their "
            "e-mail or reset a password."
        )
    if env.get("MAIL_FROM", "mipaas.local").strip().rstrip(">").endswith(".local"):
        problems.append("MAIL_FROM: set a sender address on a domain you control.")

    if env.get("AGENTS_URL") and len(env.get("AGENTS_SERVICE_KEY", "")) < 32:
        problems.append(
            "AGENTS_SERVICE_KEY: set a random value of at least 32 characters (the same value on the "
            "agents service), or leave AGENTS_URL empty to run without AI agents."
        )

    if not env.get("REDIS_URL"):
        problems.append(
            "REDIS_URL: sign-in and reset limits are counted per process without it, so every "
            "extra worker multiplies the attempts an attacker gets."
        )
    return problems


class NotProductionReady(RuntimeError):
    def __init__(self, problems: list[str]) -> None:
        self.problems = problems
        lines = "\n".join(f"  - {p}" for p in problems)
        super().__init__(f"MIPAAS refuses to start outside development with this configuration:\n{lines}")


def require_production_ready(env: Mapping[str, str] | None = None) -> None:
    problems = production_problems(env)
    if problems:
        raise NotProductionReady(problems)
