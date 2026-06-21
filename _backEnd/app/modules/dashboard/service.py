"""
Mifrufely Web — Dashboard Service
Queries agregadas para métricas del panel administrativo.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

import structlog
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models.enums import EstadoIncidenciaEnum, EstadoVentaEnum
from app.infrastructure.database.models.pedidos_ext import OrderIssue, OrderReview
from app.infrastructure.database.models.ventas import DetalleVenta, Venta
from app.modules.dashboard.schemas import (
    DashboardMetricsResponse,
    ProductoTopItem,
    VentasPorDiaItem,
)

logger = structlog.get_logger(__name__)


class DashboardService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_metrics(self) -> DashboardMetricsResponse:
        """Calcula todas las métricas del dashboard en una sola invocación."""
        logger.info("dashboard.metrics.calculating")

        # ── Conteo por estado ──────────────────────────────────────────────
        stmt_estados = select(
            Venta.estado,
            func.count(Venta.id_venta).label("cantidad")
        ).group_by(Venta.estado)

        result_estados = await self.session.execute(stmt_estados)
        estado_map: dict[str, int] = {row.estado.value: row.cantidad for row in result_estados}

        pedidos_totales = sum(estado_map.values())

        # ── Financiero ─────────────────────────────────────────────────────
        stmt_financiero = select(
            func.coalesce(func.sum(Venta.total_final), 0).label("total_ventas"),
            func.coalesce(func.sum(Venta.refund_amount), 0).label("total_reembolsado"),
            func.coalesce(func.avg(Venta.total_final), 0).label("ticket_promedio"),
        ).where(Venta.estado.notin_([EstadoVentaEnum.ANULADO, EstadoVentaEnum.CANCELADO]))

        result_fin = await self.session.execute(stmt_financiero)
        fin_row = result_fin.one()

        # ── Tiempo promedio de entrega ─────────────────────────────────────
        stmt_tiempo = select(
            func.avg(
                func.extract(
                    "epoch",
                    Venta.delivery_completed_at - Venta.fecha_venta
                ) / 60
            ).label("avg_minutos")
        ).where(
            Venta.delivery_completed_at.isnot(None),
            Venta.estado == EstadoVentaEnum.ENTREGADO,
        )

        result_tiempo = await self.session.execute(stmt_tiempo)
        tiempo_row = result_tiempo.one_or_none()
        avg_minutos = float(tiempo_row.avg_minutos) if tiempo_row and tiempo_row.avg_minutos else None

        # ── Top 10 productos más vendidos ──────────────────────────────────
        from app.infrastructure.database.models.catalogo import Producto

        stmt_top = (
            select(
                DetalleVenta.id_producto,
                Producto.nombre,
                func.sum(DetalleVenta.cantidad).label("total_vendido"),
                func.sum(DetalleVenta.subtotal).label("total_ingresos"),
            )
            .join(Producto, Producto.id_producto == DetalleVenta.id_producto)
            .join(Venta, Venta.id_venta == DetalleVenta.id_venta)
            .where(Venta.estado.notin_([EstadoVentaEnum.ANULADO, EstadoVentaEnum.CANCELADO]))
            .group_by(DetalleVenta.id_producto, Producto.nombre)
            .order_by(func.sum(DetalleVenta.cantidad).desc())
            .limit(10)
        )

        result_top = await self.session.execute(stmt_top)
        productos_top = [
            ProductoTopItem(
                id_producto=row.id_producto,
                nombre=row.nombre,
                total_vendido=row.total_vendido,
                total_ingresos=Decimal(str(row.total_ingresos)),
            )
            for row in result_top
        ]

        # ── Ventas por día (últimos 30 días) ───────────────────────────────
        hace_30_dias = datetime.utcnow() - timedelta(days=30)

        stmt_por_dia = (
            select(
                func.date(Venta.fecha_venta).label("fecha"),
                func.count(Venta.id_venta).label("cantidad_pedidos"),
                func.coalesce(func.sum(Venta.total_final), 0).label("total_ingresos"),
            )
            .where(
                Venta.fecha_venta >= hace_30_dias,
                Venta.estado.notin_([EstadoVentaEnum.ANULADO]),
            )
            .group_by(func.date(Venta.fecha_venta))
            .order_by(func.date(Venta.fecha_venta))
        )

        result_dia = await self.session.execute(stmt_por_dia)
        ventas_por_dia = [
            VentasPorDiaItem(
                fecha=row.fecha,
                cantidad_pedidos=row.cantidad_pedidos,
                total_ingresos=Decimal(str(row.total_ingresos)),
            )
            for row in result_dia
        ]

        # ── Calificaciones ─────────────────────────────────────────────────
        stmt_reviews = select(
            func.avg(OrderReview.rating).label("avg_rating"),
            func.count(OrderReview.id_review).label("total"),
        )
        result_reviews = await self.session.execute(stmt_reviews)
        rev_row = result_reviews.one_or_none()
        avg_rating = float(rev_row.avg_rating) if rev_row and rev_row.avg_rating else None
        total_reviews = rev_row.total if rev_row else 0

        # ── Incidencias abiertas ───────────────────────────────────────────
        stmt_issues = select(func.count(OrderIssue.id_issue)).where(
            OrderIssue.status.in_([EstadoIncidenciaEnum.ABIERTA, EstadoIncidenciaEnum.EN_REVISION])
        )
        result_issues = await self.session.execute(stmt_issues)
        incidencias_abiertas = result_issues.scalar_one_or_none() or 0

        return DashboardMetricsResponse(
            pedidos_totales=pedidos_totales,
            pedidos_pendientes=estado_map.get("PENDIENTE", 0),
            pedidos_pagados=estado_map.get("PAGADO", 0),
            pedidos_preparando=estado_map.get("PREPARANDO", 0),
            pedidos_en_camino=estado_map.get("EN_CAMINO", 0),
            pedidos_entregados=estado_map.get("ENTREGADO", 0),
            pedidos_cancelados=estado_map.get("CANCELADO", 0),
            pedidos_reembolsados=estado_map.get("REEMBOLSADO", 0),
            pedidos_devueltos=estado_map.get("DEVUELTO", 0),
            pedidos_anulados=estado_map.get("ANULADO", 0),
            ventas_totales_monto=Decimal(str(fin_row.total_ventas)),
            monto_reembolsado=Decimal(str(fin_row.total_reembolsado)),
            ticket_promedio=Decimal(str(fin_row.ticket_promedio)).quantize(Decimal("0.01")),
            tiempo_promedio_entrega_minutos=avg_minutos,
            productos_mas_vendidos=productos_top,
            ventas_por_dia=ventas_por_dia,
            calificacion_promedio=avg_rating,
            total_calificaciones=total_reviews,
            incidencias_abiertas=incidencias_abiertas,
        )
