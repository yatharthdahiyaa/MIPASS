"""
Account service: sign-up, sign-in, e-mail verification, password reset, MFA, sessions and
doctor verification, all on the central database.

Passwords are stored as Werkzeug scrypt hashes in ``users.password_hash``.
Sessions are random bearer tokens; only their SHA-256 digest is stored in
``user_sessions.token_hash``, so a database leak does not expose live sessions.
Single-use tokens (verification links, reset links, MFA challenges) follow the same rule.
"""

from __future__ import annotations

import hmac
import json
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from app.database.models.iam import AuditLog, AuthToken, MfaRecoveryCode, User, UserSession
from app.database.models.patient_ehr import ClinicianProfile, PatientProfile
from app.services import mailer, messaging, notify, security
from app.services.rbac import ROLE_METADATA, ROLE_PERMISSIONS, Role

logger = structlog.get_logger()

SESSION_COOKIE = "mipaas_session"
SESSION_TTL = timedelta(hours=12)
REMEMBER_TTL = timedelta(days=30)
VERIFY_TTL = timedelta(hours=24)
RESET_TTL = timedelta(hours=1)
MFA_CHALLENGE_TTL = timedelta(minutes=5)
PHONE_OTP_TTL = timedelta(minutes=10)
PHONE_OTP_MAX_ATTEMPTS = 5
RECOVERY_CODES = 8

# Self-service sign-up is segregated by account type:
#   patient -> Role.PATIENT (own health record only, never other people's data)
#   doctor  -> Role.DOCTOR_PENDING (no clinical access until an administrator verifies the licence)
SELF_SIGNUP_ROLE = Role.PATIENT
ACCOUNT_TYPES = ("patient", "doctor")

_DOCTOR_ROLES = {Role.DOCTOR, Role.DOCTOR_PENDING, Role.RADIOLOGIST}
CLINICIAN_ROLES = {Role.DOCTOR, Role.RADIOLOGIST}
# Roles allowed to sign in to the desktop diagnostic panel (apps/desktop).
DESKTOP_ROLES = {Role.DOCTOR, Role.RADIOLOGIST, Role.ADMIN}

MIN_PASSWORD_LENGTH = 10

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^[+0-9 ()-]{6,30}$")
# Equalises timing when the account does not exist.
_DUMMY_HASH = generate_password_hash("not-a-real-password")


class AccountError(Exception):
    """Validation or state error with a user-facing message and HTTP status."""

    def __init__(self, message: str, status: int = 400, code: str = "invalid_request"):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


@dataclass
class RequestContext:
    ip: str | None = None
    user_agent: str | None = None


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def hash_token(token: str) -> str:
    return security.sha256_hex(token)


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def validate_password(password: str) -> None:
    if len(password or "") < MIN_PASSWORD_LENGTH:
        raise AccountError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters.", 422, "weak_password"
        )
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise AccountError(
            "Password must include at least one letter and one number.", 422, "weak_password"
        )


def display_name(user: User) -> str:
    full = " ".join(part for part in (user.first_name, user.last_name) if part)
    return full or user.username


def account_type_of(role: Role) -> str:
    if role == Role.PATIENT:
        return "patient"
    if role in _DOCTOR_ROLES:
        return "doctor"
    return "staff"


def home_path(role: Role) -> str:
    """Where the web app should land this user after sign-in."""
    if role == Role.PATIENT:
        return "/patient"
    if role in _DOCTOR_ROLES:
        return "/doctor"
    if role == Role.ADMIN:
        return "/admin"
    return "/account"


def role_of(user: User) -> Role:
    try:
        return Role(user.role)
    except ValueError:
        return SELF_SIGNUP_ROLE


def clinician_profile(db: Session, user_id: str) -> ClinicianProfile | None:
    return db.query(ClinicianProfile).filter_by(user_id=user_id).first()


def serialize_clinician(profile: ClinicianProfile | None) -> dict | None:
    if profile is None:
        return None
    return {
        "specialty": profile.specialty,
        "license_number": profile.license_number,
        "verified": profile.verified_at is not None,
        "verified_at": profile.verified_at.isoformat() if profile.verified_at else None,
        "rejected": profile.rejected_at is not None,
        "rejection_reason": profile.rejection_reason,
        "share_code": profile.share_code,
        "listed": bool(profile.listed),
        "bio": profile.bio,
        "years_experience": profile.years_experience,
        "consult_modes": json.loads(profile.consult_modes_json or '["video","in_person","chat"]'),
    }


def serialize_user(user: User, db: Session | None = None) -> dict:
    role = role_of(user)
    out = {
        "id": user.id,
        "name": display_name(user),
        "email": user.email,
        "username": user.username,
        "role": role.value,
        "role_title": ROLE_METADATA.get(role, {}).get("title", role.value),
        "organization": user.organization,
        "department": user.department,
        "phone": user.phone,
        "phone_verified": user.phone_verified_at is not None,
        "locale": user.locale,
        "permissions": sorted(p.value for p in ROLE_PERMISSIONS.get(role, set())),
        "account_type": account_type_of(role),
        "verification_pending": role == Role.DOCTOR_PENDING,
        "email_verified": user.email_verified_at is not None,
        "mfa_enabled": bool(user.is_mfa_enabled),
        "home": home_path(role),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
    if db is not None and role in _DOCTOR_ROLES:
        out["clinician"] = serialize_clinician(clinician_profile(db, user.id))
    return out


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------


def record_audit(
    db: Session,
    action: str,
    ctx: RequestContext,
    *,
    user: User | None = None,
    username: str | None = None,
    status: str = "success",
    resource_type: str = "auth",
    resource_id: str | None = None,
    details_json: str | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user.id if user else None,
            username=user.username if user else username,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            status=status,
            ip_address=ctx.ip,
            user_agent=(ctx.user_agent or "")[:255] or None,
            details_json=details_json,
        )
    )


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------


def _unique_username(db: Session, email: str) -> str:
    base = re.sub(r"[^a-z0-9._-]", "", email.split("@")[0].lower())[:40] or "user"
    candidate = base
    while db.query(User.id).filter(func.lower(User.username) == candidate).first():
        candidate = f"{base}{secrets.randbelow(9000) + 1000}"
    return candidate


def create_account(
    db: Session,
    *,
    name: str,
    email: str,
    password: str,
    organization: str | None = None,
    account_type: str = "patient",
    license_number: str | None = None,
    specialty: str | None = None,
    phone: str | None = None,
    locale: str | None = None,
    role: Role | None = None,
) -> User:
    name = (name or "").strip()
    email = normalize_email(email)
    account_type = (account_type or "patient").strip().lower()
    if role is None:
        if account_type not in ACCOUNT_TYPES:
            raise AccountError(
                "Choose whether you are a patient or a doctor.", 422, "invalid_account_type"
            )
        role = Role.PATIENT if account_type == "patient" else Role.DOCTOR_PENDING
    license_number = (license_number or "").strip()
    specialty = (specialty or "").strip()
    if role == Role.DOCTOR_PENDING:
        if not 3 <= len(license_number) <= 100:
            raise AccountError(
                "Enter your medical registration / licence number.", 422, "invalid_license"
            )
        if not 2 <= len(specialty) <= 120:
            raise AccountError("Enter your specialty.", 422, "invalid_specialty")
    if not 2 <= len(name) <= 120:
        raise AccountError("Please enter your full name.", 422, "invalid_name")
    if not _EMAIL_RE.match(email) or len(email) > 255:
        raise AccountError("Please enter a valid email address.", 422, "invalid_email")
    phone = (phone or "").strip() or None
    if phone and not _PHONE_RE.match(phone):
        raise AccountError("That doesn't look like a phone number.", 422, "invalid_phone")
    validate_password(password)
    if db.query(User.id).filter(func.lower(User.email) == email).first():
        raise AccountError("An account with this email already exists.", 409, "email_taken")

    first, _, last = name.partition(" ")
    user = User(
        username=_unique_username(db, email),
        email=email,
        password_hash=generate_password_hash(password),
        first_name=first[:100],
        last_name=last.strip()[:100] or None,
        role=role.value,
        organization=(organization or "").strip()[:150] or None,
        department=None,
        phone=messaging.normalize_phone(phone) or phone,
        locale=(locale or "")[:10] or None,
        is_active=True,
        password_changed_at=_utcnow(),
    )
    db.add(user)
    db.flush()
    if role == Role.PATIENT:
        db.add(PatientProfile(user_id=user.id))
    elif role == Role.DOCTOR_PENDING:
        db.add(
            ClinicianProfile(user_id=user.id, license_number=license_number, specialty=specialty)
        )
    return user


def authenticate(db: Session, identifier: str, password: str) -> User | None:
    """Return the active user for valid credentials, else None. Timing-safe for unknown users."""
    ident = (identifier or "").strip().lower()
    user = (
        db.query(User)
        .filter(or_(func.lower(User.email) == ident, func.lower(User.username) == ident))
        .first()
        if ident
        else None
    )
    if user is None or not user.password_hash:
        check_password_hash(_DUMMY_HASH, password or "")
        return None
    if not check_password_hash(user.password_hash, password or ""):
        return None
    return user


def set_password(user: User, password: str) -> None:
    validate_password(password)
    user.password_hash = generate_password_hash(password)
    user.password_changed_at = _utcnow()


def update_profile(db: Session, user: User, data: dict) -> None:
    """Fields a signed-in user may change about themselves."""
    if "name" in data:
        name = str(data.get("name") or "").strip()
        if not 2 <= len(name) <= 120:
            raise AccountError("Please enter your full name.", 422, "invalid_name")
        first, _, last = name.partition(" ")
        user.first_name, user.last_name = first[:100], last.strip()[:100] or None
    if "phone" in data:
        phone = str(data.get("phone") or "").strip() or None
        if phone and not _PHONE_RE.match(phone):
            raise AccountError("That doesn't look like a phone number.", 422, "invalid_phone")
        phone = (messaging.normalize_phone(phone) or phone) if phone else None
        if phone != user.phone:
            # A different number has to be confirmed again.
            user.phone_verified_at = None
        user.phone = phone
    if "organization" in data:
        user.organization = str(data.get("organization") or "").strip()[:150] or None
    if "locale" in data:
        user.locale = str(data.get("locale") or "").strip()[:10] or None
    if role_of(user) in _DOCTOR_ROLES:
        profile = clinician_profile(db, user.id)
        if profile is not None:
            if "specialty" in data:
                specialty = str(data.get("specialty") or "").strip()
                if not 2 <= len(specialty) <= 120:
                    raise AccountError("Enter your specialty.", 422, "invalid_specialty")
                profile.specialty = specialty
            if "bio" in data:
                profile.bio = str(data.get("bio") or "").strip()[:2000] or None
            if "listed" in data:
                profile.listed = bool(data.get("listed")) and profile.verified_at is not None
            if "years_experience" in data:
                raw = data.get("years_experience")
                profile.years_experience = None if raw in (None, "") else max(0, min(int(raw), 80))
            if "consult_modes" in data:
                modes = [m for m in (data.get("consult_modes") or []) if m in ("video", "in_person", "chat")]
                profile.consult_modes_json = json.dumps(modes or ["video", "in_person", "chat"])


# ---------------------------------------------------------------------------
# Single-use tokens
# ---------------------------------------------------------------------------


def issue_token(
    db: Session, user: User, purpose: str, ttl: timedelta, meta: dict | None = None
) -> str:
    """Create a token, invalidating earlier unused ones of the same purpose."""
    db.query(AuthToken).filter(
        AuthToken.user_id == user.id, AuthToken.purpose == purpose, AuthToken.used_at.is_(None)
    ).update({AuthToken.used_at: _utcnow()}, synchronize_session=False)
    token = security.new_token()
    db.add(
        AuthToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_token(token),
            expires_at=_utcnow() + ttl,
            meta_json=json.dumps(meta) if meta else None,
        )
    )
    db.flush()
    return token


def peek_token(db: Session, purpose: str, token: str | None) -> AuthToken | None:
    if not token:
        return None
    row = db.query(AuthToken).filter_by(purpose=purpose, token_hash=hash_token(token)).first()
    if row is None or row.used_at is not None or _as_utc(row.expires_at) <= _utcnow():
        return None
    return row


def consume_token(db: Session, purpose: str, token: str | None) -> AuthToken | None:
    row = peek_token(db, purpose, token)
    if row is not None:
        row.used_at = _utcnow()
    return row


# ---------------------------------------------------------------------------
# Phone verification and sign-in with a one-time code (SMS or WhatsApp)
# ---------------------------------------------------------------------------


def phone_available() -> bool:
    return messaging.enabled()


def _require_messaging() -> None:
    if not messaging.enabled():
        raise AccountError("Phone codes aren't available right now.", 503, "messaging_unavailable")


def _otp_hash(user_id: str, phone: str, code: str) -> str:
    return hash_token(f"{user_id}:{phone}:{code}")


def _send_otp(db: Session, user: User, phone: str, purpose: str) -> None:
    """Deliver a fresh code to ``phone``; any earlier unused code for this purpose stops working."""
    _require_messaging()
    if messaging.uses_local_codes():
        code = f"{secrets.randbelow(10**6):06d}"
        db.query(AuthToken).filter(
            AuthToken.user_id == user.id, AuthToken.purpose == purpose, AuthToken.used_at.is_(None)
        ).update({AuthToken.used_at: _utcnow()}, synchronize_session=False)
        db.add(
            AuthToken(
                user_id=user.id,
                purpose=purpose,
                token_hash=hash_token(secrets.token_urlsafe(24)),
                expires_at=_utcnow() + PHONE_OTP_TTL,
                meta_json=json.dumps({"phone": phone, "code": _otp_hash(user.id, phone, code), "attempts": 0}),
            )
        )
        db.flush()
        # Development only: the code never leaves this machine.
        logger.info("phone_otp_console", channel=messaging.channel(), to=messaging.mask(phone), code=code, purpose=purpose)
        return
    try:
        messaging.start_verification(phone)
    except messaging.MessagingError as exc:
        raise AccountError(exc.message, exc.status, exc.code) from exc


def _check_otp(db: Session, user: User, phone: str, purpose: str, code: str | None) -> bool:
    """True when ``code`` is the live code for ``phone``. Wrong codes burn attempts, never raise."""
    code = re.sub(r"\D", "", code or "")
    if not 4 <= len(code) <= 10:
        return False
    if messaging.uses_local_codes():
        row = (
            db.query(AuthToken)
            .filter(AuthToken.user_id == user.id, AuthToken.purpose == purpose, AuthToken.used_at.is_(None))
            .order_by(AuthToken.created_at.desc())
            .first()
        )
        if row is None or _as_utc(row.expires_at) <= _utcnow():
            return False
        meta = json.loads(row.meta_json or "{}")
        if meta.get("phone") != phone:
            return False
        meta["attempts"] = int(meta.get("attempts", 0)) + 1
        if meta["attempts"] > PHONE_OTP_MAX_ATTEMPTS:
            row.used_at = _utcnow()
            return False
        row.meta_json = json.dumps(meta)
        ok = hmac.compare_digest(str(meta.get("code", "")), _otp_hash(user.id, phone, code))
        if ok:
            row.used_at = _utcnow()
        return ok
    try:
        return messaging.check_verification(phone, code)
    except messaging.MessagingError as exc:
        raise AccountError(exc.message, exc.status, exc.code) from exc


def _verified_phone_owner(db: Session, phone: str) -> User | None:
    return (
        db.query(User)
        .filter(User.phone == phone, User.phone_verified_at.is_not(None), User.is_active.is_(True))
        .first()
    )


def phone_verify_start(db: Session, user: User) -> str:
    """Send a code to the number on the profile. Returns the masked number for the UI."""
    _require_messaging()
    phone = messaging.normalize_phone(user.phone)
    if phone is None:
        raise AccountError(
            "Add your phone number with its country code, for example +91 98765 43210.", 422, "invalid_phone"
        )
    owner = _verified_phone_owner(db, phone)
    if owner is not None and owner.id != user.id:
        # One verified number per account, otherwise a code could sign in to the wrong person.
        raise AccountError("That number can't be used. Please try another.", 409, "phone_unavailable")
    _send_otp(db, user, phone, "phone_verify")
    return messaging.mask(phone)


def phone_verify_confirm(db: Session, user: User, code: str | None) -> bool:
    phone = messaging.normalize_phone(user.phone)
    if phone is None or not _check_otp(db, user, phone, "phone_verify", code):
        return False
    owner = _verified_phone_owner(db, phone)
    if owner is not None and owner.id != user.id:
        return False
    user.phone, user.phone_verified_at = phone, _utcnow()
    return True


def phone_login_start(db: Session, raw_phone: str | None) -> None:
    """Send a sign-in code to a verified patient number. Unknown numbers get no error (no probing)."""
    phone = messaging.normalize_phone(raw_phone)
    if phone is None:
        raise AccountError(
            "Enter your phone number with its country code, for example +91 98765 43210.", 422, "invalid_phone"
        )
    _require_messaging()
    user = _verified_phone_owner(db, phone)
    if user is not None and role_of(user) == Role.PATIENT:
        _send_otp(db, user, phone, "phone_login")


def phone_login_complete(db: Session, raw_phone: str | None, code: str | None) -> User | None:
    """The patient who owns this verified number if the code is right, else None.

    Clinicians and administrators keep password sign-in: a phone code alone is not enough for
    accounts that can see other people's records.
    """
    phone = messaging.normalize_phone(raw_phone)
    if phone is None:
        return None
    user = _verified_phone_owner(db, phone)
    if user is None or role_of(user) != Role.PATIENT:
        return None
    return user if _check_otp(db, user, phone, "phone_login", code) else None


# ---------------------------------------------------------------------------
# E-mail verification
# ---------------------------------------------------------------------------


def send_verification_email(db: Session, user: User) -> None:
    token = issue_token(db, user, "verify_email", VERIFY_TTL)
    url = mailer.link(f"/verify-email?token={token}")
    mailer.send(
        db,
        to=user.email,
        subject="Confirm your e-mail address for MIPAAS",
        text=(
            f"Hi {display_name(user)},\n\nConfirm your e-mail to activate everything on your "
            f"MIPAAS account:\n{url}\n\nThe link is valid for 24 hours."
        ),
        html=mailer.html_wrap(
            "Confirm your e-mail address",
            [
                f"Hi {display_name(user)},",
                "Confirm your e-mail to unlock care connections, alerts and password recovery "
                "on your MIPAAS account. The link is valid for 24 hours.",
            ],
            ("Confirm e-mail", url),
        ),
        kind="verify_email",
        user_id=user.id,
    )


def confirm_email(db: Session, token: str | None) -> User:
    row = consume_token(db, "verify_email", token)
    if row is None:
        raise AccountError("This verification link is invalid or has expired.", 400, "bad_token")
    user = db.get(User, row.user_id)
    if user is None:
        raise AccountError("This verification link is invalid or has expired.", 400, "bad_token")
    if user.email_verified_at is None:
        user.email_verified_at = _utcnow()
        notify.notify(
            db,
            user.id,
            "account.security",
            "E-mail address confirmed",
            "Your e-mail address is verified. Alerts and password recovery are now active.",
            link="/account",
            email=False,
        )
    return user


def require_verified_email(user: User) -> None:
    if user.email_verified_at is None:
        raise AccountError(
            "Please confirm your e-mail address first (check your inbox for the link).",
            403,
            "email_unverified",
        )


# ---------------------------------------------------------------------------
# Password reset / change
# ---------------------------------------------------------------------------


def send_password_reset(db: Session, email: str) -> None:
    """Always succeeds from the caller's point of view (no account enumeration)."""
    user = db.query(User).filter(func.lower(User.email) == normalize_email(email)).first()
    if user is None or not user.is_active:
        return
    token = issue_token(db, user, "reset_password", RESET_TTL)
    url = mailer.link(f"/reset-password?token={token}")
    mailer.send(
        db,
        to=user.email,
        subject="Reset your MIPAAS password",
        text=(
            f"Hi {display_name(user)},\n\nUse this link to choose a new password:\n{url}\n\n"
            "It is valid for one hour. If you didn't ask for this, ignore this e-mail."
        ),
        html=mailer.html_wrap(
            "Reset your password",
            [
                f"Hi {display_name(user)},",
                "Use the button below to choose a new password. The link is valid for one hour.",
            ],
            ("Choose a new password", url),
        ),
        kind="reset_password",
        user_id=user.id,
    )


def reset_password(db: Session, token: str | None, new_password: str) -> User:
    row = consume_token(db, "reset_password", token)
    if row is None:
        raise AccountError("This reset link is invalid or has expired.", 400, "bad_token")
    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise AccountError("This reset link is invalid or has expired.", 400, "bad_token")
    set_password(user, new_password)
    if user.email_verified_at is None:  # they proved control of the mailbox
        user.email_verified_at = _utcnow()
    revoke_all_sessions(db, user)
    notify.notify(
        db,
        user.id,
        "account.security",
        "Your password was reset",
        "All other sessions were signed out. If this wasn't you, contact support immediately.",
        link="/account",
    )
    return user


def change_password(db: Session, user: User, current: str, new_password: str, keep_token: str | None) -> None:
    if not user.password_hash or not check_password_hash(user.password_hash, current or ""):
        raise AccountError("Your current password is incorrect.", 400, "wrong_password")
    if current == new_password:
        raise AccountError("Choose a password you haven't used before.", 422, "weak_password")
    set_password(user, new_password)
    revoke_other_sessions(db, user, keep_token)
    notify.notify(
        db,
        user.id,
        "account.security",
        "Your password was changed",
        "Other devices were signed out. If this wasn't you, reset your password now.",
        link="/account",
    )


# ---------------------------------------------------------------------------
# Multi-factor authentication (TOTP + recovery codes)
# ---------------------------------------------------------------------------


def mfa_begin_setup(db: Session, user: User) -> tuple[str, str]:
    """Store a fresh (encrypted) secret without enabling MFA; returns (secret, otpauth URI)."""
    secret = security.totp_secret()
    user.mfa_secret_enc = security.encrypt_secret(secret)
    db.flush()
    return secret, security.otpauth_uri(secret, user.email)


def _totp_ok(user: User, code: str) -> bool:
    if not user.mfa_secret_enc:
        return False
    try:
        secret = security.decrypt_secret(user.mfa_secret_enc)
    except Exception:
        return False
    return security.totp_verify(secret, code)


def _recovery_ok(db: Session, user: User, code: str) -> bool:
    cleaned = (code or "").strip().upper().replace("-", "")
    if len(cleaned) < 8:
        return False
    row = (
        db.query(MfaRecoveryCode)
        .filter_by(user_id=user.id, code_hash=security.sha256_hex(cleaned), used_at=None)
        .first()
    )
    if row is None:
        return False
    row.used_at = _utcnow()
    return True


def mfa_check(db: Session, user: User, code: str) -> bool:
    """A TOTP code or an unused recovery code."""
    return _totp_ok(user, code) or _recovery_ok(db, user, code)


def _new_recovery_codes(db: Session, user: User) -> list[str]:
    db.query(MfaRecoveryCode).filter_by(user_id=user.id).delete(synchronize_session=False)
    codes = []
    for _ in range(RECOVERY_CODES):
        raw = security.short_code(10)
        codes.append(f"{raw[:5]}-{raw[5:]}")
        db.add(MfaRecoveryCode(user_id=user.id, code_hash=security.sha256_hex(raw)))
    db.flush()
    return codes


def mfa_enable(db: Session, user: User, code: str) -> list[str]:
    if not user.mfa_secret_enc:
        raise AccountError("Start MFA setup first.", 400, "mfa_not_setup")
    if not _totp_ok(user, code):
        raise AccountError("That code isn't right. Check your authenticator app.", 400, "bad_code")
    user.is_mfa_enabled = True
    user.mfa_enabled_at = _utcnow()
    codes = _new_recovery_codes(db, user)
    notify.notify(
        db,
        user.id,
        "account.security",
        "Two-step verification is on",
        "Sign-ins now need a code from your authenticator app.",
        link="/account",
    )
    return codes


def mfa_disable(db: Session, user: User, password: str, code: str) -> None:
    if not user.password_hash or not check_password_hash(user.password_hash, password or ""):
        raise AccountError("Your password is incorrect.", 400, "wrong_password")
    if not mfa_check(db, user, code):
        raise AccountError("That code isn't right.", 400, "bad_code")
    user.is_mfa_enabled = False
    user.mfa_enabled_at = None
    user.mfa_secret_enc = None
    db.query(MfaRecoveryCode).filter_by(user_id=user.id).delete(synchronize_session=False)
    notify.notify(
        db,
        user.id,
        "account.security",
        "Two-step verification is off",
        "If you didn't turn it off, change your password now.",
        link="/account",
    )


def mfa_regenerate_codes(db: Session, user: User, code: str) -> list[str]:
    if not user.is_mfa_enabled or not _totp_ok(user, code):
        raise AccountError("That code isn't right.", 400, "bad_code")
    return _new_recovery_codes(db, user)


def mfa_challenge(db: Session, user: User, *, remember: bool, client: str) -> str:
    """Password accepted but MFA is on: hand back a short-lived challenge token."""
    return issue_token(
        db, user, "mfa", MFA_CHALLENGE_TTL, {"remember": bool(remember), "client": client}
    )


def mfa_complete(db: Session, token: str | None, code: str) -> tuple[User, dict]:
    row = peek_token(db, "mfa", token)
    if row is None:
        raise AccountError("Your sign-in expired. Please start again.", 401, "challenge_expired")
    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise AccountError("Your sign-in expired. Please start again.", 401, "challenge_expired")
    if not mfa_check(db, user, code):
        raise AccountError("That code isn't right.", 401, "bad_code")
    row.used_at = _utcnow()
    return user, json.loads(row.meta_json or "{}")


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------


def open_session(
    db: Session, user: User, ctx: RequestContext, remember: bool = False, client: str = "web"
) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    now = _utcnow()
    expires_at = now + (REMEMBER_TTL if remember else SESSION_TTL)
    new_device = _is_new_device(db, user, ctx)
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=hash_token(token),
            ip_address=ctx.ip,
            user_agent=(ctx.user_agent or "")[:255] or None,
            client=client[:20],
            last_seen_at=now,
            expires_at=expires_at,
        )
    )
    user.last_login_at = now
    if new_device:
        notify.notify(
            db,
            user.id,
            "account.security",
            "New sign-in to your account",
            f"Signed in from {_device_label(ctx)}. If this wasn't you, change your password and "
            "sign out other devices.",
            link="/account",
            severity="warning",
        )
    return token, expires_at


def _device_label(ctx: RequestContext) -> str:
    ua = (ctx.user_agent or "").lower()
    kind = (
        "a phone"
        if "mobile" in ua or "android" in ua or "iphone" in ua
        else "the desktop app"
        if "mipaas-desktop" in ua or "tauri" in ua
        else "a browser"
    )
    return f"{kind} at {ctx.ip or 'an unknown address'}"


def _is_new_device(db: Session, user: User, ctx: RequestContext) -> bool:
    recent = (
        db.query(UserSession.ip_address, UserSession.user_agent)
        .filter(UserSession.user_id == user.id)
        .order_by(UserSession.created_at.desc())
        .limit(50)
        .all()
    )
    if not recent:
        return False  # first ever sign-in (registration)
    ua = (ctx.user_agent or "")[:255] or None
    return not any(ip == ctx.ip and agent == ua for ip, agent in recent)


def resolve_session(db: Session, token: str | None) -> tuple[User, UserSession] | None:
    if not token:
        return None
    record = db.query(UserSession).filter(UserSession.token_hash == hash_token(token)).first()
    if record is None or record.is_revoked or _as_utc(record.expires_at) <= _utcnow():
        return None
    user = record.user
    if user is None or not user.is_active:
        return None
    # Touch at most every five minutes to keep the write load low at scale.
    now = _utcnow()
    if record.last_seen_at is None or (now - _as_utc(record.last_seen_at)) > timedelta(minutes=5):
        record.last_seen_at = now
    return user, record


def revoke_session(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    record = db.query(UserSession).filter(UserSession.token_hash == hash_token(token)).first()
    if record is None or record.is_revoked:
        return None
    record.is_revoked = True
    return record.user


def revoke_all_sessions(db: Session, user: User) -> int:
    return db.query(UserSession).filter(
        UserSession.user_id == user.id, UserSession.is_revoked.is_(False)
    ).update({UserSession.is_revoked: True}, synchronize_session=False)


def revoke_other_sessions(db: Session, user: User, keep_token: str | None) -> int:
    q = db.query(UserSession).filter(
        UserSession.user_id == user.id, UserSession.is_revoked.is_(False)
    )
    if keep_token:
        q = q.filter(UserSession.token_hash != hash_token(keep_token))
    return q.update({UserSession.is_revoked: True}, synchronize_session=False)


def revoke_session_by_id(db: Session, user: User, session_id: str) -> bool:
    record = db.query(UserSession).filter_by(id=session_id, user_id=user.id).first()
    if record is None or record.is_revoked:
        return False
    record.is_revoked = True
    return True


def list_sessions(db: Session, user: User, current_token: str | None) -> list[dict]:
    now = _utcnow()
    current_hash = hash_token(current_token) if current_token else None
    rows = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id, UserSession.is_revoked.is_(False))
        .order_by(UserSession.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": s.id,
            "client": s.client or "web",
            "ip_address": s.ip_address,
            "user_agent": s.user_agent,
            "created_at": _as_utc(s.created_at).isoformat() if s.created_at else None,
            "last_seen_at": _as_utc(s.last_seen_at).isoformat() if s.last_seen_at else None,
            "expires_at": _as_utc(s.expires_at).isoformat(),
            "current": s.token_hash == current_hash,
        }
        for s in rows
        if _as_utc(s.expires_at) > now
    ]


# ---------------------------------------------------------------------------
# Account deletion (patients)
# ---------------------------------------------------------------------------


def delete_patient_account(db: Session, user: User, password: str, code: str | None) -> str:
    """Permanently erase a patient's account and everything stored under it.

    The database removes the dependent rows (profile, logs, medicines, documents, X-rays,
    care links with their messages and consultations, sessions, notifications) through the
    ``ON DELETE CASCADE`` foreign keys. The caller deletes the files afterwards, using the
    returned user id. Audit rows are kept without the user reference.

    Clinician and staff accounts are not self-service: signed reports they authored are part
    of other people's medical records and have retention rules of their own.
    """
    from app.database.models.care import CareLink

    if role_of(user) != Role.PATIENT:
        raise AccountError(
            "Clinician and staff accounts can't be deleted here. Contact support to close yours.",
            409,
            "not_self_service",
        )
    if not user.password_hash or not check_password_hash(user.password_hash, password or ""):
        raise AccountError("Your password is incorrect.", 400, "wrong_password")
    if user.is_mfa_enabled and not mfa_check(db, user, code or ""):
        raise AccountError("That code isn't right.", 400, "bad_code")

    name = display_name(user)
    for link in db.query(CareLink).filter_by(patient_id=user.id, status="active").all():
        notify.notify(
            db,
            link.doctor_id,
            "care.accepted",
            f"{name} closed their MIPAAS account",
            "Their shared record and your messages with them have been removed.",
            link="/doctor/patients",
        )
    user_id = user.id
    db.delete(user)
    db.flush()
    return user_id


# ---------------------------------------------------------------------------
# Doctor verification (administrators)
# ---------------------------------------------------------------------------


def ensure_share_code(db: Session, profile: ClinicianProfile) -> str:
    if profile.share_code:
        return profile.share_code
    while True:
        code = security.short_code(6, "DR-")
        if not db.query(ClinicianProfile.id).filter_by(share_code=code).first():
            profile.share_code = code
            db.flush()
            return code


def pending_doctors(db: Session) -> list[tuple[User, ClinicianProfile]]:
    rows = (
        db.query(User, ClinicianProfile)
        .join(ClinicianProfile, ClinicianProfile.user_id == User.id)
        .filter(User.role == Role.DOCTOR_PENDING.value)
        .order_by(User.created_at)
        .all()
    )
    return [(u, p) for u, p in rows]


def verify_doctor(db: Session, user: User, *, by: str, note: str | None = None) -> ClinicianProfile:
    profile = clinician_profile(db, user.id)
    if profile is None:
        raise AccountError("This account has no clinician profile.", 400, "not_clinician")
    if role_of(user) == Role.DOCTOR_PENDING:
        user.role = Role.DOCTOR.value
    profile.verified_at = _utcnow()
    profile.verified_by = by[:255]
    profile.rejected_at = None
    profile.rejection_reason = None
    if profile.listed is None:
        profile.listed = True
    ensure_share_code(db, profile)
    revoke_all_sessions(db, user)  # permissions changed: make them sign in again
    notify.notify(
        db,
        user.id,
        "account.verification",
        "Your doctor account is verified",
        "Clinical tools are unlocked. Sign in again to open the doctor workstation"
        + (f". Note from the reviewer: {note}" if note else "."),
        link="/doctor",
        email_cta="Open the workstation",
    )
    return profile


def reject_doctor(db: Session, user: User, *, by: str, reason: str) -> ClinicianProfile:
    profile = clinician_profile(db, user.id)
    if profile is None:
        raise AccountError("This account has no clinician profile.", 400, "not_clinician")
    reason = (reason or "").strip()[:500]
    if len(reason) < 3:
        raise AccountError("Give the applicant a reason.", 422, "invalid_reason")
    profile.rejected_at = _utcnow()
    profile.rejection_reason = reason
    profile.verified_by = by[:255]
    notify.notify(
        db,
        user.id,
        "account.verification",
        "We couldn't verify your medical registration",
        f"Reason: {reason}. Update your details from your account page and we'll look again.",
        link="/account",
        severity="warning",
    )
    return profile


def resubmit_license(db: Session, user: User, license_number: str, specialty: str) -> None:
    profile = clinician_profile(db, user.id)
    if profile is None or role_of(user) != Role.DOCTOR_PENDING:
        raise AccountError("Only pending doctor accounts can update their licence.", 403)
    license_number = (license_number or "").strip()
    specialty = (specialty or "").strip()
    if not 3 <= len(license_number) <= 100:
        raise AccountError("Enter your medical registration / licence number.", 422, "invalid_license")
    if not 2 <= len(specialty) <= 120:
        raise AccountError("Enter your specialty.", 422, "invalid_specialty")
    profile.license_number = license_number
    profile.specialty = specialty
    profile.rejected_at = None
    profile.rejection_reason = None
