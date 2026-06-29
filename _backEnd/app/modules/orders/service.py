"""
Mifrufely Web — VentaService v2 (M14 Refactor)
Lógica de negocio transaccional para el módulo de pedidos.

CAMBIOS M14:
  - Integra SystemConfigService para calcular costo de envío y total_final
  - Implementa FSM via state_machine.validate_transition()
  - Registra OrderEvent en cada transición de estado
  - Crea Notification para cliente y admin en cada cambio relevante
  - Métodos: confirmar_pago, iniciar_preparacion, despachar_pedido,
             marcar_entregado, cancelar, solicitar_devolucion,
             procesar_reembolso, get_tracking, get_eventos
  - Mantiene compatibilidad con create_checkout y get_by_id existentes
"""

import httpx
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

import structlog
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BusinessRuleError,
    DatabaseError,
    InsufficientStockError,
    NotFoundError,
)
from app.domain.services.base import AbstractService
from app.infrastructure.database.models.catalogo import Lote, MovimientoStock, Producto
from app.infrastructure.database.models.enums import (
    EstadoLoteEnum,
    EstadoPagoEnum,
    EstadoTransaccionEnum,
    EstadoVentaEnum,
    TipoEventoVentaEnum,
    TipoMovimientoStockEnum,
    TipoNotificacionEnum,
    TipoDocumentoVentaEnum,
    TipoPagoEnum,
)
from app.infrastructure.database.models.pedidos_ext import (
    Notification,
    OrderEvent,
    OrderRefund,
)
from app.infrastructure.database.models.ventas import (
    DetalleVenta,
    DetalleVentaLotes,
    Documento,
    MetodoPago,
    Venta,
    VentaPaquete,
)
from app.modules.config.service import SystemConfigService
from app.modules.orders.repository import IVentaRepository
from app.modules.orders.schemas import (
    CancelRequest,
    DevolucionRequest,
    ReembolsoRequest,
    TrackingResponse,
    VentaDetalladaResponse,
    VentaRequest,
    VentaResponse,
    EventoTrackingItem,
)
from app.modules.orders.state_machine import (
    can_cancel,
    get_progress,
    validate_transition,
)
from app.modules.products.repository import IPaqueteRepository

logger = structlog.get_logger(__name__)


class VentaService(AbstractService[VentaResponse, VentaRequest, None, int]):
    def __init__(
        self,
        repo: IVentaRepository,
        paquete_repo: IPaqueteRepository,
        session: AsyncSession,
        config_service: Optional[SystemConfigService] = None,
    ) -> None:
        self.repo = repo
        self.paquete_repo = paquete_repo
        self.session = session
        self.config_service = config_service

    # ══════════════════════════════════════════════════════════════════════════
    # CHECKOUT — Crear Pedido
    # ══════════════════════════════════════════════════════════════════════════

    async def create_checkout(
        self,
        id_cliente: int,
        dto: VentaRequest,
        tipo_documento: TipoDocumentoVentaEnum = TipoDocumentoVentaEnum.BOLETA,
    ) -> VentaResponse:
        if not dto.has_items():
            raise BusinessRuleError("La orden debe contener al menos un producto o paquete.")

        subtotal = Decimal("0.0")

        is_tarjeta = dto.tipo_pago == TipoPagoEnum.TARJETA
        nueva_venta = Venta(
            id_cliente=0,
            origen_venta=dto.origen_venta,
            estado=EstadoVentaEnum.PAGADO if is_tarjeta else EstadoVentaEnum.PENDIENTE,
            estado_pago=EstadoPagoEnum.PAGADO if is_tarjeta else EstadoPagoEnum.PENDIENTE,
            id_cupon_cliente=dto.id_cupon_cliente,
        )

        try:
            logger.info("checkout.starting", id_cliente=id_cliente)
            async with self.session.begin():
                from app.infrastructure.database.models.usuarios import Cliente

                stmt_cl = select(Cliente).where(Cliente.id_usuario == id_cliente)
                res_cl = await self.session.execute(stmt_cl)
                cliente_row = res_cl.scalar_one_or_none()
                if cliente_row:
                    real_id_cliente = cliente_row.id_cliente
                else:
                    nuevo_cliente = Cliente(id_usuario=id_cliente)
                    self.session.add(nuevo_cliente)
                    await self.session.flush()
                    real_id_cliente = nuevo_cliente.id_cliente
                nueva_venta.id_cliente = real_id_cliente

                n_productos_total = 0
                productos_comprados = []

                for item in dto.productos or []:
                    stmt = select(Producto).where(Producto.id_producto == item.id_producto)
                    result = await self.session.execute(stmt)
                    producto = result.scalar_one_or_none()

                    if not producto:
                        raise NotFoundError(f"Producto con ID {item.id_producto} no encontrado.")
                    if not producto.estado:
                        raise BusinessRuleError(f"El producto '{producto.nombre}' no está disponible.")
                    if producto.stock_actual < item.cantidad:
                        raise InsufficientStockError(
                            f"Stock insuficiente para '{producto.nombre}'. "
                            f"Disponible: {producto.stock_actual}, Solicitado: {item.cantidad}."
                        )

                    linea_subtotal = producto.precio * item.cantidad
                    subtotal += linea_subtotal
                    n_productos_total += item.cantidad

                    nueva_venta.detalles.append(
                        DetalleVenta(
                            id_producto=producto.id_producto,
                            cantidad=item.cantidad,
                            precio_unitario=producto.precio,
                            subtotal=linea_subtotal,
                        )
                    )
                    productos_comprados.append({
                        "id_categoria": producto.id_categoria,
                        "subtotal": linea_subtotal
                    })

                for item in dto.paquetes or []:
                    paquete_db = await self.paquete_repo.get_by_id(item.id_paquete)
                    if not paquete_db or not paquete_db.estado:
                        raise BusinessRuleError(
                            f"Paquete con ID {item.id_paquete} no existe o no está activo."
                        )

                    precio_paquete = Decimal("0.0")
                    composicion_snapshot = []

                    for pp in paquete_db.productos:
                        producto = pp.producto
                        cantidad_necesaria = pp.cantidad * item.cantidad

                        if not producto.estado or producto.stock_actual < cantidad_necesaria:
                            raise InsufficientStockError(
                                f"Stock insuficiente para '{producto.nombre}' "
                                f"dentro del paquete '{paquete_db.nombre}'."
                            )

                        precio_componente = producto.precio * pp.cantidad
                        precio_paquete += precio_componente
                        n_productos_total += cantidad_necesaria

                        composicion_snapshot.append({
                            "id_producto": producto.id_producto,
                            "nombre": producto.nombre,
                            "cantidad_por_paquete": pp.cantidad,
                            "precio_unitario": str(producto.precio),
                        })

                        nueva_venta.detalles.append(
                            DetalleVenta(
                                id_producto=producto.id_producto,
                                cantidad=cantidad_necesaria,
                                precio_unitario=producto.precio,
                                subtotal=precio_componente * item.cantidad,
                            )
                        )
                        productos_comprados.append({
                            "id_categoria": producto.id_categoria,
                            "subtotal": precio_componente * item.cantidad
                        })

                    subtotal += precio_paquete * item.cantidad
                    nueva_venta.paquetes_vendidos.append(
                        VentaPaquete(
                            id_paquete=paquete_db.id_paquete,
                            cantidad=item.cantidad,
                            nombre_paquete_snapshot=paquete_db.nombre,
                            composicion_snapshot_json=composicion_snapshot,
                        )
                    )

                # ── Aplicar Cupón de Descuento ──
                monto_descuento = Decimal("0.00")
                if dto.id_cupon_cliente is not None:
                    from app.infrastructure.database.models.cupones import CuponCliente
                    from app.infrastructure.database.models.enums import EstadoCuponEnum

                    stmt_cup = select(CuponCliente).options(selectinload(CuponCliente.cupon_maestro)).where(
                        CuponCliente.id_cupon_cliente == dto.id_cupon_cliente,
                        CuponCliente.id_cliente == real_id_cliente
                    )
                    res_cup = await self.session.execute(stmt_cup)
                    cupon_cliente_obj = res_cup.scalar_one_or_none()

                    if not cupon_cliente_obj:
                        raise NotFoundError(f"Cupón de cliente con ID {dto.id_cupon_cliente} no encontrado.")
                    if cupon_cliente_obj.estado != EstadoCuponEnum.DISPONIBLE:
                        raise BusinessRuleError("El cupón seleccionado ya ha sido usado o no está disponible.")
                    if cupon_cliente_obj.fecha_expiracion <= datetime.now():
                        raise BusinessRuleError("El cupón seleccionado ha expirado.")

                    id_cat_restr = cupon_cliente_obj.cupon_maestro.id_categoria
                    if id_cat_restr is not None:
                        subtotal_elegible = sum(
                            p["subtotal"] for p in productos_comprados if p["id_categoria"] == id_cat_restr
                        )
                    else:
                        subtotal_elegible = subtotal

                    porcentaje = cupon_cliente_obj.cupon_maestro.porcentaje_descuento
                    monto_descuento = (subtotal_elegible * (porcentaje / Decimal("100.00"))).quantize(Decimal("0.01"))

                    # Marcar cupón como usado de inmediato en la transacción
                    cupon_cliente_obj.estado = EstadoCuponEnum.USADO
                    cupon_cliente_obj.fecha_uso = datetime.now()

                subtotal_con_descuento = subtotal - monto_descuento

                # ── Cálculo de envío ───────────────────────────────────────
                shipping_result = None
                if self.config_service:
                    shipping_result = await self.config_service.calculate_shipping(subtotal_con_descuento)
                    shipping_cost = shipping_result.shipping_cost
                    free_shipping = shipping_result.free_shipping_applied
                    total_final = shipping_result.total_final
                else:
                    shipping_cost = Decimal("0.00")
                    free_shipping = False
                    total_final = subtotal_con_descuento

                # ── Cálculos fiscales ──────────────────────────────────────
                base_imponible = (subtotal_con_descuento / Decimal("1.18")).quantize(Decimal("0.01"))
                igv = (subtotal_con_descuento - base_imponible).quantize(Decimal("0.01"))

                nueva_venta.subtotal_productos = subtotal
                nueva_venta.monto_descuento_cupon = monto_descuento
                nueva_venta.shipping_cost_applied = shipping_cost
                nueva_venta.free_shipping_applied = free_shipping
                nueva_venta.base_imponible = base_imponible
                nueva_venta.igv = igv
                nueva_venta.total = total_final  # Mantener compatibilidad
                nueva_venta.total_final = total_final
                nueva_venta.costo_envio = shipping_cost

                nueva_venta.metodos_pago.append(
                    MetodoPago(
                        tipo_pago=dto.tipo_pago,
                        monto=total_final,
                        estado_transaccion=(
                            EstadoTransaccionEnum.APROBADO
                            if is_tarjeta
                            else EstadoTransaccionEnum.PENDIENTE
                        ),
                    )
                )

                self.session.add(nueva_venta)
                await self.session.flush()
                logger.info("checkout.venta_flushed", id_venta=nueva_venta.id_venta)

                self.session.add(
                    Documento(
                        id_venta=nueva_venta.id_venta,
                        tipo_documento=tipo_documento,
                    )
                )

                # ── Registrar evento de creación ───────────────────────────
                shipping_msg = (
                    f"Envío gratis aplicado (subtotal S/{subtotal:.2f} ≥ umbral)"
                    if free_shipping
                    else f"Costo de envío: S/{shipping_cost:.2f}"
                )
                self.session.add(OrderEvent(
                    id_venta=nueva_venta.id_venta,
                    event_type=TipoEventoVentaEnum.PEDIDO_CREADO,
                    description=(
                        f"Pedido creado. Subtotal: S/{subtotal:.2f}. "
                        f"{shipping_msg}. Total: S/{total_final:.2f}."
                    ),
                    detail_json={"n_productos": n_productos_total, "subtotal": str(subtotal)},
                    created_by=id_cliente,
                ))
                self.session.add(OrderEvent(
                    id_venta=nueva_venta.id_venta,
                    event_type=TipoEventoVentaEnum.STOCK_COMPROMETIDO,
                    description=f"Stock comprometido para {n_productos_total} unidad(es) via FEFO.",
                ))

                # ── Notificación al cliente ────────────────────────────────
                await self._crear_notificacion(
                    id_usuario=id_cliente,
                    id_venta=nueva_venta.id_venta,
                    tipo=TipoNotificacionEnum.PEDIDO_CONFIRMADO,
                    titulo="¡Pedido recibido!",
                    mensaje=f"Tu pedido #{nueva_venta.id_venta} fue creado. Total: S/{total_final:.2f}.",
                )

        except DBAPIError as exc:
            error_msg = str(exc.orig) if exc.orig else str(exc)
            logger.warning("checkout.trigger_error", id_cliente=id_cliente, error=error_msg)
            if "Stock insuficiente" in error_msg:
                raise InsufficientStockError(error_msg) from exc
            raise DatabaseError(error_msg) from exc
        except (NotFoundError, BusinessRuleError, InsufficientStockError):
            raise
        except Exception as exc:
            logger.error("checkout.unexpected_error", id_cliente=id_cliente, error=str(exc))
            raise DatabaseError(
                f"Error inesperado al procesar el checkout. [{type(exc).__name__}] {exc}"
            ) from exc

        logger.info("checkout.success", id_venta=nueva_venta.id_venta, total=str(total_final))
        await self.session.refresh(nueva_venta)

        return VentaResponse(
            id_venta=nueva_venta.id_venta,
            id_cliente=nueva_venta.id_cliente,
            estado=nueva_venta.estado.value,
            estado_pago=nueva_venta.estado_pago.value,
            total=nueva_venta.total,
            total_final=nueva_venta.total_final,
            shipping_cost_applied=nueva_venta.shipping_cost_applied,
            free_shipping_applied=nueva_venta.free_shipping_applied,
            puntos_ganados=nueva_venta.puntos_ganados,
            fecha_venta=nueva_venta.fecha_venta,
        )

    # ══════════════════════════════════════════════════════════════════════════
    # MÉTODO PRIVADO: Cambiar Estado + Registrar Evento
    # ══════════════════════════════════════════════════════════════════════════

    async def _cambiar_estado(
        self,
        venta: Venta,
        nuevo_estado: EstadoVentaEnum,
        id_usuario: Optional[int],
        tipo_evento: TipoEventoVentaEnum,
        descripcion: str,
        detail_json: Optional[dict] = None,
    ) -> None:
        """
        Valida la transición FSM, actualiza el estado de la venta
        y registra el evento en order_events.
        Debe llamarse dentro de un bloque async with self.session.begin().
        """
        validate_transition(venta.estado, nuevo_estado)
        venta.estado = nuevo_estado

        self.session.add(OrderEvent(
            id_venta=venta.id_venta,
            event_type=tipo_evento,
            description=descripcion,
            detail_json=detail_json,
            created_by=id_usuario,
        ))

    # ══════════════════════════════════════════════════════════════════════════
    # MÉTODO PRIVADO: Crear Notificación
    # ══════════════════════════════════════════════════════════════════════════

    async def _crear_notificacion(
        self,
        id_usuario: int,
        id_venta: Optional[int],
        tipo: TipoNotificacionEnum,
        titulo: str,
        mensaje: str,
    ) -> None:
        """Crea una notificación en BD para el usuario dado."""
        self.session.add(Notification(
            id_usuario=id_usuario,
            id_venta=id_venta,
            type=tipo,
            title=titulo,
            message=mensaje,
        ))

    # ══════════════════════════════════════════════════════════════════════════
    # CONFIRMAR PAGO — PENDIENTE → PAGADO
    # ══════════════════════════════════════════════════════════════════════════

    async def confirmar_pago(self, id_venta: int, id_usuario: int) -> VentaResponse:
        """Marca una venta como PAGADO. PENDIENTE → PAGADO. Solo ADMIN."""
        try:
            async with self.session.begin():
                venta = await self._get_venta_or_raise(id_venta)

                await self._cambiar_estado(
                    venta=venta,
                    nuevo_estado=EstadoVentaEnum.PAGADO,
                    id_usuario=id_usuario,
                    tipo_evento=TipoEventoVentaEnum.PAGO_CONFIRMADO,
                    descripcion="Pago confirmado por administrador.",
                )
                venta.estado_pago = EstadoPagoEnum.PAGADO

                for mp in venta.metodos_pago:
                    if mp.estado_transaccion == EstadoTransaccionEnum.PENDIENTE:
                        mp.estado_transaccion = EstadoTransaccionEnum.APROBADO

                await self.session.flush()

                await self._crear_notificacion(
                    id_usuario=venta.cliente.id_usuario if venta.cliente else id_usuario,
                    id_venta=id_venta,
                    tipo=TipoNotificacionEnum.PEDIDO_PAGADO,
                    titulo="Pago confirmado",
                    mensaje=f"Tu pago del pedido #{id_venta} fue confirmado.",
                )

        except (NotFoundError, BusinessRuleError):
            raise
        except DBAPIError as exc:
            raise DatabaseError(str(exc.orig) if exc.orig else str(exc)) from exc
        except Exception as exc:
            raise DatabaseError(f"Error al confirmar pago. {exc}") from exc

        await self.session.refresh(venta)
        return VentaResponse.model_validate(venta)

    # ══════════════════════════════════════════════════════════════════════════
    # INICIAR PREPARACIÓN — PAGADO → PREPARANDO
    # ══════════════════════════════════════════════════════════════════════════

    async def iniciar_preparacion(self, id_venta: int, id_usuario: int) -> VentaResponse:
        """Inicia la preparación del pedido y calcula ETA. PAGADO → PREPARANDO. Solo ADMIN."""
        try:
            async with self.session.begin():
                venta = await self._get_venta_or_raise(id_venta)

                # Calcular ETA
                n_productos = sum(d.cantidad for d in venta.detalles)
                eta = None
                if self.config_service:
                    eta = await self.config_service.calculate_eta(n_productos)
                    venta.delivery_eta = eta

                await self._cambiar_estado(
                    venta=venta,
                    nuevo_estado=EstadoVentaEnum.PREPARANDO,
                    id_usuario=id_usuario,
                    tipo_evento=TipoEventoVentaEnum.PREPARACION_INICIADA,
                    descripcion=(
                        f"Preparación iniciada. ETA: {eta.strftime('%H:%M') if eta else 'No disponible'}."
                    ),
                    detail_json={"n_productos": n_productos, "eta": eta.isoformat() if eta else None},
                )

                if eta:
                    self.session.add(OrderEvent(
                        id_venta=id_venta,
                        event_type=TipoEventoVentaEnum.ETA_CALCULADO,
                        description=f"ETA calculado: {eta.isoformat()}",
                        created_by=id_usuario,
                    ))

                await self.session.flush()

                id_cli_usuario = venta.cliente.id_usuario if venta.cliente else id_usuario
                await self._crear_notificacion(
                    id_usuario=id_cli_usuario,
                    id_venta=id_venta,
                    tipo=TipoNotificacionEnum.PEDIDO_PREPARANDO,
                    titulo="Tu pedido está en preparación",
                    mensaje=(
                        f"¡Estamos preparando tu pedido #{id_venta}! "
                        f"ETA estimado: {eta.strftime('%H:%M') if eta else 'pronto'}."
                    ),
                )

        except (NotFoundError, BusinessRuleError):
            raise
        except DBAPIError as exc:
            raise DatabaseError(str(exc.orig) if exc.orig else str(exc)) from exc
        except Exception as exc:
            raise DatabaseError(f"Error al iniciar preparación. {exc}") from exc

        await self.session.refresh(venta)
        return VentaResponse.model_validate(venta)

    # ══════════════════════════════════════════════════════════════════════════
    # DESPACHAR — PREPARANDO → EN_CAMINO
    # ══════════════════════════════════════════════════════════════════════════

    async def despachar_pedido(self, id_venta: int, id_usuario: int) -> VentaResponse:
        """Despacha el pedido. PREPARANDO → EN_CAMINO. Solo ADMIN."""
        try:
            async with self.session.begin():
                venta = await self._get_venta_or_raise(id_venta)

                await self._cambiar_estado(
                    venta=venta,
                    nuevo_estado=EstadoVentaEnum.EN_CAMINO,
                    id_usuario=id_usuario,
                    tipo_evento=TipoEventoVentaEnum.PEDIDO_DESPACHADO,
                    descripcion="Pedido entregado al repartidor. En camino al cliente.",
                )

                await self.session.flush()

                id_cli_usuario = venta.cliente.id_usuario if venta.cliente else id_usuario
                await self._crear_notificacion(
                    id_usuario=id_cli_usuario,
                    id_venta=id_venta,
                    tipo=TipoNotificacionEnum.PEDIDO_EN_CAMINO,
                    titulo="Tu pedido está en camino",
                    mensaje=f"¡Tu pedido #{id_venta} está en camino! Prepárate para recibirlo.",
                )

        except (NotFoundError, BusinessRuleError):
            raise
        except DBAPIError as exc:
            raise DatabaseError(str(exc.orig) if exc.orig else str(exc)) from exc
        except Exception as exc:
            raise DatabaseError(f"Error al despachar pedido. {exc}") from exc

        # Notificar microservicio de entregas de forma asíncrona (best-effort)
        await self._notify_delivery_service(id_venta, venta)

        await self.session.refresh(venta)
        return VentaResponse.model_validate(venta)

    async def _notify_delivery_service(self, id_venta: int, venta: Venta) -> None:
        """Notifica al delivery-service de forma asíncrona (best-effort, no bloquea)."""
        from app.core.config import settings
        delivery_url = getattr(settings, "DELIVERY_SERVICE_URL", "http://localhost:8001")
        n_productos = sum(d.cantidad for d in venta.detalles) if venta.detalles else 1
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{delivery_url}/deliveries",
                    json={"id_venta": id_venta, "n_productos": n_productos},
                )
        except Exception as e:
            logger.warning("delivery_service.notify_failed", id_venta=id_venta, error=str(e))

    # ══════════════════════════════════════════════════════════════════════════
    # MARCAR ENTREGADO — EN_CAMINO → ENTREGADO (webhook delivery-service)
    # ══════════════════════════════════════════════════════════════════════════

    async def marcar_entregado(self, id_venta: int, id_usuario: Optional[int] = None) -> VentaResponse:
        """Marca el pedido como entregado. EN_CAMINO → ENTREGADO."""
        try:
            async with self.session.begin():
                venta = await self._get_venta_or_raise(id_venta)

                venta.delivery_completed_at = datetime.utcnow()
                await self._cambiar_estado(
                    venta=venta,
                    nuevo_estado=EstadoVentaEnum.ENTREGADO,
                    id_usuario=id_usuario,
                    tipo_evento=TipoEventoVentaEnum.PEDIDO_ENTREGADO,
                    descripcion="Pedido entregado exitosamente al cliente.",
                    detail_json={"completed_at": datetime.utcnow().isoformat()},
                )

                await self.session.flush()

                if venta.cliente:
                    await self._crear_notificacion(
                        id_usuario=venta.cliente.id_usuario,
                        id_venta=id_venta,
                        tipo=TipoNotificacionEnum.PEDIDO_ENTREGADO,
                        titulo="¡Pedido entregado!",
                        mensaje=(
                            f"Tu pedido #{id_venta} fue entregado. "
                            "¡Esperamos que lo disfrutes! Puedes dejarnos tu calificación."
                        ),
                    )

        except (NotFoundError, BusinessRuleError):
            raise
        except DBAPIError as exc:
            raise DatabaseError(str(exc.orig) if exc.orig else str(exc)) from exc
        except Exception as exc:
            raise DatabaseError(f"Error al marcar entregado. {exc}") from exc

        await self.session.refresh(venta)
        return VentaResponse.model_validate(venta)

    # ══════════════════════════════════════════════════════════════════════════
    # CANCELAR — cualquier estado cancelable → CANCELADO
    # ══════════════════════════════════════════════════════════════════════════

    async def cancelar(
        self,
        id_venta: int,
        id_usuario: int,
        dto: "CancelRequest",
    ) -> VentaResponse:
        """
        Cancela un pedido. Válido desde PENDIENTE, PAGADO, PREPARANDO.
        Devuelve el stock automáticamente via movimientos_stock (DEVOLUCION).
        """
        try:
            async with self.session.begin():
                venta = await self._get_venta_or_raise(id_venta)

                if not can_cancel(venta.estado):
                    raise BusinessRuleError(
                        f"El pedido #{id_venta} no puede cancelarse desde el estado "
                        f"'{venta.estado.value}'."
                    )

                venta.cancelled_at = datetime.utcnow()
                venta.cancellation_reason = dto.motivo

                await self._cambiar_estado(
                    venta=venta,
                    nuevo_estado=EstadoVentaEnum.CANCELADO,
                    id_usuario=id_usuario,
                    tipo_evento=TipoEventoVentaEnum.CANCELACION_APROBADA,
                    descripcion=f"Pedido cancelado. Motivo: {dto.motivo}.",
                    detail_json={"motivo": dto.motivo, "observaciones": dto.observaciones},
                )

                # Devolver stock vía movimientos_stock (DEVOLUCION)
                await self._devolver_stock(venta, id_usuario)

                await self.session.flush()

                if venta.cliente:
                    await self._crear_notificacion(
                        id_usuario=venta.cliente.id_usuario,
                        id_venta=id_venta,
                        tipo=TipoNotificacionEnum.PEDIDO_CANCELADO,
                        titulo="Pedido cancelado",
                        mensaje=f"Tu pedido #{id_venta} fue cancelado. Motivo: {dto.motivo}.",
                    )

        except (NotFoundError, BusinessRuleError):
            raise
        except DBAPIError as exc:
            raise DatabaseError(str(exc.orig) if exc.orig else str(exc)) from exc
        except Exception as exc:
            raise DatabaseError(f"Error al cancelar pedido. {exc}") from exc

        await self.session.refresh(venta)
        return VentaResponse.model_validate(venta)

    async def _devolver_stock(self, venta: Venta, id_usuario: int) -> None:
        """
        Revierte el stock de todos los detalles del pedido.

        Replica la lógica del trigger tg_ventas_anular (M12): por cada
        DetalleVenta, itera los registros en detalle_venta_lotes para
        restaurar la cantidad_disponible de cada lote, recalcular su
        estado_lote, y crear un MovimientoStock(DEVOLUCION) con id_lote
        poblado para mantener trazabilidad en el Kardex.
        """
        # Recalcular y actualizar producto.stock_actual una sola vez por producto
        stock_por_producto: dict[int, int] = {}

        for detalle in venta.detalles:
            # Buscar los lotes FEFO que fueron consumidos para este detalle
            detalle_lotes = getattr(detalle, "detalle_lotes", None)

            if detalle_lotes:
                # Path normal: lotes asignados por tg_detalles_venta_asignar_lotes
                for dvl in detalle_lotes:
                    lote: Lote | None = getattr(dvl, "lote", None)
                    if not lote:
                        continue

                    # Restaurar cantidad_disponible del lote
                    lote.cantidad_disponible += dvl.cantidad

                    # Recalcular estado_lote: VIGENTE si tiene stock y no está vencido
                    if lote.cantidad_disponible > 0 and lote.estado_lote != EstadoLoteEnum.VENCIDO:
                        lote.estado_lote = EstadoLoteEnum.VIGENTE

                    # Insertar movimiento Kardex con id_lote poblado
                    self.session.add(MovimientoStock(
                        id_producto=detalle.id_producto,
                        id_lote=dvl.id_lote,
                        id_venta=venta.id_venta,
                        id_usuario=id_usuario,
                        tipo_movimiento=TipoMovimientoStockEnum.DEVOLUCION,
                        cantidad=dvl.cantidad,
                        stock_resultante=0,  # se recalcula abajo
                        costo_unitario=detalle.precio_unitario,
                        observacion=(
                            f"Devolución lote #{dvl.id_lote} por "
                            f"reversión de venta #{venta.id_venta}"
                        ),
                    ))

                    # Acumular para stock_actual del producto
                    stock_por_producto[detalle.id_producto] = (
                        stock_por_producto.get(detalle.id_producto, 0) + dvl.cantidad
                    )
            else:
                # Fallback: no hay detalle_venta_lotes (caso raro: venta previa a triggers)
                # Restaurar directamente sobre el producto como antes, sin id_lote.
                stmt = select(Producto).where(Producto.id_producto == detalle.id_producto)
                result = await self.session.execute(stmt)
                producto = result.scalar_one_or_none()
                if producto:
                    producto.stock_actual += detalle.cantidad
                    stock_por_producto[detalle.id_producto] = detalle.cantidad

                    self.session.add(MovimientoStock(
                        id_producto=detalle.id_producto,
                        id_lote=None,
                        id_venta=venta.id_venta,
                        id_usuario=id_usuario,
                        tipo_movimiento=TipoMovimientoStockEnum.DEVOLUCION,
                        cantidad=detalle.cantidad,
                        stock_resultante=producto.stock_actual,
                        costo_unitario=detalle.precio_unitario,
                        observacion=f"Devolución (sin lote) por reversión de venta #{venta.id_venta}",
                    ))

        # Actualizar stock_actual de cada producto afectado (batch)
        for id_producto, cantidad_total in stock_por_producto.items():
            stmt = select(Producto).where(Producto.id_producto == id_producto)
            result = await self.session.execute(stmt)
            producto = result.scalar_one_or_none()
            if producto:
                producto.stock_actual += cantidad_total

        self.session.add(OrderEvent(
            id_venta=venta.id_venta,
            event_type=TipoEventoVentaEnum.STOCK_DEVUELTO,
            description="Stock devuelto al inventario con restauración de lotes FEFO.",
            created_by=id_usuario,
        ))

    # ══════════════════════════════════════════════════════════════════════════
    # DEVOLUCIÓN — ENTREGADO → DEVUELTO
    # ══════════════════════════════════════════════════════════════════════════

    async def solicitar_devolucion(
        self,
        id_venta: int,
        id_usuario: int,
        dto: "DevolucionRequest",
    ) -> VentaResponse:
        """Inicia proceso de devolución. ENTREGADO → DEVUELTO."""
        try:
            async with self.session.begin():
                venta = await self._get_venta_or_raise(id_venta)

                await self._cambiar_estado(
                    venta=venta,
                    nuevo_estado=EstadoVentaEnum.DEVUELTO,
                    id_usuario=id_usuario,
                    tipo_evento=TipoEventoVentaEnum.DEVOLUCION_APROBADA,
                    descripcion=f"Devolución aprobada. Motivo: {dto.motivo}.",
                    detail_json={"motivo": dto.motivo, "observaciones": dto.observaciones},
                )

                # Devolver stock
                await self._devolver_stock(venta, id_usuario)

                await self.session.flush()

        except (NotFoundError, BusinessRuleError):
            raise
        except Exception as exc:
            raise DatabaseError(f"Error al procesar devolución. {exc}") from exc

        await self.session.refresh(venta)
        return VentaResponse.model_validate(venta)

    # ══════════════════════════════════════════════════════════════════════════
    # REEMBOLSO — CANCELADO/DEVUELTO → REEMBOLSADO
    # ══════════════════════════════════════════════════════════════════════════

    async def procesar_reembolso(
        self,
        id_venta: int,
        id_usuario: int,
        dto: "ReembolsoRequest",
    ) -> VentaResponse:
        """
        Procesa un reembolso simulado.
        CANCELADO → REEMBOLSADO o DEVUELTO → REEMBOLSADO.

        Reglas de reembolso:
          - Cancelado ANTES del despacho: reembolso total (incluye envío)
          - Devuelto DESPUÉS de entrega:  reembolso puede ser parcial
        """
        try:
            async with self.session.begin():
                venta = await self._get_venta_or_raise(id_venta)

                # Verificar que no exista ya un reembolso
                if venta.order_refund:
                    raise BusinessRuleError(f"El pedido #{id_venta} ya tiene un reembolso registrado.")

                # Determinar si incluye envío (cancelado antes del despacho = sí)
                includes_shipping = venta.estado == EstadoVentaEnum.CANCELADO

                monto_reembolso = dto.monto
                if monto_reembolso > venta.total_final:
                    raise BusinessRuleError(
                        f"El monto de reembolso (S/{monto_reembolso}) no puede superar "
                        f"el total del pedido (S/{venta.total_final})."
                    )

                refund = OrderRefund(
                    id_venta=id_venta,
                    reason=dto.motivo,
                    amount=monto_reembolso,
                    includes_shipping=includes_shipping,
                    approved_by=id_usuario,
                    requested_by=dto.id_solicitante or id_usuario,
                    observations=dto.observaciones,
                    approved_at=datetime.utcnow(),
                )
                self.session.add(refund)

                venta.refund_amount = monto_reembolso
                venta.refund_date = datetime.utcnow()
                venta.estado_pago = EstadoPagoEnum.REEMBOLSADO

                await self._cambiar_estado(
                    venta=venta,
                    nuevo_estado=EstadoVentaEnum.REEMBOLSADO,
                    id_usuario=id_usuario,
                    tipo_evento=TipoEventoVentaEnum.REEMBOLSO_PROCESADO,
                    descripcion=(
                        f"Reembolso simulado procesado: S/{monto_reembolso:.2f}. "
                        f"{'Incluye envío.' if includes_shipping else 'Sin envío.'} "
                        f"Motivo: {dto.motivo}."
                    ),
                    detail_json={
                        "monto": str(monto_reembolso),
                        "includes_shipping": includes_shipping,
                    },
                )

                await self.session.flush()

                if venta.cliente:
                    await self._crear_notificacion(
                        id_usuario=venta.cliente.id_usuario,
                        id_venta=id_venta,
                        tipo=TipoNotificacionEnum.PEDIDO_REEMBOLSADO,
                        titulo="Reembolso procesado",
                        mensaje=(
                            f"Tu reembolso de S/{monto_reembolso:.2f} del pedido #{id_venta} "
                            "fue procesado exitosamente."
                        ),
                    )

        except (NotFoundError, BusinessRuleError):
            raise
        except Exception as exc:
            raise DatabaseError(f"Error al procesar reembolso. {exc}") from exc

        await self.session.refresh(venta)
        return VentaResponse.model_validate(venta)

    # ══════════════════════════════════════════════════════════════════════════
    # TRACKING — GET /ventas/{id}/tracking
    # ══════════════════════════════════════════════════════════════════════════

    async def get_tracking(self, id_venta: int) -> TrackingResponse:
        """Retorna el timeline público del pedido para el cliente."""
        venta = await self.repo.get_by_id(id_venta)
        if not venta:
            raise NotFoundError(f"Venta con ID {id_venta} no encontrada.")

        eventos = [
            EventoTrackingItem(
                fecha=e.created_at,
                evento=e.event_type.value,
                descripcion=e.description,
            )
            for e in (venta.order_events or [])
        ]

        return TrackingResponse(
            id_venta=id_venta,
            estado=venta.estado.value,
            progreso_pct=get_progress(venta.estado),
            eta=venta.delivery_eta,
            delivery_completed_at=venta.delivery_completed_at,
            eventos=eventos,
        )

    # ══════════════════════════════════════════════════════════════════════════
    # EVENTOS — GET /ventas/{id}/eventos (admin)
    # ══════════════════════════════════════════════════════════════════════════

    async def get_eventos(self, id_venta: int) -> List[dict]:
        """Retorna el historial completo de eventos del pedido."""
        venta = await self.repo.get_by_id(id_venta)
        if not venta:
            raise NotFoundError(f"Venta con ID {id_venta} no encontrada.")

        return [
            {
                "id_event": e.id_event,
                "event_type": e.event_type.value,
                "description": e.description,
                "detail_json": e.detail_json,
                "created_at": e.created_at.isoformat(),
                "created_by": e.created_by,
            }
            for e in (venta.order_events or [])
        ]

    # ══════════════════════════════════════════════════════════════════════════
    # HELPERS DE CONSULTA (compatibilidad con v1)
    # ══════════════════════════════════════════════════════════════════════════

    async def _get_venta_or_raise(self, id_venta: int) -> Venta:
        """Carga la venta con todas sus relaciones o lanza NotFoundError."""
        stmt = (
            select(Venta)
            .options(
                selectinload(Venta.detalles)
                .selectinload(DetalleVenta.producto),
                selectinload(Venta.detalles)
                .selectinload(DetalleVenta.detalle_lotes)
                .selectinload(DetalleVentaLotes.lote),
                selectinload(Venta.paquetes_vendidos),
                selectinload(Venta.metodos_pago),
                selectinload(Venta.documentos),
                selectinload(Venta.order_events),
                selectinload(Venta.order_refund),
                selectinload(Venta.cliente),
            )
            .where(Venta.id_venta == id_venta)
        )
        result = await self.session.execute(stmt)
        venta = result.scalar_one_or_none()
        if not venta:
            raise NotFoundError(f"Venta con ID {id_venta} no encontrada.")
        return venta

    async def get_by_id(self, id_venta: int) -> VentaResponse:
        venta = await self.repo.get_by_id(id_venta)
        if not venta:
            raise NotFoundError(f"Venta con ID {id_venta} no encontrada.")
        return VentaResponse.model_validate(venta)

    async def get_all(self, *, limit: int = 100, offset: int = 0) -> List[VentaResponse]:
        ventas = await self.repo.get_all(limit=limit, offset=offset)
        return [VentaResponse.model_validate(v) for v in ventas]

    async def get_by_usuario(
        self, id_usuario: int, *, limit: int = 100, offset: int = 0
    ) -> List[VentaResponse]:
        from app.infrastructure.database.models.usuarios import Cliente
        stmt = select(Cliente).where(Cliente.id_usuario == id_usuario)
        result = await self.session.execute(stmt)
        cliente = result.scalar_one_or_none()
        id_cliente = cliente.id_cliente if cliente else id_usuario
        return await self.get_by_cliente(id_cliente, limit=limit, offset=offset)

    async def get_by_cliente(
        self, id_cliente: int, *, limit: int = 100, offset: int = 0
    ) -> List[VentaResponse]:
        ventas = await self.repo.find_by_cliente(id_cliente, limit=limit, offset=offset)
        return [VentaResponse.model_validate(v) for v in ventas]

    # ── Compatibilidad retroactiva ──────────────────────────────────────────

    async def marcar_entregado_admin(self, id_venta: int, id_usuario: int) -> VentaResponse:
        """
        Alias para marcar_entregado. Mantiene compatibilidad con el endpoint
        PUT /ventas/{id}/entregar (deprecado — usar flujo completo de estados).
        """
        return await self.marcar_entregado(id_venta, id_usuario)
