import api from '@/lib/axios'
import type { PaginatedResponse } from '@/features/products/types'
import type {
  Lote,
  MovimientoStock,
  ReconciliationItem,
  NextLotResponse,
  TipoMovimientoStock,
} from '../types'

export interface ListLotsParams {
  solo_vigentes?: boolean | undefined
}

export interface RegisterLotDto {
  id_producto: number
  cantidad_inicial: number
  fecha_vencimiento: string | null // ISO date string or similar
}

export interface AdjustStockDto {
  id_producto: number
  id_lote: number
  tipo_movimiento: TipoMovimientoStock
  cantidad: number
  observacion?: string | null
}

export interface ListKardexParams {
  page?: number | undefined
  page_size?: number | undefined
}

export const inventoryApi = {
  /**
   * Listar lotes de un producto en orden FEFO
   */
  listLots: async (productoId: number | null, params: ListLotsParams = {}): Promise<Lote[]> => {
    const qParams = productoId ? { ...params, id_producto: productoId } : params
    const { data } = await api.get<Lote[]>(`/inventory/lots`, { params: qParams })
    return data
  },

  /**
   * Registrar un nuevo lote de producto al almacén físico
   */
  registerLot: async (dto: RegisterLotDto): Promise<Lote> => {
    const { data } = await api.post<Lote>('/inventory/lots', dto)
    return data
  },

  /**
   * Obtiene el próximo lote físico que consumirá el algoritmo FEFO para un producto (Solo informativo)
   */
  getNextFefoLot: async (productoId: number): Promise<NextLotResponse> => {
    const { data } = await api.get<NextLotResponse>(`/inventory/fefo/${productoId}`)
    return data
  },

  /**
   * Registra una merma o ajuste manual sobre un lote específico
   */
  adjustStock: async (dto: AdjustStockDto): Promise<MovimientoStock> => {
    const { data } = await api.post<MovimientoStock>('/inventory/adjustments', dto)
    return data
  },

  /**
   * Obtiene el historial cronológico (Kardex) de un producto físico
   */
  getKardex: async (productoId: number | null, params: ListKardexParams = {}): Promise<PaginatedResponse<MovimientoStock>> => {
    const qParams = productoId ? { ...params, id_producto: productoId } : params
    const { data } = await api.get<PaginatedResponse<MovimientoStock>>(`/inventory/kardex`, { params: qParams })
    return data
  },

  /**
   * Concilia el stock del cache contra la suma de Kardex y Lotes (Auditoría)
   */
  getReconciliation: async (soloDescuadrados = false): Promise<ReconciliationItem[]> => {
    const params = soloDescuadrados ? { solo_descuadrados: true } : undefined
    const { data } = await api.get<ReconciliationItem[]>('/inventory/reconciliation', { params })
    return data
  },

  /**
   * Ejecuta el autoajuste de conciliación basándose únicamente en los lotes activos como fuente de verdad
   */
  autoAdjustInventory: async (): Promise<{ success: boolean; message: string; adjusted_products: any[] }> => {
    const { data } = await api.post('/inventory/reconciliation/auto-adjust')
    return data
  },
}
