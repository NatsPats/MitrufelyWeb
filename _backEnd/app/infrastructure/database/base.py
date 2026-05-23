"""
Mifrufely Web — SQLAlchemy Declarative Base
All ORM models must inherit from Base.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedColumn, mapped_column


class Base(DeclarativeBase):
    """
    Shared declarative base for all ORM models.
    Provides automatic audit timestamps.
    """

    __abstract__ = True

    # ── Audit Columns ─────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def to_dict(self) -> dict[str, Any]:
        """Serialize ORM model to a plain dict (excludes relationships)."""
        return {
            col.name: getattr(self, col.name)
            for col in self.__table__.columns
        }

    def __repr__(self) -> str:
        pk = getattr(self, "id", "?")
        return f"<{self.__class__.__name__} id={pk}>"
