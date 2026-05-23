"""
Mifrufely Web — Auth Repository (Abstraction)
Defines the data-access contract for user authentication.
Concrete implementation lives in infrastructure/database/.
"""

from abc import abstractmethod

from app.domain.repositories.base import AbstractRepository


class AbstractAuthRepository(AbstractRepository):
    """
    Auth-specific repository contract.
    Concrete implementation will use SQLAlchemy AsyncSession.
    """

    @abstractmethod
    async def get_by_email(self, email: str):
        """Retrieve a user by email address."""
        ...

    @abstractmethod
    async def email_exists(self, email: str) -> bool:
        """Check whether an email is already registered."""
        ...
