import api from '@/lib/axios'

export interface IssueResponse {
  id_issue: number
  id_venta: number
  issue_type: string
  description: string
  status: string
  reported_by: number | null
  resolved_by: number | null
  resolution: string | null
  created_at: string
  updated_at: string
}

export interface AdminIssueResponse extends IssueResponse {
  cliente_nombre: string
  estado_pedido: string
}

export interface IssueMetricsResponse {
  total_incidencias: number
  abiertas: number
  resueltas: number
  cerradas: number
  en_revision: number
  por_tipo: Record<string, number>
}

export interface CreateIssueRequest {
  issue_type: string
  description: string
}

export interface UpdateIssueRequest {
  status: string
  resolution?: string
  resolution_type?: string
  monto_reembolso?: number
}

export const issuesApi = {
  crearIncidencia: async (id_venta: number, payload: CreateIssueRequest): Promise<IssueResponse> => {
    const { data } = await api.post<IssueResponse>(`/ventas/${id_venta}/incidencia`, payload)
    return data
  },

  getIncidenciasVenta: async (id_venta: number): Promise<IssueResponse[]> => {
    const { data } = await api.get<IssueResponse[]>(`/ventas/${id_venta}/incidencias`)
    return data
  },

  listIncidencias: async (limit: number = 50, offset: number = 0): Promise<AdminIssueResponse[]> => {
    const { data } = await api.get<AdminIssueResponse[]>('/admin/incidencias', {
      params: { limit, offset },
    })
    return data
  },

  actualizarIncidencia: async (id_issue: number, payload: UpdateIssueRequest): Promise<IssueResponse> => {
    const { data } = await api.put<IssueResponse>(`/admin/incidencias/${id_issue}`, payload)
    return data
  },

  getIssueMetrics: async (): Promise<IssueMetricsResponse> => {
    const { data } = await api.get<IssueMetricsResponse>('/admin/incidencias/metrics')
    return data
  },
}
