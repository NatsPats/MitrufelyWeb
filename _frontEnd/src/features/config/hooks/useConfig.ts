import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { configApi } from '../api/config.api'
import type { SystemConfigResponse } from '../api/config.api'

export const CONFIG_QUERY_KEYS = {
  shipping: (subtotal: number) => ['shippingCost', subtotal] as const,
  system: ['systemConfig'] as const,
}

export function useShippingCost(subtotal: number, enabled: boolean = true) {
  return useQuery({
    queryKey: CONFIG_QUERY_KEYS.shipping(subtotal),
    queryFn: () => configApi.getShippingCost(subtotal),
    enabled: enabled && subtotal > 0,
    staleTime: 60_000,
  })
}

export function useSystemConfig() {
  return useQuery({
    queryKey: CONFIG_QUERY_KEYS.system,
    queryFn: () => configApi.getSystemConfig(),
    staleTime: 60_000,
  })
}

export function useUpdateSystemConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<SystemConfigResponse>) => configApi.updateSystemConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEYS.system })
    },
  })
}
