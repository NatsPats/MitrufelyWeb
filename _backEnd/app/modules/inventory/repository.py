"""
Mifrufely Web — Inventory Module: Repository Interface (Fase 3)
Contrato abstracto para el repositorio de inventario.
"""

from abc import ABC, abstractmethod

from app.domain.repositories.base import AbstractRepository
from app.infrastructure.database.models.catalogo import (
    Lote,
    MovimientoStock,
)


class IInventoryRepository(AbstractRepository[Lote, int], ABC):
    """Contrato para el repositorio de lotes y movimientos de stock."""

    # ── Lotes ──────────────────────────────────────────────────────────────

    @abstractmethod
    async def create_lote(self, lote: Lote) -> Lote:
        """Inserta un nuevo lote en la DB (dispara tg_lotes_validar_insert + tg_lotes_post_insert)."""
        ...

    @abstractmethod
    async def get_lotes_by_producto(
        self,
        id_producto: int | None,
        *,
        solo_vigentes: bool = True,
    ) -> list[Lote]:
        """
        Lista todos los lotes de un producto, ordenados FEFO
        (fecha_vencimiento ASC NULLS LAST).
        """
        ...

    @abstractmethod
    async def get_next_fefo_lot(self, id_producto: int) -> Lote | None:
        """
        Retorna el próximo lote VIGENTE para consumo FEFO.

        ⚠️ SOLO INFORMATIVO: el FEFO real lo ejecutan los triggers en NeonDB.
        """
        ...

    # ── Ajustes Manuales ───────────────────────────────────────────────────

    @abstractmethod
    async def create_movimiento(self, movimiento: MovimientoStock) -> MovimientoStock:
        """
        Inserta un movimiento de ajuste en el Kardex.
        El trigger `tg_movimientos_stock_ajustes` se encarga de actualizar
        lotes y productos atómicamente en la DB antes de insertar la fila.
        """
        ...

    # ── Kardex ─────────────────────────────────────────────────────────────

    @abstractmethod
    async def get_kardex_by_producto(
        self,
        id_producto: int | None,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[MovimientoStock], int]:
        """Retorna el Kardex paginado de un producto junto con el total de filas."""
        ...

    # ── Conciliación ───────────────────────────────────────────────────────

    @abstractmethod
    async def get_reconciliation_all(
        self,
        *,
        solo_descuadrados: bool = False,
    ) -> list[dict]:
        """
        Consulta la vista `vw_inventory_reconciliation` y devuelve la
        conciliación triple (stock_actual vs kardex vs lotes) para todos
        los productos.
        """
        ...
