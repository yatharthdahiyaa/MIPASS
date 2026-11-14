"""
IAM, security and notification models for the MIPAAS central database.

Users, sessions and the audit trail; single-use auth tokens (email verification,
password reset, MFA challenges); MFA recovery codes; in-app notifications with
per-user channel preferences; and the e-mail outbox every message is written to.
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import relationship

from app.database.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """Central User model for patients, clinicians, researchers and administrators."""

    __tablename__ = "users"

    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    role = Column(String(50), nullable=False, default="technician", index=True)
    # No defaults: a blank stays blank rather than showing a hospital the person never named.
    department = Column(String(100), nullable=True)
    organization = Column(String(150), nullable=True)
    avatar = Column(String(500), nullable=True)
    phone = Column(String(30), nullable=True)
    locale = Column(String(10), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_mfa_enabled = Column(Boolean, default=False, nullable=False)
    # Set when the address was confirmed through a verification link.
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    # TOTP secret, Fernet-encrypted with MFA_ENCRYPTION_KEY (never stored in clear).
    mfa_secret_enc = Column(Text, nullable=True)
    mfa_enabled_at = Column(DateTime(timezone=True), nullable=True)
    # When the user allowed their health data to be processed by an outside AI model (None = not allowed).
    ai_consent_at = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username} role={self.role}>"


class Role(Base, TimestampMixin):
    """System and custom RBAC roles (the code in ``services.rbac`` is authoritative)."""

    __tablename__ = "roles"

    name = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=True, nullable=False)
    permissions_json = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Role id={self.id} name={self.name}>"


class UserSession(Base, TimestampMixin):
    """Active user authentication sessions (only the token's SHA-256 is stored)."""

    __tablename__ = "user_sessions"

    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash = Column(String(255), unique=True, nullable=False, index=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    client = Column(String(20), nullable=True)  # web, desktop
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="sessions")

    def __repr__(self) -> str:
        return f"<UserSession id={self.id} user_id={self.user_id}>"


class AuthToken(Base, TimestampMixin):
    """Single-use, time-limited token (hashed) for e-mail verification, password reset, MFA."""

    __tablename__ = "auth_tokens"

    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    purpose = Column(String(30), nullable=False, index=True)  # verify_email, reset_password, mfa
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    meta_json = Column(Text, nullable=True)

    __table_args__ = (Index("ix_auth_tokens_user_purpose", "user_id", "purpose"),)


class MfaRecoveryCode(Base, TimestampMixin):
    """One-time MFA backup code (hashed)."""

    __tablename__ = "mfa_recovery_codes"

    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code_hash = Column(String(64), nullable=False, index=True)
    used_at = Column(DateTime(timezone=True), nullable=True)


class Notification(Base, TimestampMixin):
    """An in-app alert for one user. ``kind`` groups them for preferences and filtering."""

    __tablename__ = "notifications"

    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind = Column(String(40), nullable=False, index=True)
    severity = Column(String(10), nullable=False, default="info")  # info, warning, critical
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=True)
    link = Column(String(300), nullable=True)  # in-app path, e.g. /patient/care
    read_at = Column(DateTime(timezone=True), nullable=True)
    emailed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_notifications_user_read", "user_id", "read_at"),)


class NotificationPreference(Base, TimestampMixin):
    """Per-user channel switches, stored as JSON {kind: {"email": bool}}."""

    __tablename__ = "notification_preferences"

    user_id = Column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    prefs_json = Column(Text, nullable=False, default="{}")


class EmailOutbox(Base, TimestampMixin):
    """Every e-mail the platform produced, with delivery status (also the dev inbox)."""

    __tablename__ = "email_outbox"

    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    to_address = Column(String(255), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    text_body = Column(Text, nullable=False)
    html_body = Column(Text, nullable=True)
    kind = Column(String(40), nullable=True, index=True)
    status = Column(String(20), nullable=False, default="queued")  # queued, sent, failed, outbox
    error = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)


class AuditLog(Base, TimestampMixin):
    """HIPAA and operational audit log for compliance."""

    __tablename__ = "audit_logs"

    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    username = Column(String(100), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)
    resource_id = Column(String(100), nullable=True, index=True)
    status = Column(String(50), default="success", nullable=False)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    details_json = Column(Text, nullable=True)

    user = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_logs_action_created", "action", "created_at"),
        Index("ix_audit_logs_resource", "resource_type", "resource_id"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} action={self.action} status={self.status}>"
