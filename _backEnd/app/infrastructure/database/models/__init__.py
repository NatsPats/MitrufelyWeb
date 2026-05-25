"""
Mifrufely Web — ORM Models Package
Aggregates all SQLAlchemy models so that they are registered with the
SQLAlchemy mapper registry (Base.metadata) when this package is imported.

Import order follows the SQL module dependency chain:
  M01 (enums) → M02 (usuarios) → M03 (catalogo) → M04 (cupones)
  → M05 (ventas) → M06 (recompensas)

IMPORTANT: All models must be imported here BEFORE any query or migration
runs. Failing to import a model means its table will be unknown to Base.metadata.
"""

# ── Enums (M01) ───────────────────────────────────────────────────────────────
from app.infrastructure.database.models.enums import (  # noqa: F401
    EstadoCuponEnum,
    EstadoLoteEnum,
    EstadoPagoEnum,
    EstadoTransaccionEnum,
    EstadoVentaEnum,
    OrigenCuponEnum,
    OrigenVentaEnum,
    TipoDocumentoFiscalEnum,
    TipoDocumentoVentaEnum,
    TipoMovimientoPuntosEnum,
    TipoMovimientoStockEnum,
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
)

# ── Recompensas / SweetCoins (M06) ────────────────────────────────────────────
from app.infrastructure.database.models.recompensas import (  # noqa: F401
    ConfiguracionRecompensas,
    MovimientoPuntos,
)

__all__ = [
    # Enums
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
    # M06
    "ConfiguracionRecompensas",
    "MovimientoPuntos",
]
