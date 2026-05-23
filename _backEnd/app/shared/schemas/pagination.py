"""
Mifrufely Web — Shared Pagination Schema
Reusable paginated response envelope
"""

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated API response envelope."""

    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def build(
        cls,
        items: list[T],
        total: int,
        params: PaginationParams,
    ) -> "PaginatedResponse[T]":
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            total_pages=-(-total // params.page_size),  # Ceiling division
        )
