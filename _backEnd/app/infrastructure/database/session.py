"""
Mifrufely Web — Async SQLAlchemy 2.0 Session Factory
Prepared for NeonDB (PostgreSQL) via asyncpg
"""

from collections.abc import AsyncGenerator

import structlog
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

logger = structlog.get_logger(__name__)

# ── Engine ────────────────────────────────────────────────────────────────────

database_engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_timeout=settings.DATABASE_POOL_TIMEOUT,
    pool_recycle=settings.DATABASE_POOL_RECYCLE,
    pool_pre_ping=True,  # Validate connections before use
)

# ── Session Factory ───────────────────────────────────────────────────────────

AsyncSessionFactory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=database_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── Dependency ────────────────────────────────────────────────────────────────

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a scoped async session per request.
    Commits on success, rolls back on exception, always closes.
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception as exc:
            await session.rollback()
            logger.error("db.session_error", error=str(exc))
            raise
        finally:
            await session.close()
