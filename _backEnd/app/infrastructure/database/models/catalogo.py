"""
Mifrufely Web — ORM Models: Catálogo e Inventario (Módulo M03)
Corresponds to: M03_catalogo_inventario.sql

Tables:
  - categorias
  - productos
  - lotes
  - movimientos_stock
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
    EstadoLoteEnum,
    TipoMovimientoStockEnum,
)

if TYPE_CHECKING:
    from app.infrastructure.database.models.cupones import CuponMaestro
    from app.infrastructure.database.models.usuarios import Usuario
    from app.infrastructure.database.models.ventas import (
        DetalleVenta,
        DetalleVentaLotes,
        Venta,
    )


# ── Categoria ─────────────────────────────────────────────────────────────────

class Categoria(Base):
    """
    Categoría de productos (postres, tortas, etc.).
    Tabla: categorias | M03_catalogo_inventario.sql
    """
    __tablename__ = "categorias"

    id_categoria: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relaciones ─────────────────────────────────────────────────────────
    productos: Mapped[list["Producto"]] = relationship(
        "Producto", back_populates="categoria", lazy="select"
    )
    cupones_maestro: Mapped[list["CuponMaestro"]] = relationship(
        "CuponMaestro", back_populates="categoria", lazy="select"
    )


# ── Producto ──────────────────────────────────────────────────────────────────

class Producto(Base):
    """
    Producto del catálogo (pastel, bebida, etc.).
    Tabla: productos | M03_catalogo_inventario.sql

    NOTE: stock_actual is a cached counter; the authoritative source
    is the Kardex (movimientos_stock). Updated by triggers in NeonDB.
    """
    __tablename__ = "productos"

    id_producto: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_categoria: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categorias.id_categoria", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    precio: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    stock_actual: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stock_minimo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    imagen_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    # ── Relaciones ─────────────────────────────────────────────────────────
    categoria: Mapped["Categoria | None"] = relationship(
        "Categoria", back_populates="productos", lazy="select"
    )
    lotes: Mapped[list["Lote"]] = relationship(
        "Lote", back_populates="producto", lazy="select"
    )
    movimientos_stock: Mapped[list["MovimientoStock"]] = relationship(
        "MovimientoStock", back_populates="producto", lazy="select"
    )
    detalles_venta: Mapped[list["DetalleVenta"]] = relationship(
        "DetalleVenta", back_populates="producto", lazy="select"
    )


# ── Lote ──────────────────────────────────────────────────────────────────────

class Lote(Base):
    """
    Lote físico de un producto (FEFO — First Expiry, First Out).
    Tabla: lotes | M03_catalogo_inventario.sql

    NOTE: estado_lote and cantidad_disponible are managed by triggers
    (tg_lotes_validar_insert, tg_lotes_post_insert) in NeonDB.
    Do NOT update these fields directly — insert via the trigger flow.
    """
    __tablename__ = "lotes"

    id_lote: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_producto: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("productos.id_producto", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    fecha_ingreso: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    fecha_vencimiento: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    cantidad_inicial: Mapped[int] = mapped_column(Integer, nullable=False)
    cantidad_disponible: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estado_lote: Mapped[EstadoLoteEnum] = mapped_column(
        PG_ENUM(EstadoLoteEnum, name="estado_lote_enum", create_type=False),
        nullable=False,
        default=EstadoLoteEnum.VIGENTE,
        index=True,
    )

    # ── Relaciones ─────────────────────────────────────────────────────────
    producto: Mapped["Producto"] = relationship(
        "Producto", back_populates="lotes", lazy="select"
    )
    movimientos_stock: Mapped[list["MovimientoStock"]] = relationship(
        "MovimientoStock", back_populates="lote", lazy="select"
    )
    detalle_venta_lotes: Mapped[list["DetalleVentaLotes"]] = relationship(
        "DetalleVentaLotes", back_populates="lote", lazy="select"
    )


# ── MovimientoStock ───────────────────────────────────────────────────────────

class MovimientoStock(Base):
    """
    Kardex de movimientos de inventario por producto/lote.
    Tabla: movimientos_stock | M03_catalogo_inventario.sql

    NOTE: Rows in this table are primarily created by NeonDB triggers
    (tg_lotes_post_insert, tg_detalles_venta_asignar_lotes, etc.).
    """
    __tablename__ = "movimientos_stock"

    id_movimiento_stock: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_producto: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("productos.id_producto", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    id_lote: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("lotes.id_lote", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    id_venta: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("ventas.id_venta", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    id_usuario: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    tipo_movimiento: Mapped[TipoMovimientoStockEnum] = mapped_column(
        PG_ENUM(TipoMovimientoStockEnum, name="tipo_movimiento_stock_enum", create_type=False),
        nullable=False,
        index=True,
    )
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    stock_resultante: Mapped[int] = mapped_column(Integer, nullable=False)
    costo_unitario: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    fecha_movimiento: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    observacion: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relaciones ─────────────────────────────────────────────────────────
    producto: Mapped["Producto"] = relationship(
        "Producto", back_populates="movimientos_stock", lazy="select"
    )
    lote: Mapped["Lote | None"] = relationship(
        "Lote", back_populates="movimientos_stock", lazy="select"
    )
    venta: Mapped["Venta | None"] = relationship(
        "Venta", back_populates="movimientos_stock", lazy="select"
    )
    usuario: Mapped["Usuario | None"] = relationship(
        "Usuario", back_populates="movimientos_stock", lazy="select"
    )
