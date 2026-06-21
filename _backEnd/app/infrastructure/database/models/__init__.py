"""
Mifrufely Web — ORM Models Package
Aggregates all SQLAlchemy models so that they are registered with the
SQLAlchemy mapper registry (Base.metadata) when this package is imported.

Import order follows the SQL module dependency chain:
  M01 (enums) → M02 (usuarios) → M03 (catalogo) → M04 (cupones)
  → M05 (ventas) → M06 (recompensas) → M14 (pedidos_ext)

IMPORTANT: All models must be imported here BEFORE any query or migration
runs. Failing to import a model means its table will be unknown to Base.metadata.
"""

# ── Enums (M01) ───────────────────────────────────────────────────────────────
from app.infrastructure.database.models.enums import (  # noqa: F401
    EstadoCuponEnum,
    EstadoEntregaEnum,
    EstadoIncidenciaEnum,
    EstadoLoteEnum,
    EstadoPagoEnum,
    EstadoTransaccionEnum,
    EstadoVentaEnum,
    OrigenCuponEnum,
    OrigenVentaEnum,
    TipoDocumentoFiscalEnum,
    TipoDocumentoVentaEnum,
    TipoEventoVentaEnum,
    TipoIncidenciaEnum,
    TipoMovimientoPuntosEnum,
    TipoMovimientoStockEnum,
    TipoNotificacionEnum,
    TipoPagoEnum,
    TipoRolEnum,
)

# ── Usuarios / Roles (M02) ────────────────────────────────────────────────────
from app.infrastructure.database.models.usuarios import (  # noqa: F401
    Cliente,
    DatosFiscales,
    LogSistema,
    Rol,
    Usuario,
)

# ── Catálogo / Inventario (M03) ───────────────────────────────────────────────
from app.infrastructure.database.models.catalogo import (  # noqa: F401
    Categoria,
    Lote,
    MovimientoStock,
    Paquete,
    PaqueteProducto,
    Producto,
)

# ── Cupones (M04) ─────────────────────────────────────────────────────────────
from app.infrastructure.database.models.cupones import (  # noqa: F401
    CuponCliente,
    CuponMaestro,
)

# ── Ventas / Pagos (M05) ──────────────────────────────────────────────────────
from app.infrastructure.database.models.ventas import (  # noqa: F401
    DetalleVenta,
    DetalleVentaLotes,
    Documento,
    HistorialEstadosVenta,
    MetodoPago,
    Venta,
    VentaPaquete,
)

# ── Recompensas / SweetCoins (M06) ────────────────────────────────────────────
from app.infrastructure.database.models.recompensas import (  # noqa: F401
    ConfiguracionRecompensas,
    MovimientoPuntos,
)

# ── Pedidos Extendido (M14) ───────────────────────────────────────────────────
from app.infrastructure.database.models.pedidos_ext import (  # noqa: F401
    Notification,
    OrderEvent,
    OrderIssue,
    OrderRefund,
    OrderReview,
    SystemConfig,
)

__all__ = [
    # Enums M01
    "TipoRolEnum",
    "TipoDocumentoFiscalEnum",
    "EstadoLoteEnum",
    "TipoMovimientoStockEnum",
    "EstadoCuponEnum",
    "OrigenCuponEnum",
    "OrigenVentaEnum",
    "EstadoVentaEnum",
    "EstadoPagoEnum",
    "TipoPagoEnum",
    "EstadoTransaccionEnum",
    "TipoDocumentoVentaEnum",
    "TipoMovimientoPuntosEnum",
    # M14 Enums
    "TipoEventoVentaEnum",
    "EstadoEntregaEnum",
    "TipoIncidenciaEnum",
    "EstadoIncidenciaEnum",
    "TipoNotificacionEnum",
    # M02
    "Rol",
    "Usuario",
    "Cliente",
    "DatosFiscales",
    "LogSistema",
    # M03
    "Categoria",
    "Producto",
    "Lote",
    "MovimientoStock",
    "Paquete",
    "PaqueteProducto",
    # M04
    "CuponMaestro",
    "CuponCliente",
    # M05
    "Venta",
    "HistorialEstadosVenta",
    "DetalleVenta",
    "DetalleVentaLotes",
    "MetodoPago",
    "Documento",
    "VentaPaquete",
    # M06
    "ConfiguracionRecompensas",
    "MovimientoPuntos",
    # M14
    "OrderEvent",
    "OrderRefund",
    "OrderReview",
    "OrderIssue",
    "SystemConfig",
    "Notification",
]
