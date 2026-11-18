"""
AI agent runs.

One row per time a person ran an agent: what was asked (ids only), what came back, whether an
outside language model saw any data, whether the safety check withheld its text, and what the
person did with the result. This is both the audit trail and the measurement that decides which
agents are worth keeping.

Rows about a patient are deleted with the patient's account (``subject_id`` cascades): the stored
output is derived from their record.
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text

from app.database.models.base import Base, TimestampMixin


class AgentRun(Base, TimestampMixin):
    __tablename__ = "agent_runs"

    agent = Column(String(40), nullable=False, index=True)
    version = Column(String(20), nullable=False)
    # Who ran it.
    actor_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    # Whose record it is about (None for a doctor's study that isn't linked to a patient account).
    subject_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    status = Column(String(12), nullable=False, default="queued")  # queued, running, succeeded, failed
    params_json = Column(Text, nullable=True)  # the request: ids and options, never record content
    output_json = Column(Text, nullable=True)  
    error = Column(String(300), nullable=True)
    duration_ms = Column(Integer, nullable=True)

    # Whether data left MIPAAS for an outside language model, and which one.
    llm_used = Column(Boolean, nullable=False, default=False)
    llm_model = Column(String(80), nullable=True)
    # Set when the safety check withheld the model's text (the rule-based part is still returned).
    guard = Column(String(200), nullable=True)

    # What the person did with the result: accepted, edited or discarded.
    review_decision = Column(String(12), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    final_text = Column(Text, nullable=True)  # what a doctor actually kept, for drafts

    __table_args__ = (Index("ix_agent_runs_agent_created", "agent", "created_at"),)
