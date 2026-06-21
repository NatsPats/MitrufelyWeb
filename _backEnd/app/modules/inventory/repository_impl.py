"""
Mifrufely Web — Inventory Module: SQLAlchemy Repository Implementation (Fase 3)

Responsabilidades:
  - CRUD de lotes (el INSERT dispara tg_lotes_validar_insert + tg_lotes_post_insert en NeonDB).
  - INSERT de ajustes manuales en movimientos_stock (dispara tg_movimientos_stock_ajustes).
  - Consultas Kardex paginadas con count eficiente.
  - Lectura de la vista vw_inventory_reconciliation.
  - Consulta de próximo lote FEFO (solo informativo).

NOTA: Este repositorio NUNCA modifica directamente stock_actual ni cantidad_disponible.
      Toda gobernanza de stock es responsabilidad exclusiva de los triggers en NeonDB.
"""

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models.catalogo import (
    Lote,
    MovimientoStock,
    Producto,
)
from app.infrastructure.database.models.enums import EstadoLoteEnum
from app.modules.inventory.repository import IInventoryRepository


class InventoryRepositoryImpl(IInventoryRepository):
    """Implementación SQLAlchemy async del repositorio de inventario."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    # ── AbstractRepository base methods (Lote as the primary model) ─────────

    async def get_by_id(self, pk: int) -> Lote | None:
        stmt = select(Lote).where(Lote.id_lote == pk)
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_all(self, *, limit: int = 100, offset: int = 0) -> list[Lote]:
        stmt = select(Lote).order_by(Lote.id_lote.desc()).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, entity: Lote) -> Lote:
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def update(self, entity: Lote) -> Lote:
        await self._session.flush()
        return entity

    async def delete(self, pk: int) -> None:
        # Los lotes no se eliminan físicamente — soft delete vía estado_lote
        raise NotImplementedError("Los lotes son inmutables. No se eliminan físicamente.")

    async def exists(self, pk: int) -> bool:
        stmt = select(Lote.id_lote).where(Lote.id_lote == pk)
        result = await self._session.execute(stmt)
        return result.scalars().first() is not None

    # ── Lotes ────────────────────────────────────────────────────────────────

    async def create_lote(self, lote: Lote) -> Lote:
        """
        Inserta un nuevo lote.
        NeonDB ejecuta automáticamente:
          1. tg_lotes_validar_insert  → normaliza y valida fecha_vencimiento.
          2. tg_lotes_post_insert     → incrementa stock_actual y registra INGRESO_COMPRA en Kardex.
        """
        from datetime import UTC
        if lote.fecha_vencimiento is not None and lote.fecha_vencimiento.tzinfo is not None:
            lote.fecha_vencimiento = lote.fecha_vencimiento.astimezone(UTC).replace(tzinfo=None)
        self._session.add(lote)
        await self._session.flush()
        await self._session.refresh(lote)
        return lote

    async def get_lotes_by_producto(
        self,
        id_producto: int | None,
        *,
        solo_vigentes: bool = True,
    ) -> list[Lote]:
        stmt = select(Lote)
        if id_producto is not None:
            stmt = stmt.where(Lote.id_producto == id_producto)
            stmt = stmt.order_by(
                Lote.fecha_vencimiento.asc().nullslast(),
                Lote.id_lote.asc(),
            )
        else:
            stmt = stmt.order_by(Lote.id_lote.desc())
            
        if solo_vigentes:
            stmt = stmt.where(Lote.estado_lote == EstadoLoteEnum.VIGENTE)

        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_next_fefo_lot(self, id_producto: int) -> Lote | None:
        """
        Retorna el primer lote VIGENTE con stock > 0 según orden FEFO.

        ⚠️ Solo informativo — el FEFO real es ejecutado por los triggers de NeonDB.
        """
        stmt = (
            select(Lote)
            .where(
                Lote.id_producto == id_producto,
                Lote.estado_lote == EstadoLoteEnum.VIGENTE,
                Lote.cantidad_disponible > 0,
            )
            .order_by(
                Lote.fecha_vencimiento.asc().nullslast(),
                Lote.id_lote.asc(),
            )
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    # ── Ajustes Manuales ─────────────────────────────────────────────────────

    async def create_movimiento(self, movimiento: MovimientoStock) -> MovimientoStock:
        """
        Inserta un ajuste en el Kardex.
        NeonDB ejecuta tg_movimientos_stock_ajustes (BEFORE INSERT), que:
          1. Valida que id_lote sea obligatorio.
          2. Verifica que el lote no esté VENCIDO.
          3. Actualiza cantidad_disponible del lote.
          4. Actualiza stock_actual del producto.
          5. Calcula y asigna stock_resultante antes de la inserción.
        """
        self._session.add(movimiento)
        await self._session.flush()
        await self._session.refresh(movimiento)
        return movimiento

    # ── Kardex (paginado) ────────────────────────────────────────────────────

    async def get_kardex_by_producto(
        self,
        id_producto: int | None,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[MovimientoStock], int]:
        # Count total
        count_stmt = select(func.count()).select_from(MovimientoStock)
        if id_producto is not None:
            count_stmt = count_stmt.where(MovimientoStock.id_producto == id_producto)
            
        total: int = (await self._session.execute(count_stmt)).scalar_one()

        # Fetch page
        stmt = select(MovimientoStock)
        if id_producto is not None:
            stmt = stmt.where(MovimientoStock.id_producto == id_producto)
            
        stmt = stmt.order_by(MovimientoStock.fecha_movimiento.desc()).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all()), total

    # ── Conciliación ─────────────────────────────────────────────────────────

    async def get_reconciliation_all(
        self,
        *,
        solo_descuadrados: bool = False,
    ) -> list[dict]:
        """
        Consulta la vista vw_inventory_reconciliation.
        Retorna una lista de dicts con las tres fuentes de verdad por producto.
        """
        base_sql = """
            SELECT
                id_producto,
                nombre,
                stock_actual,
                stock_calculado_kardex,
                stock_calculado_lotes,
                (
                    stock_actual <> stock_calculado_kardex
                    OR stock_actual <> stock_calculado_lotes
                ) AS descuadrado
            FROM vw_inventory_reconciliation
        """
        if solo_descuadrados:
            base_sql += """
            WHERE (
                stock_actual <> stock_calculado_kardex
                OR stock_actual <> stock_calculado_lotes
            )
            """
        base_sql += "ORDER BY id_producto"

        result = await self._session.execute(text(base_sql))
        rows = result.mappings().all()
        return [dict(row) for row in rows]
