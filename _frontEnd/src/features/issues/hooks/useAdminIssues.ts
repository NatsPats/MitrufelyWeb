import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { issuesApi } from '../api/issues.api'
import type { UpdateIssueRequest } from '../api/issues.api'

export function useAdminIssuesQuery(limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: ['admin-issues', limit, offset],
    queryFn: () => issuesApi.listIncidencias(limit, offset),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useIssueMetricsQuery() {
  return useQuery({
    queryKey: ['admin-issues-metrics'],
    queryFn: () => issuesApi.getIssueMetrics(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useUpdateIssueMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id_issue, payload }: { id_issue: number; payload: UpdateIssueRequest }) =>
      issuesApi.actualizarIncidencia(id_issue, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-issues'] })
      queryClient.invalidateQueries({ queryKey: ['admin-issues-metrics'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
