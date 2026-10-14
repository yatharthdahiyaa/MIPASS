"""
Consumer Health & Eka.care Hub Models for Central Database.
"""

from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from database.models.base import Base, TimestampMixin


class FamilyMember(Base, TimestampMixin):
    """Eka.care family health profile linked to ABDM ABHA."""

    __tablename__ = "family_members"

    user_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    relation = Column(String(50), nullable=False)  # Self, Spouse, Father, Mother, Child, Dependent
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    abha_id = Column(String(50), unique=True, nullable=False, index=True)
    blood_group = Column(String(10), nullable=True)
    avatar_color = Column(String(100), default="from-teal-500 to-emerald-600")
    primary_condition = Column(String(255), nullable=True)

    medications = relationship("Medication", back_populates="member", cascade="all, delete-orphan")
    vitals = relationship("VitalRecord", back_populates="member", cascade="all, delete-orphan")
    records = relationship("HealthRecord", back_populates="member", cascade="all, delete-orphan")
    appointments = relationship("ConsumerAppointment", back_populates="member", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<FamilyMember id={self.id} name='{self.name}' abha={self.abha_id}>"


class Medication(Base, TimestampMixin):
    """Prescription medication schedule with daily adherence tracking."""

    __tablename__ = "medications"

    member_id = Column(String(64), ForeignKey("family_members.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    dosage = Column(String(100), nullable=False)
    frequency = Column(String(100), nullable=False)
    timing = Column(String(50), nullable=False)  # Morning, Afternoon, Night, Morning & Night
    instruction = Column(String(50), nullable=False)  # Before Food, After Food, With Food
    prescribed_by = Column(String(150), nullable=True)
    refill_days_left = Column(Integer, default=30)
    time_slot = Column(String(50), nullable=False)
    taken_today = Column(Boolean, default=False, nullable=False)
    last_taken_date = Column(String(20), nullable=True)

    member = relationship("FamilyMember", back_populates="medications")

    def __repr__(self) -> str:
        return f"<Medication id={self.id} name='{self.name}' taken={self.taken_today}>"


class VitalRecord(Base, TimestampMixin):
    """Clinical vitals logged by patient or IoT device."""

    __tablename__ = "vital_records"

    member_id = Column(String(64), ForeignKey("family_members.id", ondelete="CASCADE"), nullable=False, index=True)
    vital_type = Column(String(50), nullable=False, index=True)  # Blood Pressure, Blood Sugar, SpO2, etc.
    value = Column(String(50), nullable=False)
    unit = Column(String(20), nullable=False)
    status = Column(String(50), default="Normal", nullable=False)  # Normal, Elevated, Optimal, Attention
    recorded_at = Column(String(100), nullable=False)
    trend = Column(String(20), default="stable")
    target_range = Column(String(100), nullable=True)

    member = relationship("FamilyMember", back_populates="vitals")

    __table_args__ = (
        Index("ix_vitals_member_type", "member_id", "vital_type"),
    )

    def __repr__(self) -> str:
        return f"<VitalRecord id={self.id} type='{self.vital_type}' value='{self.value}'>"


class HealthRecord(Base, TimestampMixin):
    """Encrypted personal health record stored in health locker."""

    __tablename__ = "health_records"

    member_id = Column(String(64), ForeignKey("family_members.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False, index=True)  # Prescriptions, Lab Reports, Scans & Imaging, etc.
    doctor_or_lab = Column(String(150), nullable=False)
    record_date = Column(String(50), nullable=False)
    file_type = Column(String(50), default="PDF")
    file_size = Column(String(50), default="1.0 MB")
    storage_uri = Column(String(500), nullable=True)
    ai_key_summary = Column(Text, nullable=True)
    tags_json = Column(Text, nullable=True)
    extracted_parameters_json = Column(Text, nullable=True)

    member = relationship("FamilyMember", back_populates="records")

    def __repr__(self) -> str:
        return f"<HealthRecord id={self.id} title='{self.title}' category={self.category}>"


class ConsumerAppointment(Base, TimestampMixin):
    """Patient consultation appointment."""

    __tablename__ = "consumer_appointments"

    member_id = Column(String(64), ForeignKey("family_members.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_name = Column(String(150), nullable=False)
    specialty = Column(String(150), nullable=False)
    hospital = Column(String(200), nullable=False)
    appointment_date = Column(String(50), nullable=False)
    appointment_time = Column(String(50), nullable=False)
    token_number = Column(Integer, default=1)
    appointment_type = Column(String(50), default="In-Clinic")  # In-Clinic, Video Teleconsult
    status = Column(String(50), default="Confirmed", index=True)  # Confirmed, In Progress, Completed, Cancelled
    queue_wait_mins = Column(Integer, default=0)

    member = relationship("FamilyMember", back_populates="appointments")

    def __repr__(self) -> str:
        return f"<ConsumerAppointment id={self.id} doctor='{self.doctor_name}' status={self.status}>"
