"""
Mifrufely Web — Repository Implementations: CriptoTrufa / SweetCoins (Módulo M06)
Concrete async SQLAlchemy 2.0 implementations.
"""

from typing import List, Optional
from sqlalchemy import select, func, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.database.models.cupones import CuponCliente, CuponMaestro
from app.infrastructure.database.models.enums import EstadoCuponEnum
from app.infrastructure.database.models.recompensas import ConfiguracionRecompensas, MovimientoPuntos
from app.modules.sweetcoins.repository import (
    IConfiguracionRecompensasRepository,
    ICuponClienteRepository,
    ICuponMaestroRepository,
    IMovimientoPuntosRepository,
)


# ── CUPÓN MAESTRO REPOSITORY ──────────────────────────────────────────────────

class CuponMaestroRepositoryImpl(ICuponMaestroRepository):
    """Implementación SQLAlchemy para CuponMaestro."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_id(self, pk: int) -> Optional[CuponMaestro]:
        stmt = select(CuponMaestro).where(CuponMaestro.id_cupon == pk)
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_all(self, *, limit: int = 100, offset: int = 0) -> list[CuponMaestro]:
        stmt = select(CuponMaestro).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, entity: CuponMaestro) -> CuponMaestro:
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def update(self, entity: CuponMaestro) -> CuponMaestro:
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def delete(self, pk: int) -> None:
        cupon = await self.get_by_id(pk)
        if cupon:
            cupon.estado = False
            await self._session.flush()

    async def exists(self, pk: int) -> bool:
        stmt = select(CuponMaestro.id_cupon).where(CuponMaestro.id_cupon == pk)
        result = await self._session.execute(stmt)
        return result.scalars().first() is not None

    async def get_available(self) -> List[CuponMaestro]:
        stmt = (
            select(CuponMaestro)
            .where(CuponMaestro.estado == True, CuponMaestro.costo_puntos != None)  # noqa: E712
            .order_by(CuponMaestro.costo_puntos.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())


# ── CUPÓN CLIENTE REPOSITORY ──────────────────────────────────────────────────

class CuponClienteRepositoryImpl(ICuponClienteRepository):
    """Implementación SQLAlchemy para CuponCliente."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_id(self, pk: int) -> Optional[CuponCliente]:
        stmt = (
            select(CuponCliente)
            .options(selectinload(CuponCliente.cupon_maestro))
            .where(CuponCliente.id_cupon_cliente == pk)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_all(self, *, limit: int = 100, offset: int = 0) -> list[CuponCliente]:
        stmt = (
            select(CuponCliente)
            .options(selectinload(CuponCliente.cupon_maestro))
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, entity: CuponCliente) -> CuponCliente:
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def update(self, entity: CuponCliente) -> CuponCliente:
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def delete(self, pk: int) -> None:
        stmt = select(CuponCliente).where(CuponCliente.id_cupon_cliente == pk)
        result = await self._session.execute(stmt)
        entity = result.scalars().first()
        if entity:
            await self._session.delete(entity)
            await self._session.flush()

    async def exists(self, pk: int) -> bool:
        stmt = select(CuponCliente.id_cupon_cliente).where(CuponCliente.id_cupon_cliente == pk)
        result = await self._session.execute(stmt)
        return result.scalars().first() is not None

    async def get_by_codigo(self, codigo_unico: str) -> Optional[CuponCliente]:
        stmt = (
            select(CuponCliente)
            .options(selectinload(CuponCliente.cupon_maestro))
            .where(CuponCliente.codigo_unico == codigo_unico)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_active_by_cliente(self, id_cliente: int) -> List[CuponCliente]:
        stmt = (
            select(CuponCliente)
            .options(selectinload(CuponCliente.cupon_maestro))
            .where(
                CuponCliente.id_cliente == id_cliente,
                CuponCliente.estado == EstadoCuponEnum.DISPONIBLE,
                CuponCliente.fecha_expiracion > func.now()
            )
            .order_by(CuponCliente.fecha_expiracion.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_all_by_cliente(self, id_cliente: int) -> List[CuponCliente]:
        stmt = (
            select(CuponCliente)
            .options(selectinload(CuponCliente.cupon_maestro))
            .where(CuponCliente.id_cliente == id_cliente)
            .order_by(CuponCliente.fecha_adquisicion.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def expire_vencidos(self) -> int:
        result = await self._session.execute(
            text("SELECT sp_expirar_cupones_vencidos()")
        )
        count: int = result.scalar() or 0
        return count


# ── MOVIMIENTO PUNTOS REPOSITORY ──────────────────────────────────────────────

class MovimientoPuntosRepositoryImpl(IMovimientoPuntosRepository):
    """Implementación SQLAlchemy para MovimientoPuntos."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_id(self, pk: int) -> Optional[MovimientoPuntos]:
        stmt = select(MovimientoPuntos).where(MovimientoPuntos.id_movimiento_punto == pk)
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_all(self, *, limit: int = 100, offset: int = 0) -> list[MovimientoPuntos]:
        stmt = select(MovimientoPuntos).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, entity: MovimientoPuntos) -> MovimientoPuntos:
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def update(self, entity: MovimientoPuntos) -> MovimientoPuntos:
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def delete(self, pk: int) -> None:
        stmt = select(MovimientoPuntos).where(MovimientoPuntos.id_movimiento_punto == pk)
        result = await self._session.execute(stmt)
        entity = result.scalars().first()
        if entity:
            await self._session.delete(entity)
            await self._session.flush()

    async def exists(self, pk: int) -> bool:
        stmt = select(MovimientoPuntos.id_movimiento_punto).where(MovimientoPuntos.id_movimiento_punto == pk)
        result = await self._session.execute(stmt)
        return result.scalars().first() is not None

    async def get_saldo(self, id_cliente: int) -> int:
        result = await self._session.execute(
            select(func.fn_saldo_puntos_cliente(id_cliente))
        )
        return result.scalar() or 0

    async def get_saldo_for_update(self, id_cliente: int) -> int:
        # Bloquear los registros de movimientos de puntos de ese cliente con lock pesimista
        stmt = (
            select(MovimientoPuntos.id_movimiento_punto)
            .where(MovimientoPuntos.id_cliente == id_cliente)
            .with_for_update()
        )
        await self._session.execute(stmt)
        # Una vez bloqueado, recuperar el saldo más reciente
        return await self.get_saldo(id_cliente)

    async def get_history(self, id_cliente: int, *, limit: int = 50) -> List[MovimientoPuntos]:
        stmt = (
            select(MovimientoPuntos)
            .where(MovimientoPuntos.id_cliente == id_cliente)
            .order_by(MovimientoPuntos.fecha_movimiento.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_todos_clientes_con_saldo(self) -> List[dict]:
        stmt = text("""
            SELECT c.id_cliente, c.id_usuario, u.nombres, u.apellidos, u.email, COALESCE(v.puntos_actuales, 0) as saldo
            FROM clientes c
            JOIN usuarios u ON c.id_usuario = u.id_usuario
            LEFT JOIN vw_saldo_puntos_cliente v ON c.id_cliente = v.id_cliente
            ORDER BY saldo DESC, u.apellidos ASC
        """)
        result = await self._session.execute(stmt)
        return [
            {
                "id_cliente": row[0],
                "id_usuario": row[1],
                "nombres": row[2],
                "apellidos": row[3],
                "email": row[4],
                "saldo": row[5]
            }
            for row in result.fetchall()
        ]


# ── CONFIGURACIÓN RECOMPENSAS REPOSITORY ───────────────────────────────────────

class ConfiguracionRecompensasRepositoryImpl(IConfiguracionRecompensasRepository):
    """Implementación SQLAlchemy para ConfiguracionRecompensas."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_id(self, pk: int) -> Optional[ConfiguracionRecompensas]:
        stmt = select(ConfiguracionRecompensas).where(ConfiguracionRecompensas.id_config == pk)
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_all(self, *, limit: int = 100, offset: int = 0) -> list[ConfiguracionRecompensas]:
        stmt = select(ConfiguracionRecompensas).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, entity: ConfiguracionRecompensas) -> ConfiguracionRecompensas:
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def update(self, entity: ConfiguracionRecompensas) -> ConfiguracionRecompensas:
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def delete(self, pk: int) -> None:
        config = await self.get_by_id(pk)
        if config:
            config.estado = False
            await self._session.flush()

    async def exists(self, pk: int) -> bool:
        stmt = select(ConfiguracionRecompensas.id_config).where(ConfiguracionRecompensas.id_config == pk)
        result = await self._session.execute(stmt)
        return result.scalars().first() is not None

    async def get_active(self) -> Optional[ConfiguracionRecompensas]:
        stmt = (
            select(ConfiguracionRecompensas)
            .where(ConfiguracionRecompensas.estado == True)  # noqa: E712
            .order_by(ConfiguracionRecompensas.id_config.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()
