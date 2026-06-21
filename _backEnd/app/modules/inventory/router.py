"""
Mifrufely Web — Inventory Module: FastAPI Router (Fase 3)

Endpoints:
  POST   /inventory/lots                     — Registrar nuevo lote
  GET    /inventory/lots/{id_producto}       — Listar lotes de un producto
  POST   /inventory/adjustments              — Ajuste manual de stock
  GET    /inventory/kardex/{id_producto}     — Kardex paginado de un producto
  GET    /inventory/fefo/{id_producto}       — Próximo lote FEFO (informativo)
  GET    /inventory/reconciliation           — Conciliación triple

RBAC:
  - Escritura (POST): rol ADMIN (requiere Permission.INVENTORY_WRITE).
  - Lectura (GET):    rol ADMIN (requiere Permission.INVENTORY_READ).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import ORJSONResponse

from app.core.constants import Permission
from app.modules.inventory.dependencies import get_inventory_service
from app.modules.inventory.schemas import (
    AjusteStockRequest,
    LoteCreateRequest,
    LoteResponse,
    MovimientoStockResponse,
    NextLotResponse,
    ReconciliationResponse,
)
from app.modules.inventory.service import InventoryService
from app.security.dependencies import require_permission
from app.shared.schemas.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/inventory", tags=["Inventory"])

# ── Type Aliases ──────────────────────────────────────────────────────────────

InventoryServiceDep = Annotated[InventoryService, Depends(get_inventory_service)]

# ── Dependencias de permisos ──────────────────────────────────────────────────

_write_dep = Depends(require_permission(Permission.INVENTORY_WRITE))
_read_dep  = Depends(require_permission(Permission.INVENTORY_READ))


# ── Lotes ─────────────────────────────────────────────────────────────────────

@router.post(
    "/lots",
    response_model=LoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar nuevo lote de mercancía",
    dependencies=[_write_dep],
)
async def create_lot(
    payload: LoteCreateRequest,
    service: InventoryServiceDep,
    current_user: Annotated[object, Depends(require_permission(Permission.INVENTORY_WRITE))],
) -> LoteResponse:
    """
    Registra un nuevo lote físico. NeonDB ejecuta automáticamente:
    - Validación y normalización de la fecha de vencimiento.
    - Incremento de `productos.stock_actual`.
    - Inserción del movimiento `INGRESO_COMPRA` en el Kardex.
    """
    return await service.create_lote(payload, id_usuario=current_user.user_id)


@router.get(
    "/lots",
    response_model=list[LoteResponse],
    summary="Listar lotes de un producto o globales",
    dependencies=[_read_dep],
)
async def list_lots(
    service: InventoryServiceDep,
    id_producto: int | None = Query(default=None, description="Filtro opcional por producto"),
    solo_vigentes: bool = Query(default=True, description="Si true, retorna solo lotes VIGENTE"),
) -> list[LoteResponse]:
    """Retorna los lotes de un producto en orden FEFO (fecha_vencimiento ASC NULLS LAST)."""
    return await service.list_lotes_by_producto(id_producto, solo_vigentes=solo_vigentes)


# ── Ajustes Manuales ──────────────────────────────────────────────────────────

@router.post(
    "/adjustments",
    response_model=MovimientoStockResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Aplicar ajuste manual de inventario",
)
async def apply_adjustment(
    payload: AjusteStockRequest,
    service: InventoryServiceDep,
    current_user: Annotated[object, Depends(require_permission(Permission.INVENTORY_WRITE))],
) -> MovimientoStockResponse:
    """
    Registra un ajuste manual (AJUSTE_POSITIVO, AJUSTE_NEGATIVO o MERMA).

    - `id_lote` es siempre obligatorio.
    - Los lotes VENCIDOS son inmutables (la DB rechaza el intento).
    - El trigger NeonDB actualiza `lotes.cantidad_disponible` y `productos.stock_actual`.
    """
    return await service.apply_adjustment(payload, id_usuario=current_user.user_id)


# ── Kardex ────────────────────────────────────────────────────────────────────

@router.get(
    "/kardex",
    response_model=PaginatedResponse[MovimientoStockResponse],
    summary="Kardex de movimientos de un producto o global",
    dependencies=[_read_dep],
)
async def get_kardex(
    service: InventoryServiceDep,
    id_producto: int | None = Query(default=None, description="Filtro opcional por producto"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PaginatedResponse[MovimientoStockResponse]:
    """Retorna el historial paginado de movimientos (Kardex) de un producto o global."""
    params = PaginationParams(page=page, page_size=page_size)
    return await service.get_kardex(id_producto, params)


# ── FEFO Informativo ──────────────────────────────────────────────────────────

@router.get(
    "/fefo/{id_producto}",
    response_model=NextLotResponse,
    summary="Próximo lote FEFO de un producto (informativo)",
    dependencies=[_read_dep],
)
async def get_fefo_lot(
    id_producto: int,
    service: InventoryServiceDep,
) -> NextLotResponse:
    """
    **Solo informativo**: retorna el próximo lote que consumirá el algoritmo FEFO.

    ⚠️ El FEFO real de ventas lo ejecutan los triggers de NeonDB al procesar cada venta.
    Este endpoint es para monitoreo, dashboard y alertas de vencimiento próximo.
    """
    return await service.get_next_fefo_lot(id_producto)


# ── Conciliación Triple ───────────────────────────────────────────────────────

@router.get(
    "/reconciliation",
    response_model=list[ReconciliationResponse],
    summary="Conciliación triple de inventario (auditoría)",
    dependencies=[_read_dep],
)
async def get_reconciliation(
    service: InventoryServiceDep,
    solo_descuadrados: bool = Query(
        default=False,
        description="Si true, retorna solo los productos con stock descuadrado",
    ),
) -> list[ReconciliationResponse]:
    """
    Compara tres fuentes de inventario:
    - `stock_actual`: cache en tabla `productos`.
    - `stock_calculado_kardex`: suma de movimientos en `movimientos_stock`.
    - `stock_calculado_lotes`: suma de `lotes` VIGENTE con `cantidad_disponible > 0`.

    Un descuadre indica corrupción de datos o bypass de los triggers.
    """
    return await service.get_reconciliation(solo_descuadrados=solo_descuadrados)
