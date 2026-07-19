/**
 * consultasApi.ts — cliente HTTP para /consultas/documento.
 */
import api from '@/lib/axios'
import type { DocumentoLookupRequest, DocumentoLookupResult, TipoDocumento } from '../types'

export const consultasApi = {
  lookupDocumento: async (
    tipo: TipoDocumento,
    numero: string,
  ): Promise<DocumentoLookupResult> => {
    const payload: DocumentoLookupRequest = {
      tipo_documento: tipo,
      numero_documento: numero,
    }
    const { data } = await api.post<{ success: boolean; data: DocumentoLookupResult }>(
      '/consultas/documento',
      payload,
    )
    return data.data
  },
}
