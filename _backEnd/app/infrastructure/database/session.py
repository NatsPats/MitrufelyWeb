"""
Mifrufely Web — Async SQLAlchemy 2.0 Session Factory
Prepared for NeonDB (PostgreSQL) via asyncpg

IMPORTANT — asyncpg SSL Quirk:
  asyncpg does NOT accept `sslmode` or `channel_binding` as URL query parameters.
  Instead, SSL must be passed via `connect_args={"ssl": True}`.
  This module strips those query params from DATABASE_URL automatically so
  the .env can use the standard NeonDB connection string format without changes.
"""

from collections.abc import AsyncGenerator
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import structlog
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

logger = structlog.get_logger(__name__)


# ── URL Sanitizer ──────────────────────────────────────────────────────────────

_ASYNCPG_UNSUPPORTED_PARAMS = frozenset({"sslmode", "channel_binding"})


def _build_async_url(raw_url: str) -> tuple[str, dict]:
    """
    Converts a standard PostgreSQL URL (compatible with psycopg2/NeonDB format)
    into one compatible with asyncpg:

    1. Ensures the scheme is `postgresql+asyncpg://`
    2. Strips `sslmode` and `channel_binding` query params (asyncpg rejects them)
    3. Returns (clean_url, connect_args) where connect_args has ssl=True if
       the original URL contained sslmode=require (NeonDB always uses SSL).
    """
    parsed = urlparse(raw_url)

    # Normalize scheme to asyncpg
    scheme = "postgresql+asyncpg"

    # Parse and filter query parameters
    query_params = parse_qs(parsed.query, keep_blank_values=True)
    needs_ssl = "sslmode" in query_params  # presence of sslmode → enable SSL

    filtered_params = {
        k: v for k, v in query_params.items()
        if k not in _ASYNCPG_UNSUPPORTED_PARAMS
    }

    clean_query = urlencode(filtered_params, doseq=True)
    clean_url = urlunparse((
        scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        clean_query,
        parsed.fragment,
    ))

    connect_args: dict = {"ssl": True} if needs_ssl else {}
    return clean_url, connect_args


_async_url, _connect_args = _build_async_url(settings.DATABASE_URL)

# ── Engine ────────────────────────────────────────────────────────────────────

database_engine: AsyncEngine = create_async_engine(
    _async_url,
    echo=settings.DEBUG,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_timeout=settings.DATABASE_POOL_TIMEOUT,
    pool_recycle=settings.DATABASE_POOL_RECYCLE,
    pool_pre_ping=True,       # Validate connections before use
    connect_args=_connect_args,  # Pass ssl=True for asyncpg/NeonDB
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

