"""
Mifrufely Web — Dependency Injection: CriptoTrufa / SweetCoins (Módulo M06)
Wires repositories and services with FastAPI Depends.
"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_db_session
from app.modules.sweetcoins.repository import (
    IConfiguracionRecompensasRepository,
    ICuponClienteRepository,
    ICuponMaestroRepository,
    IMovimientoPuntosRepository,
)
from app.modules.sweetcoins.repository_impl import (
    ConfiguracionRecompensasRepositoryImpl,
    CuponClienteRepositoryImpl,
    CuponMaestroRepositoryImpl,
    MovimientoPuntosRepositoryImpl,
)
from app.modules.sweetcoins.service import SweetCoinsService


def get_cupon_maestro_repository(
    session: AsyncSession = Depends(get_db_session)
) -> ICuponMaestroRepository:
    return CuponMaestroRepositoryImpl(session)


def get_cupon_cliente_repository(
    session: AsyncSession = Depends(get_db_session)
) -> ICuponClienteRepository:
    return CuponClienteRepositoryImpl(session)


def get_puntos_repository(
    session: AsyncSession = Depends(get_db_session)
) -> IMovimientoPuntosRepository:
    return MovimientoPuntosRepositoryImpl(session)


def get_config_repository(
    session: AsyncSession = Depends(get_db_session)
) -> IConfiguracionRecompensasRepository:
    return ConfiguracionRecompensasRepositoryImpl(session)


def get_sweetcoins_service(
    session: AsyncSession = Depends(get_db_session),
    cupon_maestro_repo: ICuponMaestroRepository = Depends(get_cupon_maestro_repository),
    cupon_cliente_repo: ICuponClienteRepository = Depends(get_cupon_cliente_repository),
    puntos_repo: IMovimientoPuntosRepository = Depends(get_puntos_repository),
    config_repo: IConfiguracionRecompensasRepository = Depends(get_config_repository),
) -> SweetCoinsService:
    return SweetCoinsService(
        session=session,
        cupon_maestro_repo=cupon_maestro_repo,
        cupon_cliente_repo=cupon_cliente_repo,
        puntos_repo=puntos_repo,
        config_repo=config_repo,
    )
