"""
conftest.py — Fixtures locales de pytest para pruebas unitarias de SweetCoins.
"""

from unittest.mock import AsyncMock, MagicMock
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from tests.unit.sweetcoins.factories import make_config, make_cupon_maestro
from app.modules.sweetcoins.service import SweetCoinsService


@pytest.fixture
def mock_session() -> AsyncMock:
    """Mock de AsyncSession de SQLAlchemy."""
    session = AsyncMock(spec=AsyncSession)
    # Simular context manager async
    session.begin = MagicMock()
    session.begin.return_value.__aenter__ = AsyncMock()
    session.begin.return_value.__aexit__ = AsyncMock(return_value=False)
    return session


@pytest.fixture
def mock_cupon_maestro_repo() -> AsyncMock:
    """Mock del repositorio de cupones maestros."""
    repo = AsyncMock()
    repo.get_by_id = AsyncMock(return_value=None)
    repo.get_all = AsyncMock(return_value=[])
    repo.exists = AsyncMock(return_value=False)
    return repo


@pytest.fixture
def mock_cupon_cliente_repo() -> AsyncMock:
    """Mock del repositorio de cupones de cliente."""
    repo = AsyncMock()
    repo.get_by_id = AsyncMock(return_value=None)
    repo.create = AsyncMock(return_value=None)
    repo.get_all = AsyncMock(return_value=[])
    repo.exists = AsyncMock(return_value=False)
    return repo


@pytest.fixture
def mock_puntos_repo() -> AsyncMock:
    """Mock del repositorio de movimientos de puntos."""
    repo = AsyncMock()
    repo.get_saldo = AsyncMock(return_value=0)
    repo.get_saldo_for_update = AsyncMock(return_value=0)
    repo.get_history = AsyncMock(return_value=[])
    repo.create = AsyncMock(return_value=None)
    return repo


@pytest.fixture
def mock_config_repo() -> AsyncMock:
    """Mock del repositorio de configuraciones de recompensas."""
    repo = AsyncMock()
    repo.get_active = AsyncMock(return_value=make_config())
    repo.get_by_id = AsyncMock(return_value=None)
    return repo


@pytest.fixture
def sweetcoins_service(
    mock_session: AsyncMock,
    mock_cupon_maestro_repo: AsyncMock,
    mock_cupon_cliente_repo: AsyncMock,
    mock_puntos_repo: AsyncMock,
    mock_config_repo: AsyncMock,
) -> SweetCoinsService:
    """Instancia de SweetCoinsService con dependencias mockeadas."""
    return SweetCoinsService(
        session=mock_session,
        cupon_maestro_repo=mock_cupon_maestro_repo,
        cupon_cliente_repo=mock_cupon_cliente_repo,
        puntos_repo=mock_puntos_repo,
        config_repo=mock_config_repo,
    )
