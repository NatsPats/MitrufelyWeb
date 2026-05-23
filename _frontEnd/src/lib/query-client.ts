import { QueryClient } from '@tanstack/react-query'
import type { ApiError } from '@/types/api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /** Reintenta 1 vez en errores de red, no en 4xx */
      retry: (failureCount, error) => {
        const apiError = error as unknown as ApiError
        if (
          typeof apiError.statusCode === 'number' &&
          apiError.statusCode >= 400 &&
          apiError.statusCode < 500
        ) {
          return false
        }
        return failureCount < 1
      },
      /** Considera los datos frescos por 30 segundos */
      staleTime: 1000 * 30,
      /** Mantiene el caché por 5 minutos */
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: import.meta.env.PROD,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
})
