"""
Mifrufely Web — Database Enum Definitions
Maps all 13 PostgreSQL ENUM types (M01_enums_tipos.sql) to Python Enum classes.

These classes mirror the physical ENUMs already created in NeonDB.
Using str-mixins ensures seamless JSON serialization via Pydantic and ORJSONResponse.
"""

import enum


class TipoRolEnum(str, enum.Enum):
    """Roles de usuario dentro del sistema. Tabla: roles."""
    ADMIN = "ADMIN"
    CLIENTE = "CLIENTE"
    CAJERO = "CAJERO"
    ALMACEN = "ALMACEN"


class TipoDocumentoFiscalEnum(str, enum.Enum):
    """Tipo de documento fiscal del cliente. Tabla: datos_fiscales."""
    DNI = "DNI"
    RUC = "RUC"


class EstadoLoteEnum(str, enum.Enum):
    """Estado de vida de un lote de producto. Tabla: lotes."""
    VIGENTE = "VIGENTE"
    AGOTADO = "AGOTADO"
    VENCIDO = "VENCIDO"


class TipoMovimientoStockEnum(str, enum.Enum):
    """Tipo de movimiento en el Kardex de stock. Tabla: movimientos_stock."""
    INGRESO_COMPRA = "INGRESO_COMPRA"
    VENTA = "VENTA"
    AJUSTE_POSITIVO = "AJUSTE_POSITIVO"
    AJUSTE_NEGATIVO = "AJUSTE_NEGATIVO"
    MERMA = "MERMA"
    VENCIMIENTO = "VENCIMIENTO"
    DEVOLUCION = "DEVOLUCION"


class EstadoCuponEnum(str, enum.Enum):
    """Estado del cupón de un cliente específico. Tabla: cupones_cliente."""
    DISPONIBLE = "DISPONIBLE"
    USADO = "USADO"
    EXPIRADO = "EXPIRADO"


class OrigenCuponEnum(str, enum.Enum):
    """Forma en que el cliente obtuvo un cupón. Tabla: cupones_cliente."""
    COMPRA_PUNTOS = "COMPRA_PUNTOS"
    REGALO_ADMIN = "REGALO_ADMIN"
    PREMIO_JUEGO = "PREMIO_JUEGO"
    REGISTRO_NUEVO = "REGISTRO_NUEVO"


class OrigenVentaEnum(str, enum.Enum):
    """Canal de origen de una venta. Tabla: ventas."""
    WEB = "WEB"


class EstadoVentaEnum(str, enum.Enum):
    """Estado del ciclo de vida de una venta. Tablas: ventas, historial_estados_venta."""
    PENDIENTE = "PENDIENTE"
    PAGADO = "PAGADO"
    ENTREGADO = "ENTREGADO"
    ANULADO = "ANULADO"


class EstadoPagoEnum(str, enum.Enum):
    """Estado del pago asociado a una venta. Tabla: ventas."""
    PENDIENTE = "PENDIENTE"
    PAGADO = "PAGADO"


class TipoPagoEnum(str, enum.Enum):
    """Método/tipo de pago registrado. Tabla: metodos_pago."""
    EFECTIVO = "EFECTIVO"
    YAPE = "YAPE"
    TRANSFERENCIA = "TRANSFERENCIA"


class EstadoTransaccionEnum(str, enum.Enum):
    """Estado de procesamiento de una transacción de pago. Tabla: metodos_pago."""
    PENDIENTE = "PENDIENTE"
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"
    ANULADO = "ANULADO"


class TipoDocumentoVentaEnum(str, enum.Enum):
    """Tipo de documento fiscal emitido para una venta. Tabla: documentos."""
    BOLETA = "BOLETA"
    FACTURA = "FACTURA"
    REPORTE = "REPORTE"


class TipoMovimientoPuntosEnum(str, enum.Enum):
    """Tipo de movimiento en el saldo de puntos SweetCoins. Tabla: movimientos_puntos."""
    ACUMULACION_VENTA = "ACUMULACION_VENTA"
    COMPRA_CUPON = "COMPRA_CUPON"
    PAGO_JUEGO = "PAGO_JUEGO"
    PREMIO_JUEGO = "PREMIO_JUEGO"
    EXPIRACION = "EXPIRACION"
    AJUSTE_ADMIN = "AJUSTE_ADMIN"
