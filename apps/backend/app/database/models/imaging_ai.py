"""
Imaging, DICOM & AI Diagnostics Models for MiPAAS Central Database.

Stores DICOM studies/series metadata, async processing jobs, model inference predictions,
Grad-CAM++/XAI artifacts, and the 9 clinical AI agents workflow audit runs.
"""

from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database.models.base import Base, TimestampMixin


class DicomStudy(Base, TimestampMixin):
    """DICOM Study metadata catalog."""

    __tablename__ = "dicom_studies"

    patient_id = Column(String(64), ForeignKey("clinical_patients.id", ondelete="SET NULL"), nullable=True, index=True)
    study_instance_uid = Column(String(128), unique=True, nullable=False, index=True)
    study_date = Column(String(20), nullable=True)
    accession_number = Column(String(50), nullable=True, index=True)
    modality = Column(String(20), nullable=False, index=True)  # CT, MR, CR, DX, US
    study_description = Column(String(255), nullable=True)
    num_series = Column(Integer, default=1)
    num_instances = Column(Integer, default=1)
    patient_age = Column(String(20), nullable=True)
    patient_gender = Column(String(20), nullable=True)

    # Relationships
    series = relationship("DicomSeries", back_populates="study", cascade="all, delete-orphan")
    jobs = relationship("DiagnosticJob", back_populates="study")

    def __repr__(self) -> str:
        return f"<DicomStudy id={self.id} uid={self.study_instance_uid} modality={self.modality}>"


class DicomSeries(Base, TimestampMixin):
    """DICOM Series within a study."""

    __tablename__ = "dicom_series"

    study_id = Column(String(64), ForeignKey("dicom_studies.id", ondelete="CASCADE"), nullable=False, index=True)
    series_instance_uid = Column(String(128), unique=True, nullable=False, index=True)
    series_number = Column(Integer, default=1)
    modality = Column(String(20), nullable=False)
    series_description = Column(String(255), nullable=True)
    num_instances = Column(Integer, default=1)
    slice_thickness = Column(Float, nullable=True)
    pixel_spacing_x = Column(Float, nullable=True)
    pixel_spacing_y = Column(Float, nullable=True)
    gcs_uri = Column(String(500), nullable=True)

    # Relationships
    study = relationship("DicomStudy", back_populates="series")

    def __repr__(self) -> str:
        return f"<DicomSeries id={self.id} uid={self.series_instance_uid}>"


class DiagnosticJob(Base, TimestampMixin):
    """End-to-end diagnostic processing job across the ML pipeline."""

    __tablename__ = "diagnostic_jobs"

    user_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    patient_id = Column(String(64), ForeignKey("clinical_patients.id", ondelete="SET NULL"), nullable=True, index=True)
    study_id = Column(String(64), ForeignKey("dicom_studies.id", ondelete="SET NULL"), nullable=True, index=True)
    
    disease_id = Column(String(50), nullable=False, index=True)  # lung_cancer, brain_tumor, cardiac, etc.
    model_name = Column(String(50), nullable=False)
    modality = Column(String(20), nullable=False)
    
    status = Column(
        String(50),
        default="awaiting_upload",
        nullable=False,
        index=True,
    )  # awaiting_upload, uploaded, preprocessing, inference, xai_running, complete, failed
    progress_pct = Column(Integer, default=0)
    error_stage = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    
    input_gcs_uri = Column(String(500), nullable=True)
    preprocessed_uri = Column(String(500), nullable=True)
    
    # Serialized JSON Artifacts
    predictions_json = Column(Text, nullable=True)  # {predicted_class, confidence, probabilities}
    xai_json = Column(Text, nullable=True)          # {gradcam_uri, occlusion_uri, ig_uri, overlays}
    segmentation_json = Column(Text, nullable=True) # {mask_uri, lesion_count, volume_cc}

    # Relationships
    study = relationship("DicomStudy", back_populates="jobs")
    agent_runs = relationship("AgentWorkflowRun", back_populates="job", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<DiagnosticJob id={self.id} disease={self.disease_id} status={self.status}>"


class AgentWorkflowRun(Base, TimestampMixin):
    """Audit run record for each of the 9 Clinical AI Agents."""

    __tablename__ = "agent_workflow_runs"

    job_id = Column(String(64), ForeignKey("diagnostic_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id = Column(String(50), nullable=False, index=True)  # intake_quality, dicom_integrity, etc.
    agent_name = Column(String(100), nullable=False)
    step_order = Column(Integer, default=1)
    status = Column(String(50), default="completed", nullable=False)  # pending, running, completed, flagged, failed
    execution_time_ms = Column(Integer, default=0)
    inputs_json = Column(Text, nullable=True)
    outputs_json = Column(Text, nullable=True)
    logs_json = Column(Text, nullable=True)

    job = relationship("DiagnosticJob", back_populates="agent_runs")

    def __repr__(self) -> str:
        return f"<AgentWorkflowRun id={self.id} agent={self.agent_id} status={self.status}>"
