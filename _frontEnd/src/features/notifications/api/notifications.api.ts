import api from '@/lib/axios'

export interface NotificationResponse {
  id_notification: number
  id_usuario: number
  id_venta: number | null
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  read_at: string | null
}

export interface UnreadCountResponse {
  unread_count: number
}

export const notificationsApi = {
  getMisNotificaciones: async (
    limit: number = 50,
    soloNoLeidas: boolean = false
  ): Promise<NotificationResponse[]> => {
    const { data } = await api.get<NotificationResponse[]>('/notificaciones', {
      params: { limit, solo_no_leidas: soloNoLeidas },
    })
    return data
  },

  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const { data } = await api.get<UnreadCountResponse>('/notificaciones/no-leidas')
    return data
  },

  marcarLeida: async (id: number): Promise<NotificationResponse> => {
    const { data } = await api.put<NotificationResponse>(`/notificaciones/${id}/leer`)
    return data
  },

  marcarTodasLeidas: async (): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>('/notificaciones/leer-todas')
    return data
  },
}
