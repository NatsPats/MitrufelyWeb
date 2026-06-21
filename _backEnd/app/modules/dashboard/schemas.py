"""
Mifrufely Web — Dashboard Schemas
"""

from datetime import date
from decimal import Decimal
from typing import Dict, List

from pydantic import BaseModel


class ProductoTopItem(BaseModel):
    id_producto: int
    nombre: str
    total_vendido: int
    total_ingresos: Decimal


class VentasPorDiaItem(BaseModel):
    fecha: date
    cantidad_pedidos: int
    total_ingresos: Decimal


class VentasPorEstadoItem(BaseModel):
    estado: str
    cantidad: int


class DashboardMetricsResponse(BaseModel):
    # Conteo de pedidos
    pedidos_totales: int
    pedidos_pendientes: int
    pedidos_pagados: int
    pedidos_preparando: int
    pedidos_en_camino: int
    pedidos_entregados: int
    pedidos_cancelados: int
    pedidos_reembolsados: int
    pedidos_devueltos: int
    pedidos_anulados: int

    # Financiero
    ventas_totales_monto: Decimal
    monto_reembolsado: Decimal
    ticket_promedio: Decimal

    # Tiempo
    tiempo_promedio_entrega_minutos: float | None

    # Top productos
    productos_mas_vendidos: List[ProductoTopItem]

    # Tendencia (últimos 30 días)
    ventas_por_dia: List[VentasPorDiaItem]

    # Calificaciones
    calificacion_promedio: float | None
    total_calificaciones: int

    # Incidencias
    incidencias_abiertas: int
