"""
Mifrufely Web — Abstract Repository Base
Generic async Repository Pattern — all concrete repositories must extend this.
"""

from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

ModelT = TypeVar("ModelT")
PKT = TypeVar("PKT")


class AbstractRepository(ABC, Generic[ModelT, PKT]):
    """
    Abstract async repository.
    Defines the contract every repository must fulfill.
    All I/O operations are async — no sync calls allowed.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @abstractmethod
    async def get_by_id(self, pk: PKT) -> ModelT | None:
        """Retrieve a single entity by primary key."""
        ...

    @abstractmethod
    async def get_all(self, *, limit: int = 100, offset: int = 0) -> list[ModelT]:
        """Retrieve a paginated list of entities."""
        ...

    @abstractmethod
    async def create(self, entity: ModelT) -> ModelT:
        """Persist a new entity and return it."""
        ...

    @abstractmethod
    async def update(self, entity: ModelT) -> ModelT:
        """Persist changes to an existing entity and return it."""
        ...

    @abstractmethod
    async def delete(self, pk: PKT) -> None:
        """Remove an entity by primary key."""
        ...

    @abstractmethod
    async def exists(self, pk: PKT) -> bool:
        """Check whether an entity with the given PK exists."""
        ...
