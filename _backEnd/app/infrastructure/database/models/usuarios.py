"""
Mifrufely Web — ORM Models: Usuarios y Roles (Módulo M02)
Corresponds to: M02_usuarios_roles.sql

Tables:
  - roles
  - usuarios
  - clientes
  - datos_fiscales
  - logs_sistema
"""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base
from app.infrastructure.database.models.enums import (
    AuthProviderEnum,
    TipoDocumentoFiscalEnum,
    TipoRolEnum,
)

if TYPE_CHECKING:
    from app.infrastructure.database.models.catalogo import MovimientoStock
    from app.infrastructure.database.models.ventas import (
        HistorialEstadosVenta,
        Venta,
    )


# ── Rol ───────────────────────────────────────────────────────────────────────

class Rol(Base):
    """
    Roles del sistema.
    Tabla: roles | M02_usuarios_roles.sql
    """
    __tablename__ = "roles"

    id_rol: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[TipoRolEnum] = mapped_column(
        PG_ENUM(
            TipoRolEnum,
            name="tipo_rol_enum",
            create_type=False,  # ENUM already exists in NeonDB
        ),
        nullable=False,
        unique=True,
    )

    # ── Relaciones ─────────────────────────────────────────────────────────
    usuarios: Mapped[list["Usuario"]] = relationship(
        "Usuario", back_populates="rol", lazy="select"
    )


# ── Usuario ───────────────────────────────────────────────────────────────────

class Usuario(Base):
    """
    Usuarios del sistema (admin, cliente).
    Tabla: usuarios | M02_usuarios_roles.sql
    """
    __tablename__ = "usuarios"

    id_usuario: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_rol: Mapped[int] = mapped_column(
        Integer, ForeignKey("roles.id_rol", ondelete="RESTRICT"), nullable=False, index=True
    )
    nombres: Mapped[str] = mapped_column(String(100), nullable=False)
    apellidos: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    # nullable=True: usuarios autenticados con Google no tienen contraseña local
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(20), nullable=True)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Proveedor de autenticación: 'local' (email+pass) o 'google' (OAuth2)
    auth_provider: Mapped[str] = mapped_column(
        String(20), nullable=False, default=AuthProviderEnum.LOCAL.value
    )
    # ID único del usuario en Google (sub del ID Token). Solo present en cuentas Google.
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)

    # ── Relaciones ─────────────────────────────────────────────────────────
    rol: Mapped["Rol"] = relationship("Rol", back_populates="usuarios", lazy="select")
    cliente: Mapped["Cliente | None"] = relationship(
        "Cliente", back_populates="usuario", uselist=False, lazy="select"
    )
    datos_fiscales: Mapped[list["DatosFiscales"]] = relationship(
        "DatosFiscales", back_populates="usuario", lazy="select"
    )
    logs: Mapped[list["LogSistema"]] = relationship(
        "LogSistema", back_populates="usuario", lazy="select"
    )
    historial_ventas: Mapped[list["HistorialEstadosVenta"]] = relationship(
        "HistorialEstadosVenta", back_populates="usuario", lazy="select"
    )
    movimientos_stock: Mapped[list["MovimientoStock"]] = relationship(
        "MovimientoStock", back_populates="usuario", lazy="select"
    )


# ── Cliente ───────────────────────────────────────────────────────────────────

class Cliente(Base):
    """
    Perfil extendido de un usuario con rol CLIENTE.
    Tabla: clientes | M02_usuarios_roles.sql
    """
    __tablename__ = "clientes"

    id_cliente: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_usuario: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    direccion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    referencia: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Relaciones ─────────────────────────────────────────────────────────
    usuario: Mapped["Usuario"] = relationship(
        "Usuario", back_populates="cliente", lazy="select"
    )
    ventas: Mapped[list["Venta"]] = relationship(
        "Venta", back_populates="cliente", lazy="select"
    )
    cupones_cliente: Mapped[list["CuponCliente"]] = relationship(  # type: ignore[name-defined]
        "CuponCliente", back_populates="cliente", lazy="select"
    )
    movimientos_puntos: Mapped[list["MovimientoPuntos"]] = relationship(  # type: ignore[name-defined]
        "MovimientoPuntos", back_populates="cliente", lazy="select"
    )


# ── DatosFiscales ─────────────────────────────────────────────────────────────

class DatosFiscales(Base):
    """
    Información fiscal (DNI/RUC) de un usuario.
    Tabla: datos_fiscales | M02_usuarios_roles.sql

    NOTE: Solo puede haber un registro con es_predeterminado=True por usuario
    (enforced via partial unique index uq_datos_fiscales_predeterminado in DB).
    """
    __tablename__ = "datos_fiscales"

    id_dato_fiscal: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_usuario: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tipo_documento: Mapped[TipoDocumentoFiscalEnum] = mapped_column(
        PG_ENUM(
            TipoDocumentoFiscalEnum,
            name="tipo_documento_fiscal_enum",
            create_type=False,
        ),
        nullable=False,
    )
    numero_documento: Mapped[str] = mapped_column(
        String(20), nullable=False, unique=True, index=True
    )
    razon_social: Mapped[str | None] = mapped_column(String(150), nullable=True)
    direccion_fiscal: Mapped[str | None] = mapped_column(String(255), nullable=True)
    es_predeterminado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Relaciones ─────────────────────────────────────────────────────────
    usuario: Mapped["Usuario"] = relationship(
        "Usuario", back_populates="datos_fiscales", lazy="select"
    )


# ── LogSistema ────────────────────────────────────────────────────────────────

class LogSistema(Base):
    """
    Registro de auditoría de acciones del sistema.
    Tabla: logs_sistema | M02_usuarios_roles.sql
    """
    __tablename__ = "logs_sistema"

    id_log: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_usuario: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    accion: Mapped[str] = mapped_column(String(255), nullable=False)
    fecha: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # ── Relaciones ─────────────────────────────────────────────────────────
    usuario: Mapped["Usuario | None"] = relationship(
        "Usuario", back_populates="logs", lazy="select"
    )
