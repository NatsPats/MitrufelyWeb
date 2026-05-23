"""
Mifrufely Web — Pytest Configuration
Shared fixtures for all test suites
"""

import asyncio
from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app


# ── Event Loop ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop_policy():
    return asyncio.DefaultEventLoopPolicy()


# ── HTTP Test Client ──────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTPX client bound to the FastAPI app (no real server needed)."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url=f"http://testserver{settings.API_V1_PREFIX}",
    ) as ac:
        yield ac


# ── Auth Helpers ──────────────────────────────────────────────────────────────

@pytest.fixture
def admin_token() -> str:
    from app.core.security import create_access_token
    return create_access_token(subject="1", role="administrador", extra={"email": "admin@test.com"})


@pytest.fixture
def client_token() -> str:
    from app.core.security import create_access_token
    return create_access_token(subject="2", role="cliente", extra={"email": "cliente@test.com"})


@pytest.fixture
def auth_headers_admin(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def auth_headers_client(client_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {client_token}"}


# ── Mock Repository ───────────────────────────────────────────────────────────

@pytest.fixture
def mock_auth_repo() -> AsyncMock:
    """Mock AbstractAuthRepository for unit testing services."""
    repo = AsyncMock()
    repo.get_by_email = AsyncMock(return_value=None)
    repo.email_exists = AsyncMock(return_value=False)
    repo.get_by_id = AsyncMock(return_value=None)
    return repo
