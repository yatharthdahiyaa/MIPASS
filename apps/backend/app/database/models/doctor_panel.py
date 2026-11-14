"""
Doctor diagnostic panel tables (used by the web workstation and the desktop app).

A ``DoctorStudy`` is an imaging study a verified doctor uploaded (any modality
with a registered analyser, see ``app.services.study_analysis``), the AI result
computed from it, and the doctor's own report. Patient details are whatever
the doctor typed or what the DICOM header actually contained; nothing is seeded.
"""

from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, String, Text

from app.database.models.base import Base, TimestampMixin


class DoctorStudy(Base, TimestampMixin):
    __tablename__ = "doctor_studies"

    # The doctor who owns the study (named user_id so the shared X-ray analyser can store files per owner).
    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Patient details entered by the doctor or read from real DICOM tags.
    patient_ref = Column(String(120), nullable=True)  # MRN / hospital ID
    patient_name = Column(String(150), nullable=True)
    patient_age = Column(Integer, nullable=True)
    patient_sex = Column(String(20), nullable=True)
    clinical_notes = Column(Text, nullable=True)  # indication / history
    study_date = Column(Date, nullable=True)

    # Upload
    original_filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False)
    storage_path = Column(String(500), nullable=False)
    preview_path = Column(String(500), nullable=True)
    heatmap_path = Column(String(500), nullable=True)

    # Which analyser handles the study (``study_analysis`` registry id) and its modality.
    analyzer_id = Column(String(60), nullable=True, index=True)
    modality = Column(String(30), nullable=True)

    # AI result
    status = Column(
        String(20), nullable=False, default="processing"
    )  # processing, pending (no model installed yet), completed, failed
    error = Column(Text, nullable=True)
    primary_finding = Column(String(100), nullable=True)
    severity = Column(String(20), nullable=True, index=True)
    model_name = Column(String(100), nullable=True)
    findings_json = Column(Text, nullable=True)
    analyzed_at = Column(DateTime(timezone=True), nullable=True)

    # When the study belongs to a patient who has a care link with this doctor, the signed
    # report is visible in that patient's portal.
    patient_user_id = Column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    shared_with_patient_at = Column(DateTime(timezone=True), nullable=True)

    # Doctor's report
    impression = Column(Text, nullable=True)
    report_status = Column(String(10), nullable=False, default="draft", index=True)  # draft, signed
    signed_at = Column(DateTime(timezone=True), nullable=True)
    signed_by = Column(String(150), nullable=True)

    __table_args__ = (Index("ix_doctor_studies_owner_created", "user_id", "created_at"),)
