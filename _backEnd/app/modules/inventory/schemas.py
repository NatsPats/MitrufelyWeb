"""
Mifrufely Web — Inventory Module: Pydantic Schemas (Fase 3)
Contratos de validación de entrada/salida para lotes, ajustes de stock
y conciliación de inventario.

Reglas de validación:
  - fecha_vencimiento: normalizada a UTC aware antes de comparar.
  - AjusteStockRequest.id_lote: obligatorio para TODOS los tipos de ajuste.
  - tipo_movimiento en AjusteStockRequest: solo AJUSTE_POSITIVO, AJUSTE_NEGATIVO o MERMA.
"""

from datetime import datetime, UTC
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.infrastructure.database.models.enums import EstadoLoteEnum, TipoMovimientoStockEnum

# ---------------------------------------------------------------------------
# Tipos de movimiento permitidos en ajustes manuales
# ---------------------------------------------------------------------------

_ALLOWED_ADJUSTMENT_TYPES = {
    TipoMovimientoStockEnum.AJUSTE_POSITIVO,
    TipoMovimientoStockEnum.AJUSTE_NEGATIVO,
    TipoMovimientoStockEnum.MERMA,
}


# ---------------------------------------------------------------------------
# Lotes
# ---------------------------------------------------------------------------

class LoteCreateRequest(BaseModel):
    """Payload para registrar un nuevo lote físico de mercancía."""

    id_producto: int = Field(..., gt=0, description="ID del producto físico")
    cantidad_inicial: int = Field(..., gt=0, description="Cantidad inicial del lote")
    fecha_vencimiento: datetime | None = Field(
        None,
        description="Fecha de vencimiento (UTC). Debe ser estrictamente futura.",
    )

    @field_validator("fecha_vencimiento", mode="after")
    @classmethod
    def normalise_and_validate_future(cls, v: datetime | None) -> datetime | None:
        """Normaliza la fecha a UTC aware y verifica que sea futura."""
        if v is None:
            return v

        # Normalizar a UTC aware
        v_utc = v.astimezone(UTC) if v.tzinfo is not None else v.replace(tzinfo=UTC)

        if v_utc <= datetime.now(UTC):
            raise ValueError(
                "La fecha de vencimiento debe ser estrictamente posterior a la fecha actual (UTC)."
            )
        return v_utc.replace(tzinfo=None)


class LoteResponse(BaseModel):
    """Representación de un lote físico para respuestas de API."""

    model_config = ConfigDict(from_attributes=True)

    id_lote: int
    id_producto: int
    fecha_ingreso: datetime
    fecha_vencimiento: datetime | None
    cantidad_inicial: int
    cantidad_disponible: int
    estado_lote: EstadoLoteEnum


# ---------------------------------------------------------------------------
# Ajustes Manuales de Stock
# ---------------------------------------------------------------------------

class AjusteStockRequest(BaseModel):
    """
    Payload para registrar un ajuste manual de inventario.

    Reglas de negocio:
      - id_lote es SIEMPRE obligatorio (el trigger BEFORE INSERT lo reafirma en DB).
      - Solo se permiten tipos: AJUSTE_POSITIVO, AJUSTE_NEGATIVO o MERMA.
      - Para mercancía nueva sin lote, registrar primero mediante POST /inventory/lots.
    """

    id_producto: int = Field(..., gt=0, description="ID del producto a ajustar")
    id_lote: int = Field(
        ...,
        gt=0,
        description="Lote físico al que aplica el ajuste. Obligatorio para todos los tipos.",
    )
    tipo_movimiento: TipoMovimientoStockEnum = Field(
        ...,
        description="Tipo de ajuste: AJUSTE_POSITIVO, AJUSTE_NEGATIVO o MERMA",
    )
    cantidad: int = Field(..., gt=0, description="Cantidad a ajustar (siempre positiva)")
    observacion: str | None = Field(None, max_length=500, description="Nota opcional del ajuste")

    @field_validator("tipo_movimiento")
    @classmethod
    def validate_adjustment_type(cls, v: TipoMovimientoStockEnum) -> TipoMovimientoStockEnum:
        if v not in _ALLOWED_ADJUSTMENT_TYPES:
            raise ValueError(
                f"Tipo de movimiento inválido: '{v}'. "
                "Solo se permiten AJUSTE_POSITIVO, AJUSTE_NEGATIVO o MERMA."
            )
        return v


# ---------------------------------------------------------------------------
# Kardex / Movimientos de Stock
# ---------------------------------------------------------------------------

class MovimientoStockResponse(BaseModel):
    """Representación de un movimiento en el Kardex para respuestas de API."""

    model_config = ConfigDict(from_attributes=True)

    id_movimiento_stock: int
    id_producto: int
    id_lote: int | None
    id_venta: int | None
    id_usuario: int | None
    tipo_movimiento: TipoMovimientoStockEnum
    cantidad: int
    stock_resultante: int
    costo_unitario: Decimal | None
    fecha_movimiento: datetime
    observacion: str | None


# ---------------------------------------------------------------------------
# Conciliación Triple de Inventario
# ---------------------------------------------------------------------------

class ReconciliationResponse(BaseModel):
    """
    Resultado de conciliar el stock desde tres fuentes independientes:
      - stock_actual: caché en tabla productos.
      - stock_calculado_kardex: suma de movimientos en movimientos_stock.
      - stock_calculado_lotes: suma de lotes VIGENTE con cantidad_disponible > 0.
    """

    id_producto: int
    nombre: str
    stock_actual: int
    stock_calculado_kardex: int
    stock_calculado_lotes: int
    descuadrado: bool


# ---------------------------------------------------------------------------
# Endpoint Informativo FEFO
# ---------------------------------------------------------------------------

class NextLotResponse(BaseModel):
    """
    Información del próximo lote que consumirá el algoritmo FEFO.

    ⚠️ SOLO INFORMATIVO: este endpoint es para monitoreo, dashboard y alertas
    de vencimiento. El algoritmo FEFO real de ventas se ejecuta exclusivamente
    dentro de los triggers de PostgreSQL (NeonDB).
    """

    id_lote: int
    id_producto: int
    fecha_vencimiento: datetime | None
    cantidad_disponible: int
    dias_restantes: int | None
