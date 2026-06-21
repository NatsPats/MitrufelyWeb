import api from '@/lib/axios'
import type { 
  VentaResponse, 
  VentaDetalladaResponse, 
  TrackingResponse, 
  TransicionEstadoRequest,
  ReembolsoRequest 
} from '../types'

export interface ListVentasParams {
  limit?: number
  offset?: number
}

export const ordersApi = {
  /**
   * Listar ventas del usuario actual (o del cliente autenticado)
   */
  listVentas: async (params: ListVentasParams = {}): Promise<VentaResponse[]> => {
    const { data } = await api.get<VentaResponse[]>('/ventas', { params })
    return data
  },

  /**
   * Obtener detalle de una venta por ID (ahora usa la respuesta detallada para administradores o info rica)
   */
  getVenta: async (id: number): Promise<VentaDetalladaResponse> => {
    const { data } = await api.get<VentaDetalladaResponse>(`/ventas/${id}`)
    return data
  },

  /**
   * Obtener el tracking público de un pedido
   */
  getTracking: async (id: number): Promise<TrackingResponse> => {
    const { data } = await api.get<TrackingResponse>(`/ventas/${id}/tracking`)
    return data
  },

  // ── Transiciones FSM (Administración) ──

  pagar: async (id: number): Promise<VentaResponse> => {
    const { data } = await api.put<VentaResponse>(`/ventas/${id}/pagar`)
    return data
  },

  preparar: async (id: number): Promise<VentaResponse> => {
    const { data } = await api.put<VentaResponse>(`/ventas/${id}/preparar`)
    return data
  },

  despachar: async (id: number): Promise<VentaResponse> => {
    const { data } = await api.put<VentaResponse>(`/ventas/${id}/despachar`)
    return data
  },

  // Endpoint de entrega (webhook o manual fallback)
  confirmarEntrega: async (id: number): Promise<VentaResponse> => {
    const { data } = await api.put<VentaResponse>(`/ventas/${id}/entregar`)
    return data
  },

  // ── Transiciones FSM Negativas ──

  cancelar: async (id: number, payload: TransicionEstadoRequest): Promise<VentaResponse> => {
    const { data } = await api.put<VentaResponse>(`/ventas/${id}/cancelar`, payload)
    return data
  },

  devolver: async (id: number, payload: TransicionEstadoRequest): Promise<VentaResponse> => {
    const { data } = await api.put<VentaResponse>(`/ventas/${id}/devolver`, payload)
    return data
  },

  reembolsar: async (id: number, payload: ReembolsoRequest): Promise<VentaResponse> => {
    const { data } = await api.put<VentaResponse>(`/ventas/${id}/reembolso`, payload)
    return data
  },
}
