"""
Base SQLAlchemy Declarative Model and Mixins for MiPAAS Central Database.
"""

from datetime import datetime, timezone
import json
import uuid
from typing import Any, Dict

from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()


def generate_uuid() -> str:
    """Generate standard UUID string."""
    return str(uuid.uuid4())


class TimestampMixin:
    """Provides id, created_at, and updated_at columns."""

    id = Column(String(64), primary_key=True, default=generate_uuid)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert model instance to python dictionary."""
        result: Dict[str, Any] = {}
        for column in self.__table__.columns:
            val = getattr(self, column.name)
            if isinstance(val, datetime):
                result[column.name] = val.isoformat()
            else:
                result[column.name] = val
        return result
