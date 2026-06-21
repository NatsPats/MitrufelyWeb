import api from '@/lib/axios'

export interface ReviewResponse {
  id_review: number
  id_venta: number
  id_cliente: number
  rating: number
  comment?: string | null
  created_at: string
}

export interface AdminReviewResponse extends ReviewResponse {
  cliente_nombre: string
  estado_pedido: string
}

export interface ReviewMetricsResponse {
  total_reviews: number
  promedio_calificacion: number
  distribucion_estrellas: Record<number, number>
}

export interface CreateReviewRequest {
  rating: number
  comment?: string
}

export const reviewsApi = {
  crearReview: async (id_venta: number, payload: CreateReviewRequest): Promise<ReviewResponse> => {
    const { data } = await api.post<ReviewResponse>(`/ventas/${id_venta}/review`, payload)
    return data
  },

  getReview: async (id_venta: number): Promise<ReviewResponse | null> => {
    const { data } = await api.get<ReviewResponse | null>(`/ventas/${id_venta}/review`)
    return data
  },

  listReviews: async (limit: number = 50, offset: number = 0): Promise<AdminReviewResponse[]> => {
    const { data } = await api.get<AdminReviewResponse[]>('/admin/reviews', {
      params: { limit, offset },
    })
    return data
  },

  getReviewMetrics: async (): Promise<ReviewMetricsResponse> => {
    const { data } = await api.get<ReviewMetricsResponse>('/admin/reviews/metrics')
    return data
  },
}
