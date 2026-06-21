import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../api/dashboard.api'

export const DASHBOARD_QUERY_KEY = ['admin', 'dashboard'] as const

export function useDashboardQuery() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => dashboardApi.getMetrics(),
    staleTime: 60000,
  })
}
