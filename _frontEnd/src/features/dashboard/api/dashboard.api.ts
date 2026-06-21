import api from '@/lib/axios'

export interface ProductoTopItem {
  id_producto: number
  nombre: string
  total_vendido: number
  total_ingresos: number
}

export interface VentasPorDiaItem {
  fecha: string
  cantidad_pedidos: number
  total_ingresos: number
}

export interface DashboardMetricsResponse {
  pedidos_totales: number
  pedidos_pendientes: number
  pedidos_pagados: number
  pedidos_preparando: number
  pedidos_en_camino: number
  pedidos_entregados: number
  pedidos_cancelados: number
  pedidos_reembolsados: number
  pedidos_devueltos: number
  pedidos_anulados: number

  ventas_totales_monto: number
  monto_reembolsado: number
  ticket_promedio: number

  tiempo_promedio_entrega_minutos: number | null
  productos_mas_vendidos: ProductoTopItem[]
  ventas_por_dia: VentasPorDiaItem[]
  
  calificacion_promedio: number | null
  total_calificaciones: number
  incidencias_abiertas: number
}

export const dashboardApi = {
  getMetrics: async (): Promise<DashboardMetricsResponse> => {
    const { data } = await api.get<DashboardMetricsResponse>('/admin/dashboard/metrics')
    return data
  },
}
