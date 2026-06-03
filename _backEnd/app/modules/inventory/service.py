"""
Mifrufely Web — Inventory Module: Service Layer (Fase 3)

Orquesta operaciones de inventario: ingreso de lotes, ajustes manuales,
consulta del Kardex, próximo lote FEFO y conciliación triple.

Principio Rector:
  NeonDB es el ÚNICO responsable de modificar el stock físico (stock_actual,
  cantidad_disponible). Este servicio solo ORQUESTA inserciones y lecturas.
"""

import structlog
from datetime import datetime, UTC
from sqlalchemy.exc import IntegrityError, DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BusinessRuleError,
    DatabaseError,
    NotFoundError,
)
from app.infrastructure.database.models.catalogo import Lote, MovimientoStock
from app.infrastructure.database.models.enums import EstadoLoteEnum
from app.modules.inventory.repository import IInventoryRepository
from app.modules.inventory.schemas import (
    AjusteStockRequest,
    LoteCreateRequest,
    LoteResponse,
    MovimientoStockResponse,
    NextLotResponse,
    ReconciliationResponse,
)
from app.shared.schemas.pagination import PaginatedResponse, PaginationParams

logger = structlog.get_logger(__name__)

# Días de anticipación para alertar sobre próximos vencimientos
_EXPIRY_ALERT_DAYS = 7


class InventoryService:
    """
    Servicio de inventario para Fase 3.

    Injecciones:
      - repo: repositorio de inventario (IInventoryRepository).
      - session: sesión async de SQLAlchemy para gestionar transacciones.
    """

    def __init__(
        self,
        repo: IInventoryRepository,
        session: AsyncSession,
    ) -> None:
        self._repo = repo
        self._session = session

    # ── Lotes ────────────────────────────────────────────────────────────────

    async def create_lote(
        self,
        payload: LoteCreateRequest,
        id_usuario: int,
    ) -> LoteResponse:
        """
        Registra un nuevo lote físico de mercancía.

        El trigger `tg_lotes_validar_insert` en NeonDB:
          - Rechaza fechas de vencimiento pasadas.
          - Normaliza cantidad_disponible = cantidad_inicial y estado_lote = VIGENTE.

        El trigger `tg_lotes_post_insert` en NeonDB:
          - Suma cantidad_inicial a productos.stock_actual.
          - Registra INGRESO_COMPRA en movimientos_stock.
        """
        log = logger.bind(id_producto=payload.id_producto, accion="create_lote")

        lote = Lote(
            id_producto=payload.id_producto,
            cantidad_inicial=payload.cantidad_inicial,
            cantidad_disponible=0,   # el trigger lo normaliza a cantidad_inicial
            fecha_vencimiento=payload.fecha_vencimiento,
            estado_lote=EstadoLoteEnum.VIGENTE,  # el trigger lo confirma
        )

        try:
            async with self._session.begin():
                lote = await self._repo.create_lote(lote)
        except IntegrityError as exc:
            log.warning("FK violation al crear lote", error=str(exc))
            raise NotFoundError(
                f"Producto con id={payload.id_producto} no existe."
            ) from exc
        except DBAPIError as exc:
            # Excepciones RAISE EXCEPTION lanzadas por los triggers de NeonDB
            detail = str(exc.orig) if exc.orig else str(exc)
            log.error("Error de trigger al insertar lote", error=detail)
            raise BusinessRuleError(detail) from exc

        log.info("Lote creado exitosamente", id_lote=lote.id_lote)
        return LoteResponse.model_validate(lote)

    async def list_lotes_by_producto(
        self,
        id_producto: int,
        solo_vigentes: bool = True,
    ) -> list[LoteResponse]:
        """Lista los lotes de un producto en orden FEFO."""
        lotes = await self._repo.get_lotes_by_producto(
            id_producto, solo_vigentes=solo_vigentes
        )
        return [LoteResponse.model_validate(l) for l in lotes]

    # ── Ajustes Manuales ─────────────────────────────────────────────────────

    async def apply_adjustment(
        self,
        payload: AjusteStockRequest,
        id_usuario: int,
    ) -> MovimientoStockResponse:
        """
        Registra un ajuste manual de inventario (AJUSTE_POSITIVO, AJUSTE_NEGATIVO o MERMA).

        El trigger `tg_movimientos_stock_ajustes` (BEFORE INSERT) en NeonDB:
          1. Valida que id_lote no sea nulo.
          2. Bloquea fila del lote (FOR UPDATE).
          3. Verifica que el lote no esté VENCIDO.
          4. Actualiza cantidad_disponible del lote.
          5. Bloquea fila del producto (FOR UPDATE) y actualiza stock_actual.
          6. Calcula y asigna stock_resultante antes de insertar la fila del Kardex.

        Este método NUNCA modifica lotes ni productos directamente.
        """
        log = logger.bind(
            id_producto=payload.id_producto,
            id_lote=payload.id_lote,
            tipo=payload.tipo_movimiento,
            accion="apply_adjustment",
        )

        movimiento = MovimientoStock(
            id_producto=payload.id_producto,
            id_lote=payload.id_lote,
            id_usuario=id_usuario,
            tipo_movimiento=payload.tipo_movimiento,
            cantidad=payload.cantidad,
            stock_resultante=0,   # El trigger BEFORE INSERT lo sobreescribe con el valor real
            observacion=payload.observacion,
        )

        try:
            async with self._session.begin():
                movimiento = await self._repo.create_movimiento(movimiento)
        except DBAPIError as exc:
            detail = str(exc.orig) if exc.orig else str(exc)
            log.error("Error de trigger al aplicar ajuste", error=detail)
            raise BusinessRuleError(detail) from exc

        log.info(
            "Ajuste de inventario registrado",
            id_movimiento=movimiento.id_movimiento_stock,
            stock_resultante=movimiento.stock_resultante,
        )
        return MovimientoStockResponse.model_validate(movimiento)

    # ── Kardex ───────────────────────────────────────────────────────────────

    async def get_kardex(
        self,
        id_producto: int,
        params: PaginationParams,
    ) -> PaginatedResponse[MovimientoStockResponse]:
        """Retorna el Kardex paginado de un producto, ordenado por fecha descendente."""
        movimientos, total = await self._repo.get_kardex_by_producto(
            id_producto,
            limit=params.limit,
            offset=params.offset,
        )
        items = [MovimientoStockResponse.model_validate(m) for m in movimientos]
        return PaginatedResponse.build(items=items, total=total, params=params)

    # ── FEFO Informativo ─────────────────────────────────────────────────────

    async def get_next_fefo_lot(self, id_producto: int) -> NextLotResponse:
        """
        Retorna datos del próximo lote que consumirá el algoritmo FEFO.

        ⚠️ SOLO INFORMATIVO para dashboard y alertas. El FEFO real de ventas
           lo ejecutan los triggers de NeonDB exclusivamente.
        """
        lote = await self._repo.get_next_fefo_lot(id_producto)

        if lote is None:
            raise NotFoundError(
                f"No hay lotes vigentes con stock disponible para el producto id={id_producto}."
            )

        dias_restantes: int | None = None
        if lote.fecha_vencimiento is not None:
            fv = lote.fecha_vencimiento
            if fv.tzinfo is None:
                fv = fv.replace(tzinfo=UTC)
            delta = fv - datetime.now(UTC)
            dias_restantes = max(delta.days, 0)

        return NextLotResponse(
            id_lote=lote.id_lote,
            id_producto=lote.id_producto,
            fecha_vencimiento=lote.fecha_vencimiento,
            cantidad_disponible=lote.cantidad_disponible,
            dias_restantes=dias_restantes,
        )

    # ── Conciliación Triple ───────────────────────────────────────────────────

    async def get_reconciliation(
        self,
        solo_descuadrados: bool = False,
    ) -> list[ReconciliationResponse]:
        """
        Consulta la vista vw_inventory_reconciliation y devuelve el estado
        de conciliación triple por producto.

        Un producto está 'descuadrado' si cualquiera de las tres fuentes
        (cache, kardex, lotes) difiere.
        """
        rows = await self._repo.get_reconciliation_all(solo_descuadrados=solo_descuadrados)
        return [
            ReconciliationResponse(
                id_producto=row["id_producto"],
                nombre=row["nombre"],
                stock_actual=row["stock_actual"],
                stock_calculado_kardex=row["stock_calculado_kardex"],
                stock_calculado_lotes=row["stock_calculado_lotes"],
                descuadrado=bool(row["descuadrado"]),
            )
            for row in rows
        ]
