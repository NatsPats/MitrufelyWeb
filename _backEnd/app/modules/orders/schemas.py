"""
Mifrufely Web — Order Schemas v2 (M14)
Pydantic request/response contracts para el módulo de pedidos.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.infrastructure.database.models.enums import OrigenVentaEnum, TipoPagoEnum


# ── Ítems del Pedido ──────────────────────────────────────────────────────────


class ItemProducto(BaseModel):
    id_producto: int = Field(..., gt=0)
    cantidad: int = Field(..., gt=0)


class ItemPaquete(BaseModel):
    id_paquete: int = Field(..., gt=0)
    cantidad: int = Field(..., gt=0)


# ── Petición de Checkout ──────────────────────────────────────────────────────


class VentaRequest(BaseModel):
    """Payload para crear una nueva venta desde el carrito de compras."""
    origen_venta: OrigenVentaEnum = OrigenVentaEnum.WEB
    id_cupon_cliente: Optional[int] = None
    productos: Optional[List[ItemProducto]] = Field(default_factory=list)
    paquetes: Optional[List[ItemPaquete]] = Field(default_factory=list)
    tipo_pago: TipoPagoEnum = TipoPagoEnum.TARJETA

    def has_items(self) -> bool:
        return len(self.productos) > 0 or len(self.paquetes) > 0


# ── M14: Peticiones de Transición de Estado ───────────────────────────────────


class TransicionEstadoRequest(BaseModel):
    """Payload base para transiciones de estado que requieren motivo."""
    motivo: str = Field(..., min_length=5, max_length=500, description="Motivo de la transición")
    observaciones: Optional[str] = Field(
        None, max_length=1000, description="Observaciones adicionales"
    )


class CancelRequest(TransicionEstadoRequest):
    """Payload para cancelar un pedido."""
    pass


class DevolucionRequest(TransicionEstadoRequest):
    """Payload para iniciar una devolución post-entrega."""
    pass


class ReembolsoRequest(BaseModel):
    """Payload para procesar un reembolso simulado (ADMIN)."""
    monto: Decimal = Field(..., gt=0, description="Monto a reembolsar en S/")
    motivo: str = Field(..., min_length=5, max_length=500)
    observaciones: Optional[str] = Field(None, max_length=1000)
    id_solicitante: Optional[int] = Field(None, description="ID del usuario que lo solicitó")


# ── Respuestas de Entidades Relacionadas ──────────────────────────────────────


class DetalleVentaResponse(BaseModel):
    id_detalle: Optional[int] = None
    id_venta: Optional[int] = None
    id_producto: int
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal
    nombre_producto: Optional[str] = None
    imagen_url_producto: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def extract_from_producto(cls, data: Any) -> Any:
        if hasattr(data, "producto") and data.producto:
            producto = data.producto
            object.__setattr__(data, "nombre_producto", producto.nombre)
            object.__setattr__(data, "imagen_url_producto", producto.imagen_url or "")
        return data

    model_config = ConfigDict(from_attributes=True)


class DocumentoResponse(BaseModel):
    id_documento: Optional[int] = None
    id_venta: Optional[int] = None
    tipo_documento: str
    numero_serie: Optional[str] = None
    numero_correlativo: Optional[str] = None
    url_archivo: Optional[str] = None
    fecha_generacion: datetime

    model_config = ConfigDict(from_attributes=True)


class MetodoPagoResponse(BaseModel):
    id_pago: Optional[int] = None
    id_venta: Optional[int] = None
    tipo_pago: str
    monto: Decimal
    codigo_transaccion: Optional[str] = None
    proveedor: Optional[str] = None
    estado_transaccion: str
    fecha_pago: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class VentaPaqueteResponse(BaseModel):
    id_venta_paquete: Optional[int] = None
    id_venta: Optional[int] = None
    id_paquete: int
    cantidad: int
    nombre_paquete_snapshot: str
    composicion_snapshot_json: Any
    fecha_registro: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ── M14: Tracking y Eventos ───────────────────────────────────────────────────


class EventoTrackingItem(BaseModel):
    """Un evento cronológico del pedido para la vista de tracking del cliente."""
    fecha: datetime
    evento: str
    descripcion: str


class TrackingResponse(BaseModel):
    """Respuesta pública del tracking de un pedido."""
    id_venta: int
    estado: str
    progreso_pct: int = Field(..., ge=0, le=100, description="Porcentaje visual de progreso")
    eta: Optional[datetime] = Field(None, description="Timestamp estimado de entrega")
    delivery_completed_at: Optional[datetime] = Field(None, description="Timestamp real de entrega")
    eventos: List[EventoTrackingItem] = Field(default_factory=list)


class OrderEventResponse(BaseModel):
    """Evento completo del historial de auditoría (admin)."""
    id_event: int
    event_type: str
    description: str
    detail_json: Optional[Any] = None
    created_at: datetime
    created_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class OrderRefundResponse(BaseModel):
    """Datos del reembolso procesado."""
    id_refund: int
    id_venta: int
    reason: str
    amount: Decimal
    includes_shipping: bool
    approved_by: Optional[int] = None
    requested_by: Optional[int] = None
    observations: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ── Respuesta Principal de Venta ──────────────────────────────────────────────


class VentaResponse(BaseModel):
    """Respuesta estándar de una venta. Compatible con v1 + campos M14."""
    id_venta: Optional[int] = None
    id_cliente: int
    cliente_nombre: Optional[str] = None
    id_cupon_cliente: Optional[int] = None
    cupon_codigo: Optional[str] = None
    estado: str
    estado_pago: str
    total: Decimal
    puntos_ganados: int = 0
    fecha_venta: Optional[datetime] = None

    # Campos de desglose financiero
    subtotal_productos: Optional[Decimal] = None
    costo_envio: Optional[Decimal] = None
    monto_descuento_cupon: Optional[Decimal] = None
    base_imponible: Optional[Decimal] = None
    igv: Optional[Decimal] = None

    # M14: Envío y totales
    total_final: Optional[Decimal] = None
    shipping_cost_applied: Optional[Decimal] = None
    free_shipping_applied: Optional[bool] = None

    # M14: Tracking
    delivery_eta: Optional[datetime] = None
    delivery_completed_at: Optional[datetime] = None

    # M14: Cancelación y reembolso
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    refund_amount: Optional[Decimal] = None
    refund_date: Optional[datetime] = None

    # Relaciones cargadas
    detalles: Optional[List[DetalleVentaResponse]] = None
    paquetes_vendidos: Optional[List[VentaPaqueteResponse]] = None
    metodos_pago: Optional[List[MetodoPagoResponse]] = None
    documentos: Optional[List[DocumentoResponse]] = None

    # M14: Reseñas
    has_review: bool = False

    @model_validator(mode="before")
    @classmethod
    def extract_has_review(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "order_review" in data:
                data["has_review"] = data["order_review"] is not None
            if "cliente" in data and data["cliente"]:
                c = data["cliente"]
                if hasattr(c, "usuario") and c.usuario:
                    data["cliente_nombre"] = f"{c.usuario.nombres} {c.usuario.apellidos}"
                elif isinstance(c, dict) and "usuario" in c:
                    u = c["usuario"]
                    if isinstance(u, dict):
                        data["cliente_nombre"] = f"{u.get('nombres', '')} {u.get('apellidos', '')}"
            if "cupon_cliente" in data and data["cupon_cliente"]:
                cc = data["cupon_cliente"]
                if hasattr(cc, "codigo_unico"):
                    data["cupon_codigo"] = cc.codigo_unico
                elif isinstance(cc, dict):
                    data["cupon_codigo"] = cc.get("codigo_unico")
            return data

        # Evitar lazy loading en contexto asíncrono para objetos reales de SQLAlchemy
        from sqlalchemy.orm.state import InstanceState
        if hasattr(data, "_sa_instance_state") and isinstance(getattr(data, "_sa_instance_state", None), InstanceState):
            from sqlalchemy import inspect
            try:
                insp = inspect(data)
                if insp is not None:
                    loaded_dict = {}
                    # Copiar columnas cargadas
                    for col in insp.mapper.column_attrs:
                        if col.key not in insp.unloaded:
                            loaded_dict[col.key] = getattr(data, col.key)
                    # Copiar relaciones cargadas
                    for rel in insp.mapper.relationships:
                        if rel.key not in insp.unloaded:
                            loaded_dict[rel.key] = getattr(data, rel.key)
                    
                    # Establecer has_review si order_review está cargado
                    if "order_review" not in insp.unloaded:
                        loaded_dict["has_review"] = getattr(data, "order_review", None) is not None
                    else:
                        loaded_dict["has_review"] = False

                    # Establecer cliente_nombre si cliente está cargado
                    if "cliente" not in insp.unloaded and getattr(data, "cliente", None):
                        c = data.cliente
                        if c and "usuario" not in inspect(c).unloaded and getattr(c, "usuario", None):
                            loaded_dict["cliente_nombre"] = f"{c.usuario.nombres} {c.usuario.apellidos}"
                    
                    # Establecer cupon_codigo si cupon_cliente está cargado
                    if "cupon_cliente" not in insp.unloaded and getattr(data, "cupon_cliente", None):
                        cc = data.cupon_cliente
                        if cc and "codigo_unico" not in inspect(cc).unloaded:
                            loaded_dict["cupon_codigo"] = cc.codigo_unico
                    
                    return loaded_dict
            except Exception:
                pass

        if hasattr(data, "order_review"):
            try:
                object.__setattr__(data, "has_review", data.order_review is not None)
            except Exception:
                pass
        if hasattr(data, "cliente") and getattr(data, "cliente", None):
            try:
                c = data.cliente
                if getattr(c, "usuario", None):
                    object.__setattr__(data, "cliente_nombre", f"{c.usuario.nombres} {c.usuario.apellidos}")
            except Exception:
                pass
        if hasattr(data, "cupon_cliente") and getattr(data, "cupon_cliente", None):
            try:
                cc = data.cupon_cliente
                if cc:
                    object.__setattr__(data, "cupon_codigo", cc.codigo_unico)
            except Exception:
                pass
        return data

    model_config = ConfigDict(from_attributes=True)


class VentaDetalladaResponse(VentaResponse):
    """Respuesta detallada con historial de eventos y reembolso (admin)."""
    order_events: Optional[List[OrderEventResponse]] = None
    order_refund: Optional[OrderRefundResponse] = None
    progreso_pct: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
