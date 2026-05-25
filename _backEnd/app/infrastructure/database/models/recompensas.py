"""
Mifrufely Web — ORM Models: Recompensas / SweetCoins (Módulo M06)
Corresponds to: M06_recompensas_sweetcoins.sql

Tables:
  - configuracion_recompensas
  - movimientos_puntos
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
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base
from app.infrastructure.database.models.enums import TipoMovimientoPuntosEnum

if TYPE_CHECKING:
    from app.infrastructure.database.models.cupones import CuponCliente
    from app.infrastructure.database.models.usuarios import Cliente
    from app.infrastructure.database.models.ventas import Venta


# ── ConfiguracionRecompensas ──────────────────────────────────────────────────

class ConfiguracionRecompensas(Base):
    """
    Parámetros globales del programa de puntos SweetCoins.
    Solo debería haber un registro activo a la vez.
    Tabla: configuracion_recompensas | M06_recompensas_sweetcoins.sql
    """
    __tablename__ = "configuracion_recompensas"

    id_config: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tasa_conversion: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    limite_puntos_billetera: Mapped[int] = mapped_column(Integer, nullable=False)
    dias_expiracion: Mapped[int] = mapped_column(Integer, nullable=False)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── Relaciones ─────────────────────────────────────────────────────────
    movimientos_puntos: Mapped[list["MovimientoPuntos"]] = relationship(
        "MovimientoPuntos", back_populates="config", lazy="select"
    )


# ── MovimientoPuntos ──────────────────────────────────────────────────────────

class MovimientoPuntos(Base):
    """
    Ledger de puntos SweetCoins por cliente.
    Cada fila es un movimiento atómico (acumulación, descuento, expiración).
    Tabla: movimientos_puntos | M06_recompensas_sweetcoins.sql

    IMPORTANT TRIGGERS IN NEONDB:
      - tg_movimientos_puntos_validar (BEFORE INSERT): Validates that the
        client's point balance does not go negative and sets saldo_puntos_resultante.
      - tg_ventas_otorgar_puntos (on ventas, AFTER UPDATE): Creates an
        ACUMULACION_VENTA row here automatically when a sale is paid.
      - tg_ventas_anular (on ventas, AFTER UPDATE): Creates an AJUSTE_ADMIN
        row here to reverse points when a sale is cancelled.

    NOTE: cantidad can be negative (point deductions). The DB trigger enforces
    saldo_puntos_resultante >= 0 at all times.
    """
    __tablename__ = "movimientos_puntos"

    id_movimiento_punto: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_cliente: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("clientes.id_cliente", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    id_venta: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("ventas.id_venta", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    id_cupon_cliente: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("cupones_cliente.id_cupon_cliente", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    id_config: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("configuracion_recompensas.id_config", ondelete="RESTRICT"),
        nullable=False,
    )
    tipo_movimiento: Mapped[TipoMovimientoPuntosEnum] = mapped_column(
        PG_ENUM(TipoMovimientoPuntosEnum, name="tipo_movimiento_puntos_enum", create_type=False),
        nullable=False,
    )
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    saldo_puntos_resultante: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha_movimiento: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    fecha_expiracion: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    justificacion: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relaciones ─────────────────────────────────────────────────────────
    cliente: Mapped["Cliente"] = relationship(
        "Cliente", back_populates="movimientos_puntos", lazy="select"
    )
    venta: Mapped["Venta | None"] = relationship(
        "Venta", back_populates="movimientos_puntos", lazy="select"
    )
    cupon_cliente: Mapped["CuponCliente | None"] = relationship(
        "CuponCliente", back_populates="movimientos_puntos", lazy="select"
    )
    config: Mapped["ConfiguracionRecompensas"] = relationship(
        "ConfiguracionRecompensas", back_populates="movimientos_puntos", lazy="select"
    )
