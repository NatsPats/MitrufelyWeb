"""
Mitrufely Web — Reports Module Schemas (Fase 7)
Esquemas de los siete reportes funcionales y de las solicitudes de exportación.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# ── Tipos de reporte disponibles ──────────────────────────────────────────────

ReporteTipo = Literal[
    "ventas",        # 1. Rendimiento de Ventas
    "pedidos",       # 2. Seguimiento de Pedidos
    "catalogo",      # 3. Catálogo Comercial
    "inventario",    # 4. Control de Inventario
    "usuarios",      # 5. Gestión de Usuarios
    "fidelizacion",  # 7. Fidelización SweetCoins / CriptoTrufa
]
"""Seis reportes tabulares. Comprobantes (6) se generan por venta, no como reporte tabular."""


# ── DTOs consolidados de cada reporte ─────────────────────────────────────────


class ReporteVentasItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_venta: int
    fecha_venta: datetime
    cliente: str = Field(..., description="Nombre completo del cliente.")
    estado: str
    estado_pago: str
    subtotal_productos: Decimal
    base_imponible: Decimal
    igv: Decimal
    total: Decimal
    metodo_pago: Optional[str] = None
    monto_descuento_cupon: Optional[Decimal] = None
    id_cupon_cliente: Optional[int] = None
    cupon_codigo: Optional[str] = None


class ReporteVentasResponse(BaseModel):
    items: list[ReporteVentasItem]
    total_ventas: Decimal = Field(Decimal("0"), description="Suma de totales (sin anulados).")
    cantidad_pedidos: int = 0
    ticket_promedio: Decimal = Decimal("0")


class ReportePedidosItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_venta: int
    cliente: str
    estado: str
    estado_pago: str
    fecha_venta: datetime
    delivery_completed_at: Optional[datetime] = None
    total_final: Decimal
    ultimo_evento: Optional[str] = None


class ReportePedidosResponse(BaseModel):
    items: list[ReportePedidosItem]
    por_estado: dict[str, int] = Field(
        default_factory=dict, description="Conteo de pedidos por estado FSM."
    )
    total_pedidos: int = 0


class ReporteCatalogoItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_producto: int
    nombre: str
    categoria: Optional[str] = None
    precio: Decimal
    stock_actual: int
    stock_minimo: int
    estado: bool


class ReporteCatalogoResponse(BaseModel):
    items: list[ReporteCatalogoItem]
    total_productos: int = 0
    productos_activos: int = 0
    productos_inactivos: int = 0


class ReporteInventarioItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_producto: int
    nombre: str
    categoria: Optional[str] = None
    stock_actual: int
    stock_minimo: int
    estado_stock: Literal["DISPONIBLE", "BAJO", "AGOTADO"]
    valorizacion: Decimal = Field(..., description="stock_actual * precio.")


class ReporteInventarioResponse(BaseModel):
    items: list[ReporteInventarioItem]
    total_productos: int = 0
    productos_bajo_stock: int = 0
    productos_agotados: int = 0
    valor_inventario: Decimal = Decimal("0")


class ReporteUsuariosItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_usuario: int
    nombres: str
    apellidos: str
    email: str
    rol: str
    estado: bool
    auth_provider: str
    total_ventas: int = 0
    ultima_actividad: Optional[datetime] = None


class ReporteUsuariosResponse(BaseModel):
    items: list[ReporteUsuariosItem]
    total_usuarios: int = 0
    activos: int = 0
    inactivos: int = 0


class ReporteFidelizacionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_cliente: int
    cliente: str
    email: str
    saldo_puntos: int = 0
    puntos_usados: int = 0
    cupones_disponibles: int = 0
    cupones_usados: int = 0


class ReporteFidelizacionResponse(BaseModel):
    items: list[ReporteFidelizacionItem]
    total_clientes: int = 0
    puntos_circulacion: int = Field(0, description="Suma de saldos activos.")
    cupones_disponibles_total: int = 0


# ── Solicitudes de generación ─────────────────────────────────────────────────


class ReporteFiltrosRequest(BaseModel):
    """Filtros comunes aplicables a los reportes tabulares."""

    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None
    estado: Optional[str] = None
    search: Optional[str] = None


class ReporteExportResponse(BaseModel):
    """Respuesta de una exportación en segundo plano (Celery)."""

    task_id: str
    status: Literal["PENDING"] = "PENDING"
    reporte: ReporteTipo
    formato: Literal["pdf", "xlsx"]
    mensaje: str = "Generación encolada. Consulte el estado con GET /reports/export/{task_id}."
