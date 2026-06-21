"""
Mifrufely Web — Orders Router v2 (M14)
Endpoints del ciclo de vida completo del pedido.

Nuevos endpoints M14:
  PUT  /ventas/{id}/pagar              ADMIN  PENDIENTE → PAGADO
  PUT  /ventas/{id}/preparar           ADMIN  PAGADO → PREPARANDO
  PUT  /ventas/{id}/despachar          ADMIN  PREPARANDO → EN_CAMINO
  POST /ventas/{id}/delivery-completed SYSTEM EN_CAMINO → ENTREGADO (webhook)
  PUT  /ventas/{id}/cancelar           CLIENTE / ADMIN
  PUT  /ventas/{id}/devolver           CLIENTE (solo si ENTREGADO)
  PUT  /ventas/{id}/reembolso          ADMIN
  GET  /ventas/{id}/tracking           CLIENTE / ADMIN
  GET  /ventas/{id}/eventos            ADMIN

Deprecado (mantiene compatibilidad):
  PUT /ventas/{id}/entregar  →  aliases marcar_entregado_admin()
"""

from typing import Annotated, List

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from redis.asyncio import Redis

from app.core.constants import Permission
from app.core.exceptions import BusinessRuleError
from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.database.models.enums import OrigenVentaEnum, TipoPagoEnum
from app.modules.cart.schemas import CartCheckoutResponse
from app.modules.cart.service import CartService
from app.modules.orders.dependencies import get_venta_service
from app.modules.orders.schemas import (
    CancelRequest,
    DevolucionRequest,
    ItemPaquete,
    ItemProducto,
    OrderEventResponse,
    ReembolsoRequest,
    TrackingResponse,
    VentaDetalladaResponse,
    VentaRequest,
    VentaResponse,
)
from app.modules.orders.service import VentaService
from app.security.dependencies import AdminUser, AuthUser

router = APIRouter(prefix="/ventas", tags=["Ventas"])

VentaServiceDep = Annotated[VentaService, Depends(get_venta_service)]
RedisDep = Annotated[Redis, Depends(get_redis)]


# ══════════════════════════════════════════════════════════════════════════════
# CHECKOUT
# ══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/checkout",
    response_model=VentaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Checkout directo con items explícitos",
)
async def checkout(
    payload: VentaRequest,
    current_user: AuthUser,
    service: VentaServiceDep,
) -> VentaResponse:
    """Crea un nuevo pedido desde un payload explícito de productos/paquetes."""
    return await service.create_checkout(id_cliente=current_user.user_id, dto=payload)


@router.post(
    "/checkout/cart",
    response_model=CartCheckoutResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Checkout desde el carrito Redis",
)
async def checkout_from_cart(
    current_user: AuthUser,
    service: VentaServiceDep,
    redis: RedisDep,
) -> CartCheckoutResponse:
    """Convierte el carrito Redis del usuario en un pedido. Limpia el carrito al finalizar."""
    cart_service = CartService(redis)
    cart = await cart_service.get_cart(user_id=current_user.user_id)

    if not cart.items:
        raise BusinessRuleError("El carrito está vacío.")

    productos = [
        ItemProducto(id_producto=i.id_producto, cantidad=i.cantidad)
        for i in cart.items
        if not i.es_paquete
    ]
    paquetes = [
        ItemPaquete(id_paquete=i.id_paquete, cantidad=i.cantidad)
        for i in cart.items
        if i.es_paquete and i.id_paquete is not None
    ]

    dto = VentaRequest(
        origen_venta=OrigenVentaEnum.WEB,
        productos=productos,
        paquetes=paquetes,
        tipo_pago=TipoPagoEnum.TARJETA,
    )

    result = await service.create_checkout(id_cliente=current_user.user_id, dto=dto)
    await cart_service.clear_cart(user_id=current_user.user_id)

    return CartCheckoutResponse(
        id_venta=result.id_venta,
        total=result.total,
        estado=result.estado,
        estado_pago=result.estado_pago,
    )


# ══════════════════════════════════════════════════════════════════════════════
# CONSULTAS
# ══════════════════════════════════════════════════════════════════════════════


@router.get(
    "",
    response_model=list[VentaResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar ventas (admin: todas | cliente: propias)",
)
async def list_ventas(
    current_user: AuthUser,
    service: VentaServiceDep,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> list[VentaResponse]:
    if current_user.has_permission(Permission.ORDER_READ_ALL):
        return await service.get_all(limit=limit, offset=offset)
    return await service.get_by_usuario(id_usuario=current_user.user_id, limit=limit, offset=offset)


@router.get(
    "/{id_venta}",
    response_model=VentaResponse,
    status_code=status.HTTP_200_OK,
    summary="Obtener venta por ID",
)
async def get_venta(
    id_venta: int,
    current_user: AuthUser,
    service: VentaServiceDep,
) -> VentaResponse:
    return await service.get_by_id(id_venta)


# ══════════════════════════════════════════════════════════════════════════════
# TRACKING Y EVENTOS (M14)
# ══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/{id_venta}/tracking",
    response_model=TrackingResponse,
    status_code=status.HTTP_200_OK,
    summary="Tracking público del pedido",
    description="Timeline del pedido visible para el cliente y el administrador.",
)
async def get_tracking(
    id_venta: int,
    current_user: AuthUser,
    service: VentaServiceDep,
) -> TrackingResponse:
    return await service.get_tracking(id_venta=id_venta)


@router.get(
    "/{id_venta}/eventos",
    response_model=List[OrderEventResponse],
    status_code=status.HTTP_200_OK,
    summary="Historial completo de eventos del pedido (admin)",
)
async def get_eventos(
    id_venta: int,
    current_user: AdminUser,
    service: VentaServiceDep,
) -> List[OrderEventResponse]:
    eventos = await service.get_eventos(id_venta=id_venta)
    return [OrderEventResponse(**e) for e in eventos]


# ══════════════════════════════════════════════════════════════════════════════
# TRANSICIONES DE ESTADO — ADMIN (M14)
# ══════════════════════════════════════════════════════════════════════════════


@router.put(
    "/{id_venta}/pagar",
    response_model=VentaResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirmar pago (admin) — PENDIENTE → PAGADO",
)
async def confirmar_pago(
    id_venta: int,
    current_user: AdminUser,
    service: VentaServiceDep,
) -> VentaResponse:
    """Confirma el pago de un pedido pendiente. Requiere rol ADMIN."""
    return await service.confirmar_pago(id_venta=id_venta, id_usuario=current_user.user_id)


@router.put(
    "/{id_venta}/preparar",
    response_model=VentaResponse,
    status_code=status.HTTP_200_OK,
    summary="Iniciar preparación (admin) — PAGADO → PREPARANDO",
)
async def iniciar_preparacion(
    id_venta: int,
    current_user: AdminUser,
    service: VentaServiceDep,
) -> VentaResponse:
    """Inicia la preparación del pedido y calcula el ETA. Requiere rol ADMIN."""
    return await service.iniciar_preparacion(id_venta=id_venta, id_usuario=current_user.user_id)


@router.put(
    "/{id_venta}/despachar",
    response_model=VentaResponse,
    status_code=status.HTTP_200_OK,
    summary="Despachar pedido (admin) — PREPARANDO → EN_CAMINO",
)
async def despachar_pedido(
    id_venta: int,
    current_user: AdminUser,
    service: VentaServiceDep,
) -> VentaResponse:
    """Entrega el pedido al repartidor. Notifica al microservicio delivery-service. Requiere ADMIN."""
    return await service.despachar_pedido(id_venta=id_venta, id_usuario=current_user.user_id)


@router.put(
    "/{id_venta}/reembolso",
    response_model=VentaResponse,
    status_code=status.HTTP_200_OK,
    summary="Procesar reembolso (admin) — CANCELADO/DEVUELTO → REEMBOLSADO",
)
async def procesar_reembolso(
    id_venta: int,
    payload: ReembolsoRequest,
    current_user: AdminUser,
    service: VentaServiceDep,
) -> VentaResponse:
    """Procesa el reembolso simulado de un pedido cancelado o devuelto. Requiere ADMIN."""
    return await service.procesar_reembolso(
        id_venta=id_venta,
        id_usuario=current_user.user_id,
        dto=payload,
    )


# ══════════════════════════════════════════════════════════════════════════════
# TRANSICIONES — CLIENTE O ADMIN (M14)
# ══════════════════════════════════════════════════════════════════════════════


@router.put(
    "/{id_venta}/cancelar",
    response_model=VentaResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancelar pedido — PENDIENTE/PAGADO/PREPARANDO → CANCELADO",
)
async def cancelar_pedido(
    id_venta: int,
    payload: CancelRequest,
    current_user: AuthUser,
    service: VentaServiceDep,
) -> VentaResponse:
    """
    Cancela el pedido. Devuelve el stock automáticamente.
    Disponible para CLIENTE (sus pedidos propios) y ADMIN (cualquier pedido).
    """
    return await service.cancelar(
        id_venta=id_venta,
        id_usuario=current_user.user_id,
        dto=payload,
    )


@router.put(
    "/{id_venta}/devolver",
    response_model=VentaResponse,
    status_code=status.HTTP_200_OK,
    summary="Solicitar devolución — ENTREGADO → DEVUELTO",
)
async def solicitar_devolucion(
    id_venta: int,
    payload: DevolucionRequest,
    current_user: AuthUser,
    service: VentaServiceDep,
) -> VentaResponse:
    """
    Inicia el proceso de devolución post-entrega.
    Solo para pedidos en estado ENTREGADO. Devuelve el stock.
    """
    return await service.solicitar_devolucion(
        id_venta=id_venta,
        id_usuario=current_user.user_id,
        dto=payload,
    )


# ══════════════════════════════════════════════════════════════════════════════
# WEBHOOK INTERNO — delivery-service (M14)
# ══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/{id_venta}/delivery-completed",
    response_model=VentaResponse,
    status_code=status.HTTP_200_OK,
    summary="[INTERNO] Webhook: delivery-service confirma entrega",
    include_in_schema=False,  # Oculto en Swagger público
)
async def delivery_completed_webhook(
    id_venta: int,
    service: VentaServiceDep,
    x_delivery_token: str = Header(default=""),
) -> VentaResponse:
    """
    Endpoint interno llamado por el microservicio delivery-service
    cuando completa la entrega simulada.
    """
    from app.core.config import settings
    expected_token = getattr(settings, "DELIVERY_WEBHOOK_TOKEN", "dev-webhook-token")
    if x_delivery_token != expected_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token inválido.")
    return await service.marcar_entregado(id_venta=id_venta)


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT DEPRECADO (compatibilidad v1)
# ══════════════════════════════════════════════════════════════════════════════


@router.put(
    "/{id_venta}/entregar",
    response_model=VentaResponse,
    status_code=status.HTTP_200_OK,
    summary="[DEPRECADO] Marcar venta como entregada (admin)",
    description=(
        "⚠️ **DEPRECADO**: Usa el flujo completo: `/pagar` → `/preparar` → `/despachar`. "
        "Este endpoint marca directamente como ENTREGADO desde cualquier estado para compatibilidad. "
        "Será eliminado en la próxima versión mayor."
    ),
)
async def entregar_deprecated(
    id_venta: int,
    current_user: AdminUser,
    service: VentaServiceDep,
) -> VentaResponse:
    return await service.marcar_entregado_admin(
        id_venta=id_venta, id_usuario=current_user.user_id
    )
