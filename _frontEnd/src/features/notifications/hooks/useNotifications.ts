import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../api/notifications.api'
import { toast } from 'sonner'

export const NOTIFICATIONS_KEY = ['notifications'] as const

export function useNotificationsQuery() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => notificationsApi.getMisNotificaciones(),
    refetchInterval: 30000, // Poll every 30 seconds
  })
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'unreadCount'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id_notification: number) => notificationsApi.marcarLeida(id_notification),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.marcarTodasLeidas(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
      toast.success('Todas las notificaciones marcadas como leídas')
    },
  })
}
