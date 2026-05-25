"""
Mifrufely Web — ORM Models: Cupones (Módulo M04)
Corresponds to: M04_cupones.sql

Tables:
  - cupones_maestro
  - cupones_cliente
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
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base
from app.infrastructure.database.models.enums import (
    EstadoCuponEnum,
    OrigenCuponEnum,
)

if TYPE_CHECKING:
    from app.infrastructure.database.models.catalogo import Categoria
    from app.infrastructure.database.models.recompensas import MovimientoPuntos
    from app.infrastructure.database.models.usuarios import Cliente
    from app.infrastructure.database.models.ventas import Venta


# ── CuponMaestro ─────────────────────────────────────────────────────────────

class CuponMaestro(Base):
    """
    Plantillas de cupones de descuento configuradas por el administrador.
    Tabla: cupones_maestro | M04_cupones.sql
    """
    __tablename__ = "cupones_maestro"

    id_cupon: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_categoria: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categorias.id_categoria", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    porcentaje_descuento: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    costo_puntos: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dias_vigencia: Mapped[int] = mapped_column(Integer, nullable=False)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── Relaciones ─────────────────────────────────────────────────────────
    categoria: Mapped["Categoria | None"] = relationship(
        "Categoria", back_populates="cupones_maestro", lazy="select"
    )
    cupones_cliente: Mapped[list["CuponCliente"]] = relationship(
        "CuponCliente", back_populates="cupon_maestro", lazy="select"
    )


# ── CuponCliente ──────────────────────────────────────────────────────────────

class CuponCliente(Base):
    """
    Cupones emitidos y asignados a un cliente específico.
    Tabla: cupones_cliente | M04_cupones.sql

    NOTE: estado is managed by trigger tg_cupones_cliente_normalizar in NeonDB.
    It synchronizes estado with fecha_uso and fecha_expiracion automatically.
    """
    __tablename__ = "cupones_cliente"

    id_cupon_cliente: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_cliente: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("clientes.id_cliente", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    id_cupon: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("cupones_maestro.id_cupon", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    codigo_unico: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    estado: Mapped[EstadoCuponEnum] = mapped_column(
        PG_ENUM(EstadoCuponEnum, name="estado_cupon_enum", create_type=False),
        nullable=False,
        default=EstadoCuponEnum.DISPONIBLE,
        index=True,
    )
    origen: Mapped[OrigenCuponEnum] = mapped_column(
        PG_ENUM(OrigenCuponEnum, name="origen_cupon_enum", create_type=False),
        nullable=False,
    )
    fecha_adquisicion: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    fecha_uso: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fecha_expiracion: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    # ── Relaciones ─────────────────────────────────────────────────────────
    cliente: Mapped["Cliente"] = relationship(
        "Cliente", back_populates="cupones_cliente", lazy="select"
    )
    cupon_maestro: Mapped["CuponMaestro"] = relationship(
        "CuponMaestro", back_populates="cupones_cliente", lazy="select"
    )
    ventas: Mapped[list["Venta"]] = relationship(
        "Venta", back_populates="cupon_cliente", lazy="select"
    )
    movimientos_puntos: Mapped[list["MovimientoPuntos"]] = relationship(
        "MovimientoPuntos", back_populates="cupon_cliente", lazy="select"
    )
