import api from '@/lib/axios'

export interface ShippingCostResponse {
  subtotal: number
  costo_envio: number
  total: number
  aplica_envio_gratis: boolean
  mensaje: string
}

export interface SystemConfigResponse {
  shipping_cost: number
  free_shipping_threshold: number
  delivery_base_time_minutes: number
  preparation_base_time_minutes: number
  eta_factor_per_product: number
}

export interface UpdateConfigRequest {
  shipping_cost?: number
  free_shipping_threshold?: number
  delivery_base_time_minutes?: number
  preparation_base_time_minutes?: number
  eta_factor_per_product?: number
}

export const configApi = {
  getShippingCost: async (subtotal: number): Promise<ShippingCostResponse> => {
    const { data } = await api.get<ShippingCostResponse>('/config/shipping-cost', {
      params: { subtotal },
    })
    return data
  },

  getSystemConfig: async (): Promise<SystemConfigResponse> => {
    const { data } = await api.get<SystemConfigResponse>('/admin/config')
    return data
  },

  updateSystemConfig: async (payload: UpdateConfigRequest): Promise<SystemConfigResponse> => {
    const { data } = await api.put<SystemConfigResponse>('/admin/config/shipping', payload)
    return data
  },
}
