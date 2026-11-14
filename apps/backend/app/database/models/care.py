"""
Doctor <-> patient connection tables.

* ``care_links``        a consented relationship between one patient and one verified doctor,
                        with the record scopes the patient has shared.
* ``care_messages``     secure messages inside a care link (either party can write).
* ``clinician_reviews`` a doctor's written review of something in the patient's record
                        (today: a patient-uploaded X-ray and its AI screening).
* ``consult_requests``  a consultation the patient asked for and the doctor schedules.

Nothing here is seeded; every row comes from a real action by a patient or a doctor.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text, UniqueConstraint

from app.database.models.base import Base, TimestampMixin

LINK_STATUSES = ("pending", "active", "declined", "revoked")
# Record areas a patient can share with a doctor.
CARE_SCOPES = ("profile", "vitals", "medications", "documents", "xrays")
CONSULT_STATUSES = ("requested", "scheduled", "declined", "completed", "cancelled")
CONSULT_MODES = ("video", "in_person", "chat")


class CareLink(Base, TimestampMixin):
    __tablename__ = "care_links"

    patient_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status = Column(String(12), nullable=False, default="pending", index=True)
    # Who created the invitation: "patient" or "doctor"; the other party must accept.
    requested_by = Column(String(10), nullable=False)
    scopes_json = Column(Text, nullable=False, default="[]")
    message = Column(String(500), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    ended_by = Column(String(10), nullable=True)

    __table_args__ = (
        UniqueConstraint("patient_id", "doctor_id", name="uq_care_link_pair"),
        Index("ix_care_links_doctor_status", "doctor_id", "status"),
        Index("ix_care_links_patient_status", "patient_id", "status"),
    )


class CareMessage(Base, TimestampMixin):
    __tablename__ = "care_messages"

    link_id = Column(
        String(64), ForeignKey("care_links.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id = Column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    body = Column(Text, nullable=False)
    # Optional pointer to something in the record: xray_study, document, doctor_study, consult.
    ref_type = Column(String(20), nullable=True)
    ref_id = Column(String(64), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_care_messages_link_created", "link_id", "created_at"),)


class ClinicianReview(Base, TimestampMixin):
    __tablename__ = "clinician_reviews"

    link_id = Column(
        String(64), ForeignKey("care_links.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id = Column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    patient_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_type = Column(String(20), nullable=False)  # xray_study
    target_id = Column(String(64), nullable=False, index=True)
    impression = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=True)
    urgency = Column(String(12), nullable=False, default="routine")  # routine, soon, urgent
    doctor_name = Column(String(150), nullable=True)

    __table_args__ = (Index("ix_clinician_reviews_target", "target_type", "target_id"),)


class ConsultRequest(Base, TimestampMixin):
    __tablename__ = "consult_requests"

    link_id = Column(
        String(64), ForeignKey("care_links.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status = Column(String(12), nullable=False, default="requested", index=True)
    mode = Column(String(12), nullable=False, default="video")
    reason = Column(Text, nullable=False)
    preferred_at = Column(DateTime(timezone=True), nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    doctor_note = Column(Text, nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_consults_doctor_status", "doctor_id", "status"),)
