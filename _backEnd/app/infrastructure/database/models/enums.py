"""
Mifrufely Web     Database Enum Definitions
Maps all PostgreSQL ENUM types + simple string enums to Python Enum classes.

These classes mirror the physical ENUMs already created in NeonDB.
Using str-mixins ensures seamless JSON serialization via Pydantic and ORJSONResponse.

M14 additions (2026-06-21):
  - EstadoVentaEnum: +PREPARANDO, +EN_CAMINO, +CANCELADO, +DEVUELTO, +REEMBOLSADO
  - EstadoPagoEnum: +REEMBOLSADO
  - TipoEventoVentaEnum: historial de eventos del pedido
  - EstadoEntregaEnum: estados internos del microservicio de entregas
  - TipoIncidenciaEnum: tipos de incidencia reportable
  - EstadoIncidenciaEnum: ciclo de vida de una incidencia
  - TipoNotificacionEnum: tipos de notificación en BD
"""

import enum


class TipoRolEnum(str, enum.Enum):
    """Roles de usuario dentro del sistema. Tabla: roles."""
    ADMIN = "ADMIN"
    CLIENTE = "CLIENTE"


class AuthProviderEnum(str, enum.Enum):
    """Proveedor de autenticación del usuario. Columna: usuarios.auth_provider."""
    LOCAL = "local"
    GOOGLE = "google"


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
    """
    Estado del ciclo de vida de una venta. Tablas: ventas, historial_estados_venta.

    Máquina de estados válida (ver state_machine.py):
      PENDIENTE        PAGADO | CANCELADO
      PAGADO           PREPARANDO | CANCELADO
      PREPARANDO       EN_CAMINO | CANCELADO
      EN_CAMINO        ENTREGADO
      ENTREGADO        DEVUELTO
      CANCELADO        REEMBOLSADO
      DEVUELTO         REEMBOLSADO
      REEMBOLSADO      (terminal)
      ANULADO          (terminal     Celery auto-expire)
    """
    PENDIENTE = "PENDIENTE"
    PAGADO = "PAGADO"
    PREPARANDO = "PREPARANDO"      # M14: pedido en cocina/preparación
    EN_CAMINO = "EN_CAMINO"        # M14: pedido despachado al repartidor
    ENTREGADO = "ENTREGADO"
    CANCELADO = "CANCELADO"        # M14: cancelado antes del despacho
    DEVUELTO = "DEVUELTO"          # M14: devuelto tras la entrega
    REEMBOLSADO = "REEMBOLSADO"    # M14: reembolso procesado
    ANULADO = "ANULADO"            # Expiración automática por Celery


class EstadoPagoEnum(str, enum.Enum):
    """Estado del pago asociado a una venta. Tabla: ventas."""
    PENDIENTE = "PENDIENTE"
    PAGADO = "PAGADO"
    REEMBOLSADO = "REEMBOLSADO"    # M14: pago revertido


class TipoPagoEnum(str, enum.Enum):
    """Método/tipo de pago registrado. Tabla: metodos_pago."""
    TARJETA = "TARJETA"


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


class TipoEventoVentaEnum(str, enum.Enum):
    """
    Tipo de evento registrado en order_events.
    Cada transición de estado genera uno o más eventos.
    """
    PEDIDO_CREADO = "PEDIDO_CREADO"
    PAGO_CONFIRMADO = "PAGO_CONFIRMADO"
    STOCK_COMPROMETIDO = "STOCK_COMPROMETIDO"
    PREPARACION_INICIADA = "PREPARACION_INICIADA"
    PEDIDO_DESPACHADO = "PEDIDO_DESPACHADO"
    PEDIDO_ENTREGADO = "PEDIDO_ENTREGADO"
    CANCELACION_SOLICITADA = "CANCELACION_SOLICITADA"
    CANCELACION_APROBADA = "CANCELACION_APROBADA"
    DEVOLUCION_SOLICITADA = "DEVOLUCION_SOLICITADA"
    DEVOLUCION_APROBADA = "DEVOLUCION_APROBADA"
    REEMBOLSO_PROCESADO = "REEMBOLSO_PROCESADO"
    STOCK_DEVUELTO = "STOCK_DEVUELTO"
    INCIDENCIA_REGISTRADA = "INCIDENCIA_REGISTRADA"
    CALIFICACION_RECIBIDA = "CALIFICACION_RECIBIDA"
    NOTIFICACION_ENVIADA = "NOTIFICACION_ENVIADA"
    ETA_CALCULADO = "ETA_CALCULADO"


class EstadoEntregaEnum(str, enum.Enum):
    """Estados internos del microservicio delivery-service."""
    ASIGNADO = "ASIGNADO"
    RECOGIDO = "RECOGIDO"
    EN_RUTA = "EN_RUTA"
    ENTREGADO = "ENTREGADO"


class TipoIncidenciaEnum(str, enum.Enum):
    """Tipo de incidencia reportable sobre un pedido. Tabla: order_issues."""
    PEDIDO_PERDIDO = "PEDIDO_PERDIDO"
    PEDIDO_DANADO = "PEDIDO_DANADO"
    PEDIDO_INCOMPLETO = "PEDIDO_INCOMPLETO"
    ERROR_ENTREGA = "ERROR_ENTREGA"


class EstadoIncidenciaEnum(str, enum.Enum):
    """Estado del ciclo de vida de una incidencia. Tabla: order_issues."""
    ABIERTA = "ABIERTA"
    EN_REVISION = "EN_REVISION"
    RESUELTA = "RESUELTA"
    CERRADA = "CERRADA"


class TipoResolucionEnum(str, enum.Enum):
    """Tipo de resolución para una incidencia."""
    SOLO_INFO = "SOLO_INFO"
    DEVOLUCION = "DEVOLUCION"
    REEMBOLSO = "REEMBOLSO"


class TipoNotificacionEnum(str, enum.Enum):
    """Tipos de notificación almacenadas en BD. Tabla: notifications."""
    PEDIDO_CONFIRMADO = "PEDIDO_CONFIRMADO"
    PEDIDO_PAGADO = "PEDIDO_PAGADO"
    PEDIDO_PREPARANDO = "PEDIDO_PREPARANDO"
    PEDIDO_EN_CAMINO = "PEDIDO_EN_CAMINO"
    PEDIDO_ENTREGADO = "PEDIDO_ENTREGADO"
    PEDIDO_CANCELADO = "PEDIDO_CANCELADO"
    PEDIDO_REEMBOLSADO = "PEDIDO_REEMBOLSADO"
    INCIDENCIA_CREADA = "INCIDENCIA_CREADA"
    INCIDENCIA_RESUELTA = "INCIDENCIA_RESUELTA"
