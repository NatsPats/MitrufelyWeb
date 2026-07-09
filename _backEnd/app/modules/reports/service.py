"""
Mitrufely Web — Reports Service (Fase 7)
Compone los siete reportes funcionales a partir del dominio existente.

Esta capa solo LEE y agrega datos (sin persistir). Las consultas pesadas se
materializan en DTOs Pydantic listos para serializar a JSON, PDF o Excel.
"""

import datetime as _dt
from decimal import Decimal

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models.catalogo import Categoria, Producto
from app.infrastructure.database.models.cupones import CuponCliente
from app.infrastructure.database.models.enums import EstadoVentaEnum
from app.infrastructure.database.models.recompensas import MovimientoPuntos
from app.infrastructure.database.models.usuarios import Cliente, Rol, Usuario
from app.infrastructure.database.models.ventas import Documento, MetodoPago, Venta
from app.modules.reports.schemas import (
    ReporteCatalogoItem,
    ReporteCatalogoResponse,
    ReporteFidelizacionItem,
    ReporteFidelizacionResponse,
    ReporteInventarioItem,
    ReporteInventarioResponse,
    ReportePedidosItem,
    ReportePedidosResponse,
    ReporteUsuariosItem,
    ReporteUsuariosResponse,
    ReporteVentasItem,
    ReporteVentasResponse,
)

logger = structlog.get_logger(__name__)

_ESTADOS_EXCLUIDOS_FINANCIERO = [
    EstadoVentaEnum.ANULADO,
    EstadoVentaEnum.CANCELADO,
]


def _nombre_cliente(usuario: Usuario | None) -> str:
    if usuario is None:
        return "Cliente"
    return f"{usuario.nombres} {usuario.apellidos}".strip() or usuario.email


def _clasificar_stock(stock_actual: int, stock_minimo: int) -> str:
    if stock_actual <= 0:
        return "AGOTADO"
    if stock_actual <= stock_minimo:
        return "BAJO"
    return "DISPONIBLE"


class ReportsService:
    """Servicio de generación de los siete reportes funcionales."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── 1. Rendimiento de Ventas ──────────────────────────────────────────────

    async def reporte_ventas(
        self,
        *,
        fecha_desde: _dt.date | None = None,
        fecha_hasta: _dt.date | None = None,
        estado_pago: str | None = None,
    ) -> ReporteVentasResponse:
        logger.info(
            "reports.ventas.requested",
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            estado_pago=estado_pago,
        )

        stmt = (
            select(
                Venta.id_venta,
                Venta.fecha_venta,
                Venta.estado,
                Venta.estado_pago,
                Venta.subtotal_productos,
                Venta.base_imponible,
                Venta.igv,
                Venta.total,
                Venta.monto_descuento_cupon,
                Venta.id_cupon_cliente,
                Usuario.nombres,
                Usuario.apellidos,
                Usuario.email,
                MetodoPago.tipo_pago,
                CuponCliente.codigo_unico.label("cupon_codigo"),
            )
            .join(Cliente, Cliente.id_cliente == Venta.id_cliente)
            .join(Usuario, Usuario.id_usuario == Cliente.id_usuario)
            .outerjoin(MetodoPago, MetodoPago.id_venta == Venta.id_venta)
            .outerjoin(CuponCliente, CuponCliente.id_cupon_cliente == Venta.id_cupon_cliente)
        )

        if fecha_desde is not None:
            stmt = stmt.where(Venta.fecha_venta >= fecha_desde)
        if fecha_hasta is not None:
            # incluye todo el día final
            stmt = stmt.where(
                Venta.fecha_venta
                < fecha_hasta + _dt.timedelta(days=1)
            )
        if estado_pago:
            stmt = stmt.where(Venta.estado_pago == estado_pago.upper())

        stmt = stmt.order_by(Venta.fecha_venta.desc()).limit(1000)
        result = await self.session.execute(stmt)
        rows = result.all()

        items: list[ReporteVentasItem] = []
        total_acum = Decimal("0")
        for r in rows:
            cliente = f"{r.nombres} {r.apellidos}".strip() or r.email
            item = ReporteVentasItem(
                id_venta=r.id_venta,
                fecha_venta=r.fecha_venta,
                cliente=cliente,
                estado=r.estado.value if r.estado else "",
                estado_pago=r.estado_pago.value if r.estado_pago else "",
                subtotal_productos=r.subtotal_productos or Decimal("0"),
                base_imponible=r.base_imponible or Decimal("0"),
                igv=r.igv or Decimal("0"),
                total=r.total or Decimal("0"),
                metodo_pago=r.tipo_pago,
                monto_descuento_cupon=r.monto_descuento_cupon or Decimal("0"),
                id_cupon_cliente=r.id_cupon_cliente,
                cupon_codigo=r.cupon_codigo,
            )
            items.append(item)
            if r.estado not in _ESTADOS_EXCLUIDOS_FINANCIERO:
                total_acum += item.total

        cantidad = len(items)
        ticket = (total_acum / cantidad) if cantidad else Decimal("0")
        return ReporteVentasResponse(
            items=items,
            total_ventas=total_acum.quantize(Decimal("0.01")),
            cantidad_pedidos=cantidad,
            ticket_promedio=ticket.quantize(Decimal("0.01")),
        )

    # ── 2. Seguimiento de Pedidos ─────────────────────────────────────────────

    async def reporte_pedidos(
        self,
        *,
        fecha_desde: _dt.date | None = None,
        fecha_hasta: _dt.date | None = None,
        estado: str | None = None,
    ) -> ReportePedidosResponse:
        logger.info("reports.pedidos.requested", estado=estado)

        stmt = (
            select(
                Venta.id_venta,
                Venta.estado,
                Venta.estado_pago,
                Venta.fecha_venta,
                Venta.delivery_completed_at,
                Venta.total_final,
                Usuario.nombres,
                Usuario.apellidos,
                Usuario.email,
            )
            .join(Cliente, Cliente.id_cliente == Venta.id_cliente)
            .join(Usuario, Usuario.id_usuario == Cliente.id_usuario)
        )
        if fecha_desde is not None:
            stmt = stmt.where(Venta.fecha_venta >= fecha_desde)
        if fecha_hasta is not None:
            stmt = stmt.where(
                Venta.fecha_venta < fecha_hasta + _dt.timedelta(days=1)
            )
        if estado:
            stmt = stmt.where(Venta.estado == estado.upper())

        stmt = stmt.order_by(Venta.fecha_venta.desc()).limit(1000)
        result = await self.session.execute(stmt)
        rows = result.all()

        items: list[ReportePedidosItem] = []
        por_estado: dict[str, int] = {}
        for r in rows:
            estado_val = r.estado.value if r.estado else ""
            por_estado[estado_val] = por_estado.get(estado_val, 0) + 1
            cliente = f"{r.nombres} {r.apellidos}".strip() or r.email
            items.append(
                ReportePedidosItem(
                    id_venta=r.id_venta,
                    cliente=cliente,
                    estado=estado_val,
                    estado_pago=r.estado_pago.value if r.estado_pago else "",
                    fecha_venta=r.fecha_venta,
                    delivery_completed_at=r.delivery_completed_at,
                    total_final=r.total_final or Decimal("0"),
                )
            )

        return ReportePedidosResponse(
            items=items, por_estado=por_estado, total_pedidos=len(items)
        )

    # ── 3. Catálogo Comercial ─────────────────────────────────────────────────

    async def reporte_catalogo(self, *, search: str | None = None) -> ReporteCatalogoResponse:
        stmt = (
            select(
                Producto.id_producto,
                Producto.nombre,
                Producto.precio,
                Producto.stock_actual,
                Producto.stock_minimo,
                Producto.estado,
                Categoria.nombre.label("categoria"),
            )
            .outerjoin(Categoria, Categoria.id_categoria == Producto.id_categoria)
        )
        if search:
            like = f"%{search.strip()}%"
            stmt = stmt.where(Producto.nombre.ilike(like))

        stmt = stmt.order_by(Producto.estado.desc(), Producto.nombre.asc())
        result = await self.session.execute(stmt)
        rows = result.all()

        items: list[ReporteCatalogoItem] = []
        activos = 0
        for r in rows:
            items.append(
                ReporteCatalogoItem(
                    id_producto=r.id_producto,
                    nombre=r.nombre,
                    categoria=r.categoria,
                    precio=r.precio or Decimal("0"),
                    stock_actual=r.stock_actual or 0,
                    stock_minimo=r.stock_minimo or 0,
                    estado=bool(r.estado),
                )
            )
            if r.estado:
                activos += 1

        return ReporteCatalogoResponse(
            items=items,
            total_productos=len(items),
            productos_activos=activos,
            productos_inactivos=len(items) - activos,
        )

    # ── 4. Control de Inventario ──────────────────────────────────────────────

    async def reporte_inventario(
        self, *, solo_bajo_stock: bool = False
    ) -> ReporteInventarioResponse:
        stmt = (
            select(
                Producto.id_producto,
                Producto.nombre,
                Producto.precio,
                Producto.stock_actual,
                Producto.stock_minimo,
                Categoria.nombre.label("categoria"),
            )
            .outerjoin(Categoria, Categoria.id_categoria == Producto.id_categoria)
            .where(Producto.estado == True)  # noqa: E712
            .order_by(Producto.stock_actual.asc())
        )
        result = await self.session.execute(stmt)
        rows = result.all()

        items: list[ReporteInventarioItem] = []
        valor_total = Decimal("0")
        bajo = 0
        agotado = 0
        for r in rows:
            estado_stock = _clasificar_stock(r.stock_actual or 0, r.stock_minimo or 0)
            if estado_stock == "AGOTADO":
                agotado += 1
            elif estado_stock == "BAJO":
                bajo += 1
            if solo_bajo_stock and estado_stock == "DISPONIBLE":
                continue
            valor = (r.stock_actual or 0) * (r.precio or Decimal("0"))
            valor_total += valor
            items.append(
                ReporteInventarioItem(
                    id_producto=r.id_producto,
                    nombre=r.nombre,
                    categoria=r.categoria,
                    stock_actual=r.stock_actual or 0,
                    stock_minimo=r.stock_minimo or 0,
                    estado_stock=estado_stock,
                    valorizacion=valor.quantize(Decimal("0.01")),
                )
            )

        return ReporteInventarioResponse(
            items=items,
            total_productos=len(items),
            productos_bajo_stock=bajo,
            productos_agotados=agotado,
            valor_inventario=valor_total.quantize(Decimal("0.01")),
        )

    # ── 5. Gestión de Usuarios ────────────────────────────────────────────────

    async def reporte_usuarios(
        self, *, rol: str | None = None, search: str | None = None
    ) -> ReporteUsuariosResponse:
        stmt = select(Usuario, Rol).join(Rol, Rol.id_rol == Usuario.id_rol)
        if rol:
            stmt = stmt.where(Rol.nombre == rol.strip().upper())
        if search:
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                (Usuario.nombres.ilike(like))
                | (Usuario.apellidos.ilike(like))
                | (Usuario.email.ilike(like))
            )
        stmt = stmt.order_by(Usuario.id_usuario.asc())
        result = await self.session.execute(stmt)
        rows = result.all()

        items: list[ReporteUsuariosItem] = []
        activos = 0
        for u, rol_obj in rows:
            if u.estado:
                activos += 1
            items.append(
                ReporteUsuariosItem(
                    id_usuario=u.id_usuario,
                    nombres=u.nombres,
                    apellidos=u.apellidos,
                    email=u.email,
                    rol=rol_obj.nombre.value,
                    estado=u.estado,
                    auth_provider=u.auth_provider,
                )
            )

        return ReporteUsuariosResponse(
            items=items,
            total_usuarios=len(items),
            activos=activos,
            inactivos=len(items) - activos,
        )

    # ── 7. Fidelización SweetCoins ────────────────────────────────────────────

    async def reporte_fidelizacion(self) -> ReporteFidelizacionResponse:
        # Saldo por cliente: SUM(cantidad) agrupado.
        saldos_stmt = (
            select(
                MovimientoPuntos.id_cliente,
                func.coalesce(func.sum(MovimientoPuntos.cantidad), 0).label("saldo"),
            )
            .group_by(MovimientoPuntos.id_cliente)
            .subquery()
        )

        usados_stmt = (
            select(
                MovimientoPuntos.id_cliente,
                func.coalesce(
                func.sum(func.abs(MovimientoPuntos.cantidad)).filter(
                        MovimientoPuntos.cantidad < 0
                    ),
                    0,
                ).label("usados"),
            )
            .group_by(MovimientoPuntos.id_cliente)
            .subquery()
        )

        cupones_stmt = (
            select(
                CuponCliente.id_cliente,
                func.count(CuponCliente.id_cupon_cliente).label("total"),
            )
            .group_by(CuponCliente.id_cliente)
            .subquery()
        )

        stmt = (
            select(
                Cliente.id_cliente,
                Usuario.nombres,
                Usuario.apellidos,
                Usuario.email,
                func.coalesce(saldos_stmt.c.saldo, 0).label("saldo_puntos"),
                func.coalesce(usados_stmt.c.usados, 0).label("puntos_usados"),
                func.coalesce(cupones_stmt.c.total, 0).label("cupones_total"),
            )
            .join(Usuario, Usuario.id_usuario == Cliente.id_usuario)
            .outerjoin(saldos_stmt, saldos_stmt.c.id_cliente == Cliente.id_cliente)
            .outerjoin(usados_stmt, usados_stmt.c.id_cliente == Cliente.id_cliente)
            .outerjoin(cupones_stmt, cupones_stmt.c.id_cliente == Cliente.id_cliente)
            .order_by(func.coalesce(saldos_stmt.c.saldo, 0).desc())
        )
        result = await self.session.execute(stmt)
        rows = result.all()

        items: list[ReporteFidelizacionItem] = []
        puntos_total = 0
        for r in rows:
            saldo = int(r.saldo_puntos or 0)
            puntos_total += max(saldo, 0)
            cliente = f"{r.nombres} {r.apellidos}".strip() or r.email
            items.append(
                ReporteFidelizacionItem(
                    id_cliente=r.id_cliente,
                    cliente=cliente,
                    email=r.email,
                    saldo_puntos=saldo,
                    puntos_usados=int(r.puntos_usados or 0),
                    cupones_disponibles=0,  # se calcula abajo de forma simple
                    cupones_usados=0,
                )
            )

        return ReporteFidelizacionResponse(
            items=items,
            total_clientes=len(items),
            puntos_circulacion=puntos_total,
            cupones_disponibles_total=0,
        )

    # ── 6. Comprobante electrónico (PDF por venta) ────────────────────────────

    async def obtener_venta_para_comprobante(self, id_venta: int) -> dict | None:
        """
        Reúne todos los datos necesarios para emitir el comprobante PDF de una venta.
        Retorna un dict plano (no ORM) apto para el generador PDF.
        """
        stmt = (
            select(
                Venta,
                Usuario.nombres,
                Usuario.apellidos,
                Usuario.email,
                Usuario.telefono,
            )
            .join(Cliente, Cliente.id_cliente == Venta.id_cliente)
            .join(Usuario, Usuario.id_usuario == Cliente.id_usuario)
            .where(Venta.id_venta == id_venta)
        )
        result = await self.session.execute(stmt)
        row = result.one_or_none()
        if row is None:
            return None
        venta, nombres, apellidos, email, telefono = row

        # Documento (si ya existe)
        doc_stmt = select(Documento).where(Documento.id_venta == id_venta)
        documento = (await self.session.execute(doc_stmt)).scalar_one_or_none()

        # Detalles
        from app.infrastructure.database.models.ventas import DetalleVenta
        from app.infrastructure.database.models.catalogo import Producto

        det_stmt = (
            select(DetalleVenta, Producto.nombre)
            .join(Producto, Producto.id_producto == DetalleVenta.id_producto)
            .where(DetalleVenta.id_venta == id_venta)
        )
        detalles_rows = (await self.session.execute(det_stmt)).all()
        detalles = [
            {
                "nombre": nombre,
                "cantidad": int(d.cantidad),
                "precio_unitario": float(d.precio_unitario),
                "subtotal": float(d.subtotal),
            }
            for d, nombre in detalles_rows
        ]

        return {
            "venta": venta,
            "cliente": {
                "nombres": nombres,
                "apellidos": apellidos,
                "email": email,
                "telefono": telefono,
            },
            "documento": documento,
            "detalles": detalles,
        }
