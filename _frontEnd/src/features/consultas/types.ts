/**
 * Tipos del feature de consultas DNI/RUC.
 */

export type TipoDocumento = 'DNI' | 'RUC'

export interface DocumentoLookupRequest {
  tipo_documento: TipoDocumento
  numero_documento: string
}

export interface DocumentoLookupResult {
  tipo_documento: TipoDocumento
  numero_documento: string
  nombres: string | null
  apellidos: string | null
  razon_social: string | null
  direccion_fiscal: string | null
  origen: 'api' | 'cache'
  ya_tiene_datos: boolean
}
