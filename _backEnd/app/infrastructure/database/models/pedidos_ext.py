"""
Mifrufely Web — ORM Models: Pedidos Extendido (Módulo M14)
Corresponds to: M14_pedidos_extendido.sql

New Tables:
  - order_events    → Historial cronológico de eventos de un pedido
  - order_refunds   → Registro de reembolso simulado
  - order_reviews   → Calificación del cliente (1-5 estrellas)
  - order_issues    → Incidencias reportadas
  - system_config   → Configuración persistente del sistema
  - notifications   → Notificaciones en BD para polling
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
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base
from app.infrastructure.database.models.enums import (
    EstadoIncidenciaEnum,
    TipoEventoVentaEnum,
    TipoIncidenciaEnum,
    TipoNotificacionEnum,
)

if TYPE_CHECKING:
    from app.infrastructure.database.models.usuarios import Usuario
    from app.infrastructure.database.models.ventas import Venta


# ── OrderEvent ────────────────────────────────────────────────────────────────


class OrderEvent(Base):
    """
    Historial cronológico de eventos de un pedido.
    Tabla: order_events | M14_pedidos_extendido.sql

    Cada transición de estado, acción del cliente o del sistema genera
    al menos un evento. Los registros son inmutables una vez creados.
    """

    __tablename__ = "order_events"

    id_event: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_venta: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ventas.id_venta", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[TipoEventoVentaEnum] = mapped_column(
        PG_ENUM(TipoEventoVentaEnum, name="tipo_evento_venta_enum", create_type=False),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    detail_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), index=True
    )
    created_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relaciones ─────────────────────────────────────────────────────────
    venta: Mapped["Venta"] = relationship("Venta", back_populates="order_events", lazy="select")
    usuario: Mapped["Usuario | None"] = relationship("Usuario", lazy="select")


# ── OrderRefund ───────────────────────────────────────────────────────────────


class OrderRefund(Base):
    """
    Registro de reembolso simulado asociado a un pedido.
    Tabla: order_refunds | M14_pedidos_extendido.sql

    Un pedido solo puede tener un reembolso (UNIQUE en id_venta).
    El reembolso es simulado — no conecta con pasarelas reales.
    """

    __tablename__ = "order_refunds"

    id_refund: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_venta: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ventas.id_venta", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    includes_shipping: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    approved_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    requested_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # ── Relaciones ─────────────────────────────────────────────────────────
    venta: Mapped["Venta"] = relationship("Venta", back_populates="order_refund", lazy="select")
    approver: Mapped["Usuario | None"] = relationship(
        "Usuario", foreign_keys=[approved_by], lazy="select"
    )
    requester: Mapped["Usuario | None"] = relationship(
        "Usuario", foreign_keys=[requested_by], lazy="select"
    )


# ── OrderReview ───────────────────────────────────────────────────────────────


class OrderReview(Base):
    """
    Calificación del cliente tras recibir su pedido.
    Tabla: order_reviews | M14_pedidos_extendido.sql

    Solo se permite calificar pedidos en estado ENTREGADO.
    Una sola calificación por pedido (UNIQUE en id_venta).
    """

    __tablename__ = "order_reviews"

    id_review: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_venta: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ventas.id_venta", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    id_cliente: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("clientes.id_cliente", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1-5
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # ── Relaciones ─────────────────────────────────────────────────────────
    venta: Mapped["Venta"] = relationship("Venta", back_populates="order_review", lazy="select")


# ── OrderIssue ────────────────────────────────────────────────────────────────


class OrderIssue(Base):
    """
    Incidencia reportada sobre un pedido.
    Tabla: order_issues | M14_pedidos_extendido.sql

    Un pedido puede tener múltiples incidencias.
    Las incidencias son gestionadas por el equipo administrativo.
    """

    __tablename__ = "order_issues"

    id_issue: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_venta: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ventas.id_venta", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    issue_type: Mapped[TipoIncidenciaEnum] = mapped_column(
        PG_ENUM(TipoIncidenciaEnum, name="tipo_incidencia_enum", create_type=False),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[EstadoIncidenciaEnum] = mapped_column(
        PG_ENUM(EstadoIncidenciaEnum, name="estado_incidencia_enum", create_type=False),
        nullable=False,
        default=EstadoIncidenciaEnum.ABIERTA,
        index=True,
    )
    reported_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    resolved_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # ── Relaciones ─────────────────────────────────────────────────────────
    venta: Mapped["Venta"] = relationship("Venta", back_populates="order_issues", lazy="select")
    reporter: Mapped["Usuario | None"] = relationship(
        "Usuario", foreign_keys=[reported_by], lazy="select"
    )
    resolver: Mapped["Usuario | None"] = relationship(
        "Usuario", foreign_keys=[resolved_by], lazy="select"
    )


# ── SystemConfig ──────────────────────────────────────────────────────────────


class SystemConfig(Base):
    """
    Configuración persistente del sistema.
    Tabla: system_config | M14_pedidos_extendido.sql

    Almacena parámetros configurables desde el panel administrativo:
      - shipping_cost
      - free_shipping_threshold
      - delivery_base_time_minutes
      - preparation_base_time_minutes
      - eta_factor_per_product
    """

    __tablename__ = "system_config"

    id_config: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    config_key: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    config_value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relaciones ─────────────────────────────────────────────────────────
    updater: Mapped["Usuario | None"] = relationship("Usuario", lazy="select")


# ── ConfigAuditLog ────────────────────────────────────────────────────────────


class ConfigAuditLog(Base):
    """
    Auditoría de cambios en la configuración del sistema.
    Tabla: config_audit_log
    """
    __tablename__ = "config_audit_log"

    id_log: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    config_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str] = mapped_column(Text, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    changed_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    
    # ── Relaciones ─────────────────────────────────────────────────────────
    changer: Mapped["Usuario | None"] = relationship("Usuario", lazy="select")


# ── Notification ──────────────────────────────────────────────────────────────


class Notification(Base):
    """
    Notificaciones en BD para clientes y administradores.
    Tabla: notifications | M14_pedidos_extendido.sql

    Sistema de polling: el frontend consulta periódicamente las notificaciones
    no leídas del usuario autenticado.
    """

    __tablename__ = "notifications"

    id_notification: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_usuario: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    id_venta: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("ventas.id_venta", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    type: Mapped[TipoNotificacionEnum] = mapped_column(
        PG_ENUM(TipoNotificacionEnum, name="tipo_notificacion_enum", create_type=False),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # ── Relaciones ─────────────────────────────────────────────────────────
    usuario: Mapped["Usuario"] = relationship("Usuario", lazy="select")
    venta: Mapped["Venta | None"] = relationship("Venta", back_populates="notifications", lazy="select")
