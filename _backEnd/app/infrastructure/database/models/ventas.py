"""
Mifrufely Web — ORM Models: Ventas y Pagos (Módulo M05)
Corresponds to: M05_ventas_pagos.sql

Tables:
  - ventas
  - historial_estados_venta
  - detalles_venta
  - detalle_venta_lotes
  - metodos_pago
  - documentos
"""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base
from app.infrastructure.database.models.enums import (
    EstadoPagoEnum,
    EstadoTransaccionEnum,
    EstadoVentaEnum,
    OrigenVentaEnum,
    TipoDocumentoVentaEnum,
    TipoPagoEnum,
)

if TYPE_CHECKING:
    from app.infrastructure.database.models.catalogo import Lote, MovimientoStock, Producto
    from app.infrastructure.database.models.cupones import CuponCliente
    from app.infrastructure.database.models.pedidos_ext import (
        Notification,
        OrderEvent,
        OrderIssue,
        OrderRefund,
        OrderReview,
    )
    from app.infrastructure.database.models.recompensas import MovimientoPuntos
    from app.infrastructure.database.models.usuarios import Cliente, Usuario


# ── Venta ─────────────────────────────────────────────────────────────────────


class Venta(Base):
    """
    Cabecera de una orden de venta.
    Tabla: ventas | M05_ventas_pagos.sql

    IMPORTANT TRIGGERS IN NEONDB:
      - tg_ventas_historial: Logs state changes to historial_estados_venta.
      - tg_ventas_otorgar_puntos: Grants SweetCoins when estado_pago → PAGADO.
      - tg_ventas_anular: Reverts stock, coupon and points when estado → ANULADO.
    """

    __tablename__ = "ventas"

    id_venta: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_cliente: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("clientes.id_cliente", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    id_cupon_cliente: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("cupones_cliente.id_cupon_cliente", ondelete="RESTRICT"),
        nullable=True,
        unique=True,
        index=True,
    )
    origen_venta: Mapped[OrigenVentaEnum] = mapped_column(
        PG_ENUM(OrigenVentaEnum, name="origen_venta_enum", create_type=False),
        nullable=False,
    )
    estado: Mapped[EstadoVentaEnum] = mapped_column(
        PG_ENUM(EstadoVentaEnum, name="estado_venta_enum", create_type=False),
        nullable=False,
        default=EstadoVentaEnum.PENDIENTE,
        index=True,
    )
    estado_pago: Mapped[EstadoPagoEnum] = mapped_column(
        PG_ENUM(EstadoPagoEnum, name="estado_pago_enum", create_type=False),
        nullable=False,
        default=EstadoPagoEnum.PENDIENTE,
        index=True,
    )
    subtotal_productos: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0")
    )
    costo_envio: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0")
    )
    monto_descuento_cupon: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0")
    )
    base_imponible: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0")
    )
    igv: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    puntos_ganados: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fecha_venta: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # ── M14: Campos de envío, ETA y reembolso ──────────────────────────────
    shipping_cost_applied: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0")
    )
    free_shipping_applied: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    total_final: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0")
    )
    delivery_eta: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delivery_completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    refund_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    refund_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relaciones ─────────────────────────────────────────────────────────
    cliente: Mapped["Cliente"] = relationship("Cliente", back_populates="ventas", lazy="select")
    cupon_cliente: Mapped["CuponCliente | None"] = relationship(
        "CuponCliente", back_populates="ventas", lazy="select"
    )
    historial_estados: Mapped[list["HistorialEstadosVenta"]] = relationship(
        "HistorialEstadosVenta", back_populates="venta", lazy="select"
    )
    detalles: Mapped[list["DetalleVenta"]] = relationship(
        "DetalleVenta", back_populates="venta", lazy="select"
    )
    paquetes_vendidos: Mapped[list["VentaPaquete"]] = relationship(
        "VentaPaquete", back_populates="venta", lazy="select"
    )
    metodos_pago: Mapped[list["MetodoPago"]] = relationship(
        "MetodoPago", back_populates="venta", lazy="select"
    )
    documentos: Mapped[list["Documento"]] = relationship(
        "Documento", back_populates="venta", lazy="select"
    )
    movimientos_stock: Mapped[list["MovimientoStock"]] = relationship(
        "MovimientoStock", back_populates="venta", lazy="select"
    )
    movimientos_puntos: Mapped[list["MovimientoPuntos"]] = relationship(
        "MovimientoPuntos", back_populates="venta", lazy="select"
    )

    # ── M14: Relaciones con nuevas tablas ──────────────────────────────────
    order_events: Mapped[list["OrderEvent"]] = relationship(
        "OrderEvent", back_populates="venta", lazy="select", order_by="OrderEvent.created_at"
    )
    order_refund: Mapped["OrderRefund | None"] = relationship(
        "OrderRefund", back_populates="venta", uselist=False, lazy="select"
    )
    order_review: Mapped["OrderReview | None"] = relationship(
        "OrderReview", back_populates="venta", uselist=False, lazy="select"
    )
    order_issues: Mapped[list["OrderIssue"]] = relationship(
        "OrderIssue", back_populates="venta", lazy="select"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", back_populates="venta", lazy="select"
    )


# ── HistorialEstadosVenta ─────────────────────────────────────────────────────


class HistorialEstadosVenta(Base):
    """
    Registro histórico de cambios de estado de una venta.
    Tabla: historial_estados_venta | M05_ventas_pagos.sql

    NOTE: Populated automatically by trigger tg_ventas_historial in NeonDB.
    """

    __tablename__ = "historial_estados_venta"

    id_historial: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_venta: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ventas.id_venta", ondelete="CASCADE"),
        nullable=False,
    )
    estado: Mapped[EstadoVentaEnum] = mapped_column(
        PG_ENUM(EstadoVentaEnum, name="estado_venta_enum", create_type=False),
        nullable=False,
    )
    fecha_cambio: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    id_usuario: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relaciones ─────────────────────────────────────────────────────────
    venta: Mapped["Venta"] = relationship(
        "Venta", back_populates="historial_estados", lazy="select"
    )
    usuario: Mapped["Usuario | None"] = relationship(
        "Usuario", back_populates="historial_ventas", lazy="select"
    )


# ── DetalleVenta ──────────────────────────────────────────────────────────────


class DetalleVenta(Base):
    """
    Línea de detalle de una venta (producto, cantidad, precio).
    Tabla: detalles_venta | M05_ventas_pagos.sql

    IMPORTANT TRIGGERS IN NEONDB:
      - tg_detalles_venta_asignar_lotes (AFTER INSERT): FEFO lote assignment,
        stock deduction and Kardex entry are handled by this trigger.
      - tg_detalles_venta_bloquear_update/delete: These rows are immutable once created.
    """

    __tablename__ = "detalles_venta"

    id_detalle: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_venta: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ventas.id_venta", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    id_producto: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("productos.id_producto", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # ── Relaciones ─────────────────────────────────────────────────────────
    venta: Mapped["Venta"] = relationship("Venta", back_populates="detalles", lazy="select")
    producto: Mapped["Producto"] = relationship(
        "Producto", back_populates="detalles_venta", lazy="select"
    )
    detalle_lotes: Mapped[list["DetalleVentaLotes"]] = relationship(
        "DetalleVentaLotes", back_populates="detalle", lazy="select"
    )


# ── VentaPaquete ──────────────────────────────────────────────────────────────


class VentaPaquete(Base):
    """
    Trazabilidad comercial: Registro de los paquetes comprados en esta venta,
    antes de ser expandidos a productos individuales en detalles_venta.
    Tabla: venta_paquetes | M05_ventas_pagos.sql
    """

    __tablename__ = "venta_paquetes"

    id_venta_paquete: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_venta: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ventas.id_venta", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    id_paquete: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("paquetes.id_paquete", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    nombre_paquete_snapshot: Mapped[str] = mapped_column(String(150), nullable=False)
    composicion_snapshot_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # ── Relaciones ─────────────────────────────────────────────────────────
    venta: Mapped["Venta"] = relationship(
        "Venta", back_populates="paquetes_vendidos", lazy="select"
    )
    # Se recomienda no mapear relacion directa con Paquete si se va a usar Soft Delete,
    # pero a nivel ORM SQLAlchemy lo soportaría asumiendo FK.


# ── DetalleVentaLotes ─────────────────────────────────────────────────────────


class DetalleVentaLotes(Base):
    """
    Asociación entre una línea de venta y los lotes físicos FEFO consumidos.
    Tabla: detalle_venta_lotes | M05_ventas_pagos.sql

    NOTE: Populated automatically by trigger tg_detalles_venta_asignar_lotes.
    Rows are immutable once created (blocked by tg_detalle_venta_lotes_bloquear_*).
    """

    __tablename__ = "detalle_venta_lotes"

    id_detalle_lote: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_detalle: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("detalles_venta.id_detalle", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    id_lote: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("lotes.id_lote", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Relaciones ─────────────────────────────────────────────────────────
    detalle: Mapped["DetalleVenta"] = relationship(
        "DetalleVenta", back_populates="detalle_lotes", lazy="select"
    )
    lote: Mapped["Lote"] = relationship("Lote", back_populates="detalle_venta_lotes", lazy="select")


# ── MetodoPago ────────────────────────────────────────────────────────────────


class MetodoPago(Base):
    """
    Registro de un pago asociado a una venta.
    Tabla: metodos_pago | M05_ventas_pagos.sql
    """

    __tablename__ = "metodos_pago"

    id_pago: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_venta: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ventas.id_venta", ondelete="CASCADE"),
        nullable=False,
    )
    tipo_pago: Mapped[TipoPagoEnum] = mapped_column(
        PG_ENUM(TipoPagoEnum, name="tipo_pago_enum", create_type=False),
        nullable=False,
    )
    monto: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    codigo_transaccion: Mapped[str | None] = mapped_column(String(100), nullable=True)
    proveedor: Mapped[str | None] = mapped_column(String(50), nullable=True)
    estado_transaccion: Mapped[EstadoTransaccionEnum] = mapped_column(
        PG_ENUM(EstadoTransaccionEnum, name="estado_transaccion_enum", create_type=False),
        nullable=False,
        default=EstadoTransaccionEnum.PENDIENTE,
    )
    fecha_pago: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # ── Relaciones ─────────────────────────────────────────────────────────
    venta: Mapped["Venta"] = relationship("Venta", back_populates="metodos_pago", lazy="select")


# ── Documento ─────────────────────────────────────────────────────────────────


class Documento(Base):
    """
    Documentos fiscales (boleta/factura/reporte) asociados a una venta.
    Tabla: documentos | M05_ventas_pagos.sql
    """

    __tablename__ = "documentos"

    id_documento: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_venta: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ventas.id_venta", ondelete="CASCADE"),
        nullable=False,
    )
    tipo_documento: Mapped[TipoDocumentoVentaEnum] = mapped_column(
        PG_ENUM(TipoDocumentoVentaEnum, name="tipo_documento_venta_enum", create_type=False),
        nullable=False,
    )
    numero_serie: Mapped[str | None] = mapped_column(String(10), nullable=True)
    numero_correlativo: Mapped[str | None] = mapped_column(String(20), nullable=True)
    url_archivo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fecha_generacion: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # ── Relaciones ─────────────────────────────────────────────────────────
    venta: Mapped["Venta"] = relationship("Venta", back_populates="documentos", lazy="select")
