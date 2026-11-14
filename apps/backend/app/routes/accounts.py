"""
Account routes backed by the central database.

Sign-up / sign-in
    POST /auth/register                 create an account, sign in, send the verification e-mail
    POST /auth/login                    email (or username) + password [+ mfa_code]
                                        -> session, or {mfa_required, mfa_token} when MFA is on
    POST /auth/mfa/verify               {mfa_token, code} completes a sign-in
    POST /auth/logout                   revoke the current session
    GET  /auth/session                  current user or authenticated=false (never 401)
    PATCH /auth/profile                 name, phone, organisation, locale; doctors: specialty, bio, listed
    DELETE /auth/account                {password, code?} patients only: erase the account and its data

E-mail verification and passwords
    POST /auth/verify-email/request     resend the verification link
    POST /auth/verify-email/confirm     {token}
    POST /auth/password/forgot          {email}      always 200
    POST /auth/password/reset           {token, password}
    POST /auth/password/change          {current_password, new_password}  (signs out other devices)

Two-step verification (TOTP)
    GET  /auth/mfa                      status
    POST /auth/mfa/setup                -> {secret, otpauth_uri}
    POST /auth/mfa/enable               {code} -> {recovery_codes}
    POST /auth/mfa/disable              {password, code}
    POST /auth/mfa/recovery-codes       {code} -> fresh recovery codes

Devices
    GET  /auth/sessions                 active sessions
    DELETE /auth/sessions/<id>
    POST /auth/sessions/revoke-others

Doctors awaiting verification
    POST /auth/license                  {license_number, specialty} resubmit after a rejection

    POST /audit/events                  record a client-side clinical action for the signed-in user

The session token travels in an HttpOnly, SameSite=Lax cookie (web) or as a bearer token (desktop).
"""

import json

import structlog
from flask import Blueprint, current_app, g, make_response, request

from app.database.session import get_db
from app.middleware.auth_middleware import get_authenticated_user
from app.services import accounts, events
from app.services.security import LIMITS, get_rate_limiter
from app.utils.response import api_error, api_response

logger = structlog.get_logger()
accounts_bp = Blueprint("accounts", __name__)


def _ctx() -> accounts.RequestContext:
    # remote_addr only: X-Forwarded-For is client-controlled unless a trusted proxy
    # (TRUST_PROXY=1 enables ProxyFix) rewrites it.
    return accounts.RequestContext(
        ip=request.remote_addr, user_agent=request.headers.get("User-Agent")
    )


def _session_token() -> str | None:
    token = request.cookies.get(accounts.SESSION_COOKIE)
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    return auth[7:].strip() if auth.startswith("Bearer ") else None


def _json() -> dict:
    return request.get_json(silent=True) or {}


def _throttled(scope: str, identity: str):
    """429 response when the limiter says to wait, else None."""
    wait = get_rate_limiter().hit(scope, identity, LIMITS[scope])
    if not wait:
        return None
    response = make_response(
        *api_error("Too many attempts. Please wait a few minutes and try again.", 429, "locked")
    )
    response.headers["Retry-After"] = str(wait)
    return response


def _with_session_cookie(payload: dict, status: int, token: str, remember: bool):
    response = make_response(*api_response(payload, status))
    response.set_cookie(
        accounts.SESSION_COOKIE,
        token,
        # "Remember me" persists the cookie; otherwise it is a browser-session cookie.
        # Either way the server-side expiry in user_sessions is authoritative.
        max_age=int(accounts.REMEMBER_TTL.total_seconds()) if remember else None,
        httponly=True,
        secure=not (current_app.debug or current_app.testing),
        samesite="Lax",
        path="/",
    )
    return response


def _signed_in(db, user, ctx, *, remember: bool, client: str):
    """Open the session and build the right response for a web or desktop client."""
    token, expires_at = accounts.open_session(db, user, ctx, remember=remember, client=client)
    accounts.record_audit(
        db, "auth.login", ctx, user=user, details_json=json.dumps({"client": client})
    )
    payload = {"user": accounts.serialize_user(user, db), "expires_at": expires_at.isoformat()}
    if client == "desktop":
        # Native client: the token goes in the body (held only in the app's Rust process); no cookie.
        payload["token"] = token
        return api_response(payload)
    return _with_session_cookie(payload, 200, token, remember=remember)


def _require_user():
    user = get_authenticated_user()
    if user is None:
        return None, api_error("Please sign in.", 401, "unauthenticated")
    return user, None


def _db_user(db):
    from app.database.models.iam import User

    return db.get(User, g.current_user.id)


# ---------------------------------------------------------------------------
# Sign-up / sign-in
# ---------------------------------------------------------------------------


@accounts_bp.route("/auth/register", methods=["POST"])
def register():
    data = _json()
    ctx = _ctx()
    if (blocked := _throttled("register_ip", ctx.ip or "")) is not None:
        return blocked
    try:
        with get_db() as db:
            user = accounts.create_account(
                db,
                name=data.get("name", ""),
                email=data.get("email", ""),
                password=data.get("password", ""),
                organization=data.get("organization"),
                account_type=data.get("account_type", "patient"),
                license_number=data.get("license_number"),
                specialty=data.get("specialty"),
                phone=data.get("phone"),
                locale=data.get("locale"),
            )
            token, expires_at = accounts.open_session(db, user, ctx, client="web")
            accounts.record_audit(db, "auth.register", ctx, user=user)
            accounts.send_verification_email(db, user)
            payload = {
                "user": accounts.serialize_user(user, db),
                "expires_at": expires_at.isoformat(),
                "verification_email_sent": True,
            }
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)

    logger.info("account_registered", user_id=payload["user"]["id"])
    return _with_session_cookie(payload, 201, token, remember=False)


@accounts_bp.route("/auth/login", methods=["POST"])
def login():
    data = _json()
    identifier = (data.get("identifier") or data.get("email") or "").strip()
    password = data.get("password") or ""
    remember = bool(data.get("remember"))
    client = "desktop" if data.get("client") == "desktop" else "web"
    ctx = _ctx()

    if not identifier or not password:
        return api_error("Enter your email and password.", 422, "missing_credentials")

    limiter = get_rate_limiter()
    identity = f"{identifier.lower()}|{ctx.ip or ''}"
    if (blocked := _throttled("login", identity)) is not None:
        return blocked

    with get_db() as db:
        user = accounts.authenticate(db, identifier, password)
        if user is None:
            accounts.record_audit(
                db, "auth.login", ctx, username=identifier[:100], status="failure"
            )
            return api_error("Incorrect email or password.", 401, "invalid_credentials")
        if not user.is_active:
            accounts.record_audit(db, "auth.login", ctx, user=user, status="denied")
            return api_error(
                "This account has been deactivated. Contact your administrator.", 403, "inactive"
            )

        if client == "desktop" and accounts.role_of(user) not in accounts.DESKTOP_ROLES:
            accounts.record_audit(
                db, "auth.login", ctx, user=user, status="denied",
                details_json='{"client": "desktop"}',
            )
            if accounts.role_of(user) == accounts.Role.DOCTOR_PENDING:
                return api_error(
                    "Your doctor account is still being verified.", 403, "verification_pending"
                )
            return api_error(
                "The diagnostic panel is for verified doctors only.", 403, "not_clinician"
            )

        limiter.reset("login", identity)

        if user.is_mfa_enabled:
            code = str(data.get("mfa_code") or "").strip()
            if code:
                if not accounts.mfa_check(db, user, code):
                    accounts.record_audit(
                        db, "auth.mfa", ctx, user=user, status="failure"
                    )
                    return api_error("That code isn't right.", 401, "bad_code")
            else:
                challenge = accounts.mfa_challenge(db, user, remember=remember, client=client)
                return api_response(
                    {
                        "mfa_required": True,
                        "mfa_token": challenge,
                        "expires_in": int(accounts.MFA_CHALLENGE_TTL.total_seconds()),
                    }
                )

        return _signed_in(db, user, ctx, remember=remember, client=client)


@accounts_bp.route("/auth/mfa/verify", methods=["POST"])
def mfa_verify():
    data = _json()
    ctx = _ctx()
    token = str(data.get("mfa_token") or "")
    if (blocked := _throttled("mfa_verify", f"{token[:16]}|{ctx.ip or ''}")) is not None:
        return blocked
    try:
        with get_db() as db:
            user, meta = accounts.mfa_complete(db, token, str(data.get("code") or ""))
            accounts.record_audit(db, "auth.mfa", ctx, user=user)
            return _signed_in(
                db, user, ctx, remember=bool(meta.get("remember")), client=meta.get("client") or "web"
            )
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)


@accounts_bp.route("/auth/logout", methods=["POST"])
def logout():
    ctx = _ctx()
    with get_db() as db:
        user = accounts.revoke_session(db, _session_token())
        if user is not None:
            accounts.record_audit(db, "auth.logout", ctx, user=user)

    response = make_response(*api_response({"signed_out": True}))
    response.delete_cookie(accounts.SESSION_COOKIE, path="/", samesite="Lax")
    return response


@accounts_bp.route("/auth/session", methods=["GET"])
def session_info():
    with get_db() as db:
        resolved = accounts.resolve_session(db, _session_token())
        if resolved is None:
            return api_response({"authenticated": False, "user": None})
        user, record = resolved
        return api_response(
            {
                "authenticated": True,
                "user": accounts.serialize_user(user, db),
                "expires_at": accounts._as_utc(record.expires_at).isoformat(),
            }
        )


@accounts_bp.route("/auth/profile", methods=["PATCH"])
def update_profile():
    user, denied = _require_user()
    if denied:
        return denied
    data = _json()
    try:
        with get_db() as db:
            row = _db_user(db)
            accounts.update_profile(db, row, data)
            accounts.record_audit(
                db, "auth.profile.update", _ctx(), user=row,
                details_json=json.dumps({"fields": sorted(data.keys())[:20]}),
            )
            return api_response({"user": accounts.serialize_user(row, db)})
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)


@accounts_bp.route("/auth/account", methods=["DELETE"])
def delete_account():
    user, denied = _require_user()
    if denied:
        return denied
    if (blocked := _throttled("login", f"delete|{user.id}")) is not None:
        return blocked
    data = _json()
    ctx = _ctx()
    try:
        with get_db() as db:
            row = _db_user(db)
            username = row.username
            user_id = accounts.delete_patient_account(db, row, data.get("password") or "", data.get("code"))
            accounts.record_audit(db, "auth.account.delete", ctx, username=username, resource_id=user_id)
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)

    # The rows are gone (committed above); now the files. A failure here leaves orphaned
    # files, never a half-deleted account, and is logged for clean-up.
    try:
        from app.services.patient_ehr import FileStore

        FileStore(current_app.config["PATIENT_FILES_DIR"]).delete_user(user_id)
    except Exception as exc:  # pragma: no cover - filesystem dependent
        logger.error("account_files_not_removed", user_id=user_id, error=str(exc))
    events.forget(user_id)
    logger.info("account_deleted", user_id=user_id)
    response = make_response(*api_response({"deleted": True}))
    response.delete_cookie(accounts.SESSION_COOKIE, path="/", samesite="Lax")
    return response


# ---------------------------------------------------------------------------
# E-mail verification
# ---------------------------------------------------------------------------


@accounts_bp.route("/auth/verify-email/request", methods=["POST"])
def verify_email_request():
    user, denied = _require_user()
    if denied:
        return denied
    if (blocked := _throttled("verify_request", user.id)) is not None:
        return blocked
    with get_db() as db:
        row = _db_user(db)
        if row.email_verified_at is not None:
            return api_response({"sent": False, "already_verified": True})
        accounts.send_verification_email(db, row)
        accounts.record_audit(db, "auth.verify_email.request", _ctx(), user=row)
    return api_response({"sent": True})


@accounts_bp.route("/auth/verify-email/confirm", methods=["POST"])
def verify_email_confirm():
    token = str(_json().get("token") or "")
    try:
        with get_db() as db:
            user = accounts.confirm_email(db, token)
            accounts.record_audit(db, "auth.verify_email.confirm", _ctx(), user=user)
            return api_response({"verified": True, "user": accounts.serialize_user(user, db)})
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------


@accounts_bp.route("/auth/password/forgot", methods=["POST"])
def password_forgot():
    email = accounts.normalize_email(str(_json().get("email") or ""))
    ctx = _ctx()
    if not email:
        return api_error("Enter your e-mail address.", 422, "invalid_email")
    if (blocked := _throttled("password_forgot", f"{email}|{ctx.ip or ''}")) is not None:
        return blocked
    with get_db() as db:
        accounts.send_password_reset(db, email)
        accounts.record_audit(db, "auth.password.forgot", ctx, username=email[:100])
    # Same answer whether or not the address exists.
    return api_response({"sent": True})


@accounts_bp.route("/auth/password/reset", methods=["POST"])
def password_reset():
    data = _json()
    ctx = _ctx()
    try:
        with get_db() as db:
            user = accounts.reset_password(db, str(data.get("token") or ""), data.get("password") or "")
            accounts.record_audit(db, "auth.password.reset", ctx, user=user)
            token, expires_at = accounts.open_session(db, user, ctx, client="web")
            payload = {"user": accounts.serialize_user(user, db), "expires_at": expires_at.isoformat()}
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)
    return _with_session_cookie(payload, 200, token, remember=False)


@accounts_bp.route("/auth/password/change", methods=["POST"])
def password_change():
    user, denied = _require_user()
    if denied:
        return denied
    data = _json()
    try:
        with get_db() as db:
            row = _db_user(db)
            accounts.change_password(
                db, row, data.get("current_password") or "", data.get("new_password") or "", _session_token()
            )
            accounts.record_audit(db, "auth.password.change", _ctx(), user=row)
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)
    return api_response({"changed": True})


# ---------------------------------------------------------------------------
# MFA
# ---------------------------------------------------------------------------


@accounts_bp.route("/auth/mfa", methods=["GET"])
def mfa_status():
    user, denied = _require_user()
    if denied:
        return denied
    with get_db() as db:
        row = _db_user(db)
        from app.database.models.iam import MfaRecoveryCode

        remaining = (
            db.query(MfaRecoveryCode).filter_by(user_id=row.id, used_at=None).count()
            if row.is_mfa_enabled
            else 0
        )
        return api_response(
            {
                "enabled": bool(row.is_mfa_enabled),
                "enabled_at": row.mfa_enabled_at.isoformat() if row.mfa_enabled_at else None,
                "recovery_codes_left": remaining,
            }
        )


@accounts_bp.route("/auth/mfa/setup", methods=["POST"])
def mfa_setup():
    user, denied = _require_user()
    if denied:
        return denied
    with get_db() as db:
        row = _db_user(db)
        if row.is_mfa_enabled:
            return api_error("Two-step verification is already on.", 409, "mfa_enabled")
        secret, uri = accounts.mfa_begin_setup(db, row)
        return api_response({"secret": secret, "otpauth_uri": uri})


@accounts_bp.route("/auth/mfa/enable", methods=["POST"])
def mfa_enable():
    user, denied = _require_user()
    if denied:
        return denied
    try:
        with get_db() as db:
            row = _db_user(db)
            codes = accounts.mfa_enable(db, row, str(_json().get("code") or ""))
            accounts.record_audit(db, "auth.mfa.enable", _ctx(), user=row)
            return api_response({"enabled": True, "recovery_codes": codes})
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)


@accounts_bp.route("/auth/mfa/disable", methods=["POST"])
def mfa_disable():
    user, denied = _require_user()
    if denied:
        return denied
    data = _json()
    try:
        with get_db() as db:
            row = _db_user(db)
            accounts.mfa_disable(db, row, data.get("password") or "", str(data.get("code") or ""))
            accounts.record_audit(db, "auth.mfa.disable", _ctx(), user=row)
            return api_response({"enabled": False})
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)


@accounts_bp.route("/auth/mfa/recovery-codes", methods=["POST"])
def mfa_recovery_codes():
    user, denied = _require_user()
    if denied:
        return denied
    try:
        with get_db() as db:
            row = _db_user(db)
            codes = accounts.mfa_regenerate_codes(db, row, str(_json().get("code") or ""))
            accounts.record_audit(db, "auth.mfa.recovery_codes", _ctx(), user=row)
            return api_response({"recovery_codes": codes})
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)


# ---------------------------------------------------------------------------
# Sessions / devices
# ---------------------------------------------------------------------------


@accounts_bp.route("/auth/sessions", methods=["GET"])
def list_sessions():
    user, denied = _require_user()
    if denied:
        return denied
    with get_db() as db:
        return api_response({"sessions": accounts.list_sessions(db, _db_user(db), _session_token())})


@accounts_bp.route("/auth/sessions/<session_id>", methods=["DELETE"])
def revoke_session(session_id):
    user, denied = _require_user()
    if denied:
        return denied
    with get_db() as db:
        row = _db_user(db)
        ok = accounts.revoke_session_by_id(db, row, session_id)
        if ok:
            accounts.record_audit(db, "auth.session.revoke", _ctx(), user=row, resource_id=session_id)
    return api_response({"revoked": ok}) if ok else api_error("Session not found.", 404)


@accounts_bp.route("/auth/sessions/revoke-others", methods=["POST"])
def revoke_other_sessions():
    user, denied = _require_user()
    if denied:
        return denied
    with get_db() as db:
        row = _db_user(db)
        count = accounts.revoke_other_sessions(db, row, _session_token())
        accounts.record_audit(db, "auth.session.revoke_others", _ctx(), user=row)
    return api_response({"revoked": int(count or 0)})


# ---------------------------------------------------------------------------
# Doctor licence resubmission
# ---------------------------------------------------------------------------


@accounts_bp.route("/auth/license", methods=["POST"])
def resubmit_license():
    user, denied = _require_user()
    if denied:
        return denied
    data = _json()
    try:
        with get_db() as db:
            row = _db_user(db)
            accounts.resubmit_license(db, row, data.get("license_number") or "", data.get("specialty") or "")
            accounts.record_audit(db, "auth.license.resubmit", _ctx(), user=row)
            return api_response({"user": accounts.serialize_user(row, db)})
    except accounts.AccountError as exc:
        return api_error(exc.message, exc.status, exc.code)


# ---------------------------------------------------------------------------
# Client-side audit events
# ---------------------------------------------------------------------------


@accounts_bp.route("/audit/events", methods=["POST"])
def audit_event():
    data = _json()
    action = str(data.get("action") or "").strip()[:100]
    resource = str(data.get("resource") or "").strip()[:100]
    decision = data.get("decision") if data.get("decision") in ("allow", "deny") else "allow"
    if not action:
        return api_error("Missing 'action'.", 422, "invalid_request")

    ctx = _ctx()
    with get_db() as db:
        resolved = accounts.resolve_session(db, _session_token())
        if resolved is None:
            return api_error("Sign in to record clinical actions.", 401, "unauthenticated")
        user, _ = resolved
        resource_type, _, resource_id = resource.partition(":")
        details = data.get("details")
        accounts.record_audit(
            db,
            action,
            ctx,
            user=user,
            status="success" if decision == "allow" else "denied",
            resource_type=resource_type or "client",
            resource_id=resource_id or None,
            details_json=json.dumps(details)[:4000] if isinstance(details, dict) else None,
        )
    return api_response({"recorded": True}, 201)
