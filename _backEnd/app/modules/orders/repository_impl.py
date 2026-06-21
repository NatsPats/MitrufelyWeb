from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.database.models.ventas import Venta, DetalleVenta
from app.modules.orders.repository import IVentaRepository


class VentaRepositoryImpl(IVentaRepository):
    """Implementación SQLAlchemy del repositorio de Ventas."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_id(self, pk: int) -> Optional[Venta]:
        stmt = (
            select(Venta)
            .options(
                selectinload(Venta.detalles).selectinload(DetalleVenta.producto),
                selectinload(Venta.paquetes_vendidos),
                selectinload(Venta.metodos_pago),
                selectinload(Venta.documentos),
                selectinload(Venta.order_review),
            )
            .where(Venta.id_venta == pk)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_all(self, *, limit: int = 100, offset: int = 0) -> List[Venta]:
        stmt = (
            select(Venta)
            .options(
                selectinload(Venta.detalles).selectinload(DetalleVenta.producto),
                selectinload(Venta.paquetes_vendidos),
                selectinload(Venta.metodos_pago),
                selectinload(Venta.documentos),
                selectinload(Venta.order_review),
            )
            .order_by(Venta.fecha_venta.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, entity: Venta) -> Venta:
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def create_venta_transactional(self, venta: Venta) -> Venta:
        self._session.add(venta)
        await self._session.flush()
        return venta

    async def update(self, entity: Venta) -> Venta:
        await self._session.flush()
        return entity

    async def delete(self, pk: int) -> None:
        # Usualmente no se eliminan ventas físicas, se anulan (Soft Delete o cambio de estado)
        pass

    async def exists(self, pk: int) -> bool:
        stmt = select(Venta.id_venta).where(Venta.id_venta == pk)
        result = await self._session.execute(stmt)
        return result.scalars().first() is not None

    async def find_by_cliente(
        self, id_cliente: int, *, limit: int = 100, offset: int = 0
    ) -> List[Venta]:
        stmt = (
            select(Venta)
            .options(
                selectinload(Venta.detalles).selectinload(DetalleVenta.producto),
                selectinload(Venta.paquetes_vendidos),
                selectinload(Venta.metodos_pago),
                selectinload(Venta.documentos),
                selectinload(Venta.order_review),
            )
            .where(Venta.id_cliente == id_cliente)
            .order_by(Venta.fecha_venta.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
