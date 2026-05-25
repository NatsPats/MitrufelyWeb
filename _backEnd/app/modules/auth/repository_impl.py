"""
Mifrufely Web — Auth Repository: SQLAlchemy Implementation
Concrete implementation of AbstractAuthRepository using async SQLAlchemy 2.0.

This replaces the NotImplementedError placeholder in auth/dependencies.py.
"""

from sqlalchemy import exists, select
from sqlalchemy.orm import selectinload

from app.infrastructure.database.models.usuarios import Rol, Usuario
from app.modules.auth.repository import AbstractAuthRepository


class SQLAlchemyAuthRepository(AbstractAuthRepository):
    """
    Concrete auth repository backed by async SQLAlchemy + NeonDB (asyncpg).

    All methods are async — they must be awaited.
    The session is injected by FastAPI DI via get_db_session().
    """

    # ── Query Methods ─────────────────────────────────────────────────────────

    async def get_by_id(self, pk: int) -> Usuario | None:
        """
        Retrieve a user by primary key, eagerly loading the related Rol.
        Returns None if not found.
        """
        stmt = (
            select(Usuario)
            .options(selectinload(Usuario.rol))
            .where(Usuario.id_usuario == pk)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Usuario | None:
        """
        Retrieve a user by email address, eagerly loading the related Rol.
        Used during login to verify credentials.
        Returns None if email is not registered.
        """
        stmt = (
            select(Usuario)
            .options(selectinload(Usuario.rol))
            .where(Usuario.email == email)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, *, limit: int = 100, offset: int = 0) -> list[Usuario]:
        """
        Retrieve a paginated list of all users.
        """
        stmt = (
            select(Usuario)
            .options(selectinload(Usuario.rol))
            .limit(limit)
            .offset(offset)
            .order_by(Usuario.id_usuario)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def email_exists(self, email: str) -> bool:
        """
        Efficiently check whether an email is already registered.
        Uses an EXISTS sub-query to avoid fetching the full row.
        """
        stmt = select(exists().where(Usuario.email == email))
        result = await self._session.execute(stmt)
        return bool(result.scalar())

    async def exists(self, pk: int) -> bool:
        """Check whether a user with the given ID exists."""
        stmt = select(exists().where(Usuario.id_usuario == pk))
        result = await self._session.execute(stmt)
        return bool(result.scalar())

    # ── Mutation Methods ──────────────────────────────────────────────────────

    async def create(self, entity: Usuario) -> Usuario:
        """
        Persist a new user to NeonDB.
        Flushes the session to get the DB-generated id_usuario before returning.
        """
        self._session.add(entity)
        await self._session.flush()          # assigns id_usuario from serial
        await self._session.refresh(entity)  # reload server defaults
        return entity

    async def update(self, entity: Usuario) -> Usuario:
        """
        Merge and persist changes to an existing user entity.
        """
        merged = await self._session.merge(entity)
        await self._session.flush()
        await self._session.refresh(merged)
        return merged

    async def delete(self, pk: int) -> None:
        """
        Delete a user by primary key.
        Raises ValueError if user does not exist.
        """
        user = await self.get_by_id(pk)
        if user is None:
            raise ValueError(f"Usuario with id_usuario={pk} not found")
        await self._session.delete(user)
        await self._session.flush()
