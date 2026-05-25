"""
Mifrufely Web — SQLAlchemy Declarative Base
All ORM models must inherit from Base.

NOTE: This base class is intentionally kept minimal — it does NOT define
shared audit columns (created_at / updated_at) because the physical schema
in NeonDB does not have those columns on any table. Each model declares
only the columns that exist in the PostgreSQL database.
"""

from typing import Any

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Shared declarative base for all ORM models.
    Pure declarative base — no shared columns.
    Each model declares its own columns matching the physical NeonDB schema.
    """

    __abstract__ = True

    def to_dict(self) -> dict[str, Any]:
        """Serialize ORM model to a plain dict (excludes relationships)."""
        return {
            col.name: getattr(self, col.name)
            for col in self.__table__.columns
        }

    def __repr__(self) -> str:
        # Try common PK column names used in this schema (id_<table>)
        for col in self.__table__.primary_key:
            return f"<{self.__class__.__name__} {col.name}={getattr(self, col.name, '?')}>"
        return f"<{self.__class__.__name__}>"
