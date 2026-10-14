"""
Clinical & OpenEMR Data Models for Central Database.
"""

from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from database.models.base import Base, TimestampMixin


class ClinicalProvider(Base, TimestampMixin):
    """Clinical practitioner or staff member."""

    __tablename__ = "clinical_providers"

    user_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    fname = Column(String(100), nullable=False)
    lname = Column(String(100), nullable=False)
    title = Column(String(50), default="Dr.")
    specialty = Column(String(150), nullable=True)
    npi = Column(String(20), unique=True, nullable=True, index=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    facility_name = Column(String(150), default="Memorial Diagnostic Pavilion")
    role_mapping = Column(String(50), default="radiologist")
    is_active = Column(Boolean, default=True, nullable=False)

    encounters = relationship("ClinicalEncounter", back_populates="provider")
    orders = relationship("ProcedureOrder", back_populates="ordering_provider")
    reports = relationship("ProcedureReport", back_populates="radiologist")

    def __repr__(self) -> str:
        return f"<ClinicalProvider id={self.id} name='{self.fname} {self.lname}' npi={self.npi}>"


class ClinicalPatient(Base, TimestampMixin):
    """Master Patient Index (MPI) record."""

    __tablename__ = "clinical_patients"

    mrn = Column(String(50), unique=True, nullable=False, index=True)
    fname = Column(String(100), nullable=False)
    lname = Column(String(100), nullable=False)
    dob = Column(String(20), nullable=False)  # YYYY-MM-DD
    gender = Column(String(20), nullable=False)
    blood_group = Column(String(10), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    street = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    postal_code = Column(String(20), nullable=True)
    insurance_provider = Column(String(150), nullable=True)
    insurance_id = Column(String(100), nullable=True)
    allergies_json = Column(Text, nullable=True)
    conditions_json = Column(Text, nullable=True)
    abha_id = Column(String(50), nullable=True, index=True)

    encounters = relationship("ClinicalEncounter", back_populates="patient", cascade="all, delete-orphan")
    orders = relationship("ProcedureOrder", back_populates="patient", cascade="all, delete-orphan")
    reports = relationship("ProcedureReport", back_populates="patient", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ClinicalPatient id={self.id} mrn={self.mrn} name='{self.fname} {self.lname}'>"


class ClinicalEncounter(Base, TimestampMixin):
    """Clinical encounter / visit with structured SOAP notes."""

    __tablename__ = "clinical_encounters"

    patient_id = Column(String(64), ForeignKey("clinical_patients.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(String(64), ForeignKey("clinical_providers.id", ondelete="SET NULL"), nullable=True, index=True)
    encounter_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    encounter_type = Column(String(100), default="diagnostic_imaging", nullable=False)
    facility_name = Column(String(150), default="Memorial Diagnostic Pavilion")
    reason_for_visit = Column(String(255), nullable=True)
    status = Column(String(50), default="completed", nullable=False, index=True)

    subjective = Column(Text, nullable=True)
    objective = Column(Text, nullable=True)
    assessment = Column(Text, nullable=True)
    plan = Column(Text, nullable=True)

    patient = relationship("ClinicalPatient", back_populates="encounters")
    provider = relationship("ClinicalProvider", back_populates="encounters")
    orders = relationship("ProcedureOrder", back_populates="encounter")

    def __repr__(self) -> str:
        return f"<ClinicalEncounter id={self.id} patient_id={self.patient_id} status={self.status}>"


class ProcedureOrder(Base, TimestampMixin):
    """Diagnostic imaging / procedure order."""

    __tablename__ = "procedure_orders"

    order_number = Column(String(50), unique=True, nullable=False, index=True)
    patient_id = Column(String(64), ForeignKey("clinical_patients.id", ondelete="CASCADE"), nullable=False, index=True)
    encounter_id = Column(String(64), ForeignKey("clinical_encounters.id", ondelete="SET NULL"), nullable=True, index=True)
    ordering_provider_id = Column(String(64), ForeignKey("clinical_providers.id", ondelete="SET NULL"), nullable=True, index=True)
    
    procedure_code = Column(String(50), nullable=False)
    procedure_name = Column(String(200), nullable=False)
    modality = Column(String(20), nullable=False, index=True)
    body_site = Column(String(100), nullable=True)
    clinical_indication = Column(Text, nullable=True)
    priority = Column(String(20), default="routine", nullable=False, index=True)
    status = Column(String(50), default="pending", nullable=False, index=True)
    order_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    linked_job_id = Column(String(64), nullable=True, index=True)
    accession_number = Column(String(50), nullable=True, index=True)

    patient = relationship("ClinicalPatient", back_populates="orders")
    encounter = relationship("ClinicalEncounter", back_populates="orders")
    ordering_provider = relationship("ClinicalProvider", back_populates="orders")
    report = relationship("ProcedureReport", back_populates="order", uselist=False)

    def __repr__(self) -> str:
        return f"<ProcedureOrder id={self.id} order_num={self.order_number} status={self.status}>"


class ProcedureReport(Base, TimestampMixin):
    """Diagnostic imaging procedure final report with digital signoff."""

    __tablename__ = "procedure_reports"

    report_number = Column(String(50), unique=True, nullable=False, index=True)
    order_id = Column(String(64), ForeignKey("procedure_orders.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    patient_id = Column(String(64), ForeignKey("clinical_patients.id", ondelete="CASCADE"), nullable=False, index=True)
    radiologist_id = Column(String(64), ForeignKey("clinical_providers.id", ondelete="SET NULL"), nullable=True, index=True)
    
    status = Column(String(50), default="preliminary", nullable=False, index=True)
    findings = Column(Text, nullable=True)
    impression = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=True)
    bi_rads_score = Column(String(20), nullable=True)
    critical_findings_alert = Column(Boolean, default=False, nullable=False)
    
    signed_by = Column(String(150), nullable=True)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    signature_hash = Column(String(255), nullable=True)

    order = relationship("ProcedureOrder", back_populates="report")
    patient = relationship("ClinicalPatient", back_populates="reports")
    radiologist = relationship("ClinicalProvider", back_populates="reports")

    def __repr__(self) -> str:
        return f"<ProcedureReport id={self.id} report_num={self.report_number} status={self.status}>"
