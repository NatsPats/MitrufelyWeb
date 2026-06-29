"""
Mifrufely Web — Pydantic Schemas: CriptoTrufa / SweetCoins (Módulo M06)
Defines request and response schemas with rich openapi examples.
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.infrastructure.database.models.enums import EstadoCuponEnum, OrigenCuponEnum, TipoMovimientoPuntosEnum


# ── CONFIGURACIÓN RECOMPENSAS ──────────────────────────────────────────────────

class ConfigRecompensasResponse(BaseModel):
    """Parámetros globales activos del programa de fidelización."""
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id_config": 1,
                "tasa_conversion": 0.1000,
                "limite_puntos_billetera": 50000,
                "dias_expiracion": 365,
                "estado": True
            }
        }
    )
    
    id_config: int
    tasa_conversion: Decimal = Field(description="Porcentaje de retorno de puntos sobre el total gastado (Ej: 0.10 -> 10% de S/.)")
    limite_puntos_billetera: int = Field(description="Cantidad máxima de puntos que un cliente puede tener acumulados")
    dias_expiracion: int = Field(description="Días de validez de los puntos acumulados antes de expirar")
    estado: bool


# ── CUPONES MAESTRO ────────────────────────────────────────────────────────────

class CuponMaestroResponse(BaseModel):
    """Plantilla o catálogo de cupones de descuento."""
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id_cupon": 2,
                "id_categoria": None,
                "nombre": "Locura por el Oreo",
                "descripcion": "Cupón especial de 20% para fans de nuestras trufas de Oreo.",
                "porcentaje_descuento": 20.00,
                "costo_puntos": 1000,
                "dias_vigencia": 15,
                "estado": True
            }
        }
    )
    
    id_cupon: int
    id_categoria: Optional[int] = Field(None, description="ID de categoría específica a aplicar, o null si aplica a todo el catálogo")
    nombre: str
    descripcion: Optional[str] = None
    porcentaje_descuento: Decimal = Field(description="Porcentaje de descuento sobre el subtotal")
    costo_puntos: Optional[int] = Field(None, description="Costo en puntos para canje. Null si no es canjeable por puntos")
    dias_vigencia: int = Field(description="Días de validez una vez adquirido por el cliente")
    estado: bool


# ── CUPONES CLIENTE ─────────────────────────────────────────────────────────────

class CuponClienteResponse(BaseModel):
    """Cupón único perteneciente y redimible por un cliente específico."""
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "id_cupon_cliente": 24,
                "id_cliente": 8,
                "id_cupon": 2,
                "codigo_unico": "MTR-XY91",
                "estado": "DISPONIBLE",
                "origen": "COMPRA_PUNTOS",
                "fecha_adquisicion": "2026-06-28T16:00:00Z",
                "fecha_uso": None,
                "fecha_expiracion": "2026-07-13T23:59:59Z",
                "cupon": {
                    "id_cupon": 2,
                    "id_categoria": None,
                    "nombre": "Locura por el Oreo",
                    "descripcion": "Cupón especial de 20% para fans de nuestras trufas de Oreo.",
                    "porcentaje_descuento": 20.00,
                    "costo_puntos": 1000,
                    "dias_vigencia": 15,
                    "estado": True
                }
            }
        }
    )
    
    id_cupon_cliente: int
    id_cliente: int
    id_cupon: int
    codigo_unico: str = Field(description="Código único alfanumérico generado para aplicar en el Checkout")
    estado: EstadoCuponEnum
    origen: OrigenCuponEnum
    fecha_adquisicion: datetime
    fecha_uso: Optional[datetime] = None
    fecha_expiracion: datetime
    cupon_maestro: CuponMaestroResponse = Field(..., alias="cupon", description="Información detallada de la plantilla del cupón")


# ── MOVIMIENTOS PUNTOS ─────────────────────────────────────────────────────────

class MovimientoPuntosResponse(BaseModel):
    """Registro atómico en el ledger de puntos del cliente."""
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id_movimiento_punto": 42,
                "id_cliente": 8,
                "tipo_movimiento": "ACUMULACION_VENTA",
                "cantidad": 150,
                "saldo_puntos_resultante": 1650,
                "fecha_movimiento": "2026-06-28T16:30:00Z",
                "justificacion": "Puntos acumulados en Venta #2087 — S/ 150.00"
            }
        }
    )
    
    id_movimiento_punto: int
    id_cliente: int
    tipo_movimiento: TipoMovimientoPuntosEnum
    cantidad: int = Field(description="Cantidad de puntos modificados (positivo para acumulación, negativo para canjes/débitos)")
    saldo_puntos_resultante: int = Field(description="Saldo acumulado resultante tras el movimiento")
    fecha_movimiento: datetime
    justificacion: Optional[str] = None


# ── DASHBOARD CLIENTE ──────────────────────────────────────────────────────────

class SweetCoinsDashboardResponse(BaseModel):
    """Consolidado de fidelización para reducir latencia y llamadas en el cliente."""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "balance": 1650,
                "cupones_activos": [
                    {
                        "id_cupon_cliente": 24,
                        "id_cliente": 8,
                        "id_cupon": 2,
                        "codigo_unico": "MTR-XY91",
                        "estado": "DISPONIBLE",
                        "origen": "COMPRA_PUNTOS",
                        "fecha_adquisicion": "2026-06-28T16:00:00Z",
                        "fecha_uso": None,
                        "fecha_expiracion": "2026-07-13T23:59:59Z",
                        "cupon": {
                            "id_cupon": 2,
                            "nombre": "Locura por el Oreo",
                            "porcentaje_descuento": 20.00,
                            "costo_puntos": 1000,
                            "dias_vigencia": 15,
                            "estado": True
                        }
                    }
                ],
                "historial_reciente": [
                    {
                        "id_movimiento_punto": 42,
                        "id_cliente": 8,
                        "tipo_movimiento": "ACUMULACION_VENTA",
                        "cantidad": 150,
                        "saldo_puntos_resultante": 1650,
                        "fecha_movimiento": "2026-06-28T16:30:00Z",
                        "justificacion": "Puntos acumulados en Venta #2087"
                    }
                ]
            }
        }
    )
    
    balance: int = Field(description="Saldo de SweetCoins actual disponible del cliente")
    cupones_activos: List[CuponClienteResponse] = Field(description="Lista de cupones propios en estado DISPONIBLE")
    historial_reciente: List[MovimientoPuntosResponse] = Field(description="Últimos 5 movimientos en el historial de puntos")


# ── SOLICITUDES DE ACCIÓN ──────────────────────────────────────────────────────

class RedeemCouponRequest(BaseModel):
    """Payload para canjear un cupón usando puntos acumulados."""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id_cupon": 2
            }
        }
    )
    
    id_cupon: int = Field(..., description="ID de la plantilla de cupón maestro a canjear")


class RuletaResponse(BaseModel):
    """Respuesta tras girar la Ruleta Dulce."""
    resultado: str = Field(description="Tipo de resultado: 'mala_suerte', 'puntos_extra', 'cupon_sorpresa'")
    mensaje: str = Field(description="Mensaje descriptivo del premio")
    puntos_ganados: int = Field(description="Cantidad de puntos ganados (100 o 0)")
    cupon_ganado: Optional[CuponClienteResponse] = Field(default=None, description="Cupón ganado (en caso de cupon_sorpresa)")


class AdjustPointsRequest(BaseModel):
    """Payload de administrador para modificar manualmente los puntos de un cliente."""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id_cliente": 8,
                "cantidad": 500,
                "justificacion": "Ajuste de cortesía por demoras en la entrega del pedido #2010"
            }
        }
    )
    
    id_cliente: int
    cantidad: int = Field(..., description="Cantidad de puntos a sumar (positivo) o restar (negativo)")
    justificacion: str = Field(..., min_length=5, max_length=255, description="Auditoría obligatoria de la justificación del ajuste")


# ── ADMIN SCHEMAS (CRUD Y GESTIÓN) ──────────────────────────────────────────

class CreateCuponMaestroRequest(BaseModel):
    """Payload para crear un nuevo cupón maestro."""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "nombre": "Cupón de Inauguración",
                "descripcion": "Descuento del 15% para compras generales.",
                "porcentaje_descuento": 15.00,
                "costo_puntos": 700,
                "dias_vigencia": 30,
                "estado": True,
                "id_categoria": None
            }
        }
    )
    
    nombre: str = Field(..., min_length=3, max_length=100)
    descripcion: Optional[str] = Field(None, max_length=255)
    porcentaje_descuento: Decimal = Field(..., gt=0, le=100, description="Porcentaje de descuento (1-100)")
    costo_puntos: Optional[int] = Field(None, ge=0, description="Costo en puntos para canje, o null si no es canjeable por puntos")
    dias_vigencia: int = Field(..., gt=0, description="Días de validez del cupón tras su adquisición")
    estado: bool = Field(True, description="Estado del cupón (activo/inactivo)")
    id_categoria: Optional[int] = Field(None, description="Categoría asociada al cupón de fidelización")


class UpdateCuponMaestroRequest(BaseModel):
    """Payload para actualizar un cupón maestro existente."""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "nombre": "Cupón de Inauguración Renovado",
                "descripcion": "Descuento del 18% para compras generales.",
                "porcentaje_descuento": 18.00,
                "costo_puntos": 800,
                "dias_vigencia": 45,
                "estado": True,
                "id_categoria": None
            }
        }
    )
    
    nombre: str = Field(..., min_length=3, max_length=100)
    descripcion: Optional[str] = Field(None, max_length=255)
    porcentaje_descuento: Decimal = Field(..., gt=0, le=100)
    costo_puntos: Optional[int] = Field(None, ge=0)
    dias_vigencia: int = Field(..., gt=0)
    estado: bool
    id_categoria: Optional[int] = None


class ClienteSaldoResponse(BaseModel):
    """Detalle de saldo de puntos de un cliente para la gestión de administración."""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id_cliente": 8,
                "id_usuario": 14,
                "nombres": "Pedro",
                "apellidos": "Pérez",
                "email": "pedro.perez@gmail.com",
                "saldo": 1650
            }
        }
    )
    
    id_cliente: int
    id_usuario: int
    nombres: str
    apellidos: str
    email: str
    saldo: int


class UpdateConfigRecompensasRequest(BaseModel):
    """Payload para actualizar la configuración global del programa de recompensas."""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "tasa_conversion": 0.1000,
                "limite_puntos_billetera": 50000,
                "dias_expiracion": 365,
                "estado": True
            }
        }
    )
    
    tasa_conversion: Decimal = Field(..., ge=0, le=1, description="Porcentaje de retorno de puntos (Ej: 0.10 -> 10%)")
    limite_puntos_billetera: int = Field(..., gt=0, description="Cantidad máxima de puntos que un cliente puede acumular")
    dias_expiracion: int = Field(..., gt=0, description="Días de validez de los puntos acumulados")
    estado: bool = Field(True, description="Estado de la configuración (activa/inactiva)")
