/**
 * useConsultarDocumento — mutation TanStack para consultar DNI/RUC.
 */
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { consultasApi } from '../api/consultasApi'
import type { TipoDocumento } from '../types'

export function useConsultarDocumento() {
  return useMutation({
    mutationFn: ({ tipo, numero }: { tipo: TipoDocumento; numero: string }) =>
      consultasApi.lookupDocumento(tipo, numero),
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error?.message ||
        'No se pudo consultar el documento. Ingrésalo manualmente.'
      toast.error(msg)
    },
  })
}
