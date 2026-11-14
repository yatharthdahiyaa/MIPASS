"""
Patient-owned electronic health record (EHR) tables.

Every row belongs to exactly one ``users.id`` with role ``patient`` and is only
ever created from that patient's own input (forms and uploads). Nothing here is
seeded. Uploaded files live on disk under ``PATIENT_FILES_DIR``; the rows keep
their relative path, size and SHA-256.
"""

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from app.database.models.base import Base, TimestampMixin


def _owner():
    return Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )


class ClinicianProfile(Base, TimestampMixin):
    """Professional details a doctor submits at sign-up; verified by an administrator."""

    __tablename__ = "clinician_profiles"

    user_id = Column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    license_number = Column(String(100), nullable=False)
    specialty = Column(String(120), nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(String(255), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(String(500), nullable=True)
    # Short code patients can type to connect with this doctor (e.g. "DR-7K3M2Q").
    share_code = Column(String(12), unique=True, nullable=True, index=True)
    # Whether the doctor appears in the patient-facing directory.
    listed = Column(Boolean, nullable=True)
    bio = Column(Text, nullable=True)
    years_experience = Column(Integer, nullable=True)
    consult_modes_json = Column(Text, nullable=True)  # JSON list of consult modes offered


class PatientProfile(Base, TimestampMixin):
    """Baseline health profile (one per patient)."""

    __tablename__ = "patient_profiles"

    user_id = Column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    date_of_birth = Column(Date, nullable=True)
    sex = Column(String(20), nullable=True)  # female, male, intersex, prefer_not
    blood_group = Column(String(5), nullable=True)
    height_cm = Column(Float, nullable=True)
    phone = Column(String(30), nullable=True)
    allergies = Column(Text, nullable=True)
    conditions = Column(Text, nullable=True)
    emergency_contact_name = Column(String(120), nullable=True)
    emergency_contact_phone = Column(String(30), nullable=True)
    preferred_language = Column(String(10), nullable=True)


class DailyLog(Base, TimestampMixin):
    """One self-reported check-in: any subset of vitals, lifestyle and symptoms."""

    __tablename__ = "patient_daily_logs"

    user_id = _owner()
    log_date = Column(Date, nullable=False)  # patient's local calendar day
    recorded_at = Column(DateTime(timezone=True), nullable=False)
    systolic = Column(Integer, nullable=True)  # mmHg
    diastolic = Column(Integer, nullable=True)  # mmHg
    heart_rate = Column(Integer, nullable=True)  # bpm
    glucose = Column(Float, nullable=True)  # mg/dL
    glucose_context = Column(String(20), nullable=True)  # fasting, after_meal, random
    spo2 = Column(Integer, nullable=True)  # %
    temperature_c = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    sleep_hours = Column(Float, nullable=True)
    steps = Column(Integer, nullable=True)
    water_ml = Column(Integer, nullable=True)
    mood = Column(Integer, nullable=True)  # 1 (very low) .. 5 (great)
    symptoms_json = Column(Text, nullable=True)  # JSON list of symptom keys
    notes = Column(Text, nullable=True)

    __table_args__ = (Index("ix_patient_daily_logs_user_date", "user_id", "log_date"),)


class PatientMedication(Base, TimestampMixin):
    """A medicine the patient takes, with daily dose times."""

    __tablename__ = "patient_medications"

    user_id = _owner()
    name = Column(String(150), nullable=False)
    dosage = Column(String(100), nullable=True)
    times_json = Column(Text, nullable=False)  # JSON list of "HH:MM"
    instructions = Column(String(255), nullable=True)
    prescribed_by = Column(String(150), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class MedicationDose(Base, TimestampMixin):
    """Whether a scheduled dose was taken or skipped on a given day."""

    __tablename__ = "patient_medication_doses"

    user_id = _owner()
    medication_id = Column(
        String(64),
        ForeignKey("patient_medications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dose_date = Column(Date, nullable=False)
    slot = Column(String(5), nullable=False)  # "HH:MM"
    status = Column(String(10), nullable=False)  # taken, skipped
    recorded_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("medication_id", "dose_date", "slot", name="uq_dose_med_date_slot"),
    )


class PatientDocument(Base, TimestampMixin):
    """A file in the patient's record locker (lab report, prescription, discharge summary, ...)."""

    __tablename__ = "patient_documents"

    user_id = _owner()
    title = Column(String(200), nullable=False)
    category = Column(String(30), nullable=False, index=True)
    record_date = Column(Date, nullable=True)
    provider = Column(String(150), nullable=True)
    notes = Column(Text, nullable=True)
    original_filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False)
    storage_path = Column(String(500), nullable=False)


class XrayStudy(Base, TimestampMixin):
    """A chest X-ray uploaded by the patient and the AI screening result computed from it."""

    __tablename__ = "patient_xray_studies"

    user_id = _owner()
    title = Column(String(200), nullable=True)
    taken_on = Column(Date, nullable=True)
    original_filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False)
    storage_path = Column(String(500), nullable=False)
    preview_path = Column(String(500), nullable=True)
    heatmap_path = Column(String(500), nullable=True)
    status = Column(
        String(20), nullable=False, default="processing"
    )  # processing, completed, failed
    error = Column(Text, nullable=True)
    primary_finding = Column(String(100), nullable=True)
    severity = Column(String(20), nullable=True)  # NORMAL, MODERATE, HIGH, CRITICAL
    model_name = Column(String(100), nullable=True)
    findings_json = Column(Text, nullable=True)  # pathologies + positive findings + summary
    analyzed_at = Column(DateTime(timezone=True), nullable=True)
