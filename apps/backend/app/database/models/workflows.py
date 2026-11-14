"""
Clinician workflow tables: worklist cases, finding reviews, report signatures, pseudonymous
consent, integration settings and webhook subscriptions.
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.database.models.base import Base, TimestampMixin


class WorklistCase(Base, TimestampMixin):
    """A case waiting for clinician review, with its AI findings (as JSON)."""

    __tablename__ = "worklist_cases"

    case_id = Column(String(64), unique=True, nullable=False, index=True)
    pseudonym_id = Column(String(64), nullable=False, index=True)
    patient_name_masked = Column(String(120), nullable=True)
    age_gender = Column(String(20), nullable=True)
    modality = Column(String(20), nullable=False)
    study_description = Column(String(255), nullable=True)
    priority = Column(String(20), nullable=False, index=True)  # STAT, URGENT, ROUTINE
    critical_finding = Column(String(100), nullable=True)
    sla_deadline = Column(String(40), nullable=True)
    sla_duration_min = Column(Integer, nullable=True)
    acknowledged = Column(Boolean, default=False, nullable=False)
    acknowledged_by = Column(String(64), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    findings_json = Column(Text, nullable=False, default="[]")


class FindingReview(Base, TimestampMixin):
    """A clinician's accept / edit / reject decision on one AI finding."""

    __tablename__ = "finding_reviews"

    case_id = Column(
        String(64),
        ForeignKey("worklist_cases.case_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    finding_id = Column(String(64), nullable=False)
    action = Column(String(20), nullable=False)  # ACCEPT, EDIT, REJECT
    override_reason = Column(String(100), nullable=True)
    doctor_notes = Column(Text, nullable=True)
    reviewer_id = Column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )


class ReportSignature(Base, TimestampMixin):
    """A recorded e-signature: who signed which case, with the licence used and a content hash."""

    __tablename__ = "report_signatures"

    case_id = Column(String(64), nullable=False, index=True)
    signed_by = Column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    doctor_name = Column(String(150), nullable=False)
    license_number = Column(String(100), nullable=False)
    report_sha256 = Column(String(64), nullable=False)
    signature = Column(String(40), nullable=False, unique=True)


class PseudonymConsent(Base, TimestampMixin):
    """Purpose-specific consent for one pseudonymous patient. Absent rows mean nothing is granted."""

    __tablename__ = "pseudonym_consents"

    pseudonym_id = Column(String(64), unique=True, nullable=False, index=True)
    consents_json = Column(Text, nullable=False, default="{}")


class IntegrationSetting(Base, TimestampMixin):
    """Configuration for an external system (pacs, hl7, fhir). Absent means not configured."""

    __tablename__ = "integration_settings"

    key = Column(String(50), unique=True, nullable=False, index=True)
    config_json = Column(Text, nullable=False, default="{}")


class WebhookSubscription(Base, TimestampMixin):
    """An event subscription. Only a hash of the signing secret is stored."""

    __tablename__ = "webhook_subscriptions"

    owner_id = Column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    url = Column(String(500), nullable=False)
    events_json = Column(Text, nullable=False)
    secret_sha256 = Column(String(64), nullable=False)
    active = Column(Boolean, default=True, nullable=False)
