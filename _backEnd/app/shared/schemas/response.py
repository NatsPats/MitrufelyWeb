"""
Mifrufely Web — Standard API Response Envelope
"""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """Unified success response envelope for all endpoints."""

    success: bool = True
    data: T
    message: str | None = None


class MessageResponse(BaseModel):
    """Lightweight response for operations that return only a message."""

    success: bool = True
    message: str
