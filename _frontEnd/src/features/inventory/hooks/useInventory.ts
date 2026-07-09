/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../api/inventoryApi'
import type { ListLotsParams, RegisterLotDto, AdjustStockDto, ListKardexParams } from '../api/inventoryApi'
import { toast } from 'sonner'

const formatErrorDetail = (error: any, defaultMsg: string): string => {
  const detail = error?.response?.data?.detail
  if (!detail) return defaultMsg
  if (Array.isArray(detail)) {
    return detail
      .map((err: any) => {
        const fieldName = err.loc && err.loc.length > 1 ? err.loc.slice(1).join('.') : ''
        return fieldName ? `[${fieldName}]: ${err.msg}` : err.msg
      })
      .join(', ')
  }
  if (typeof detail === 'string') return detail
  return defaultMsg
}

export const useLotsQuery = (productoId: number | null, params: ListLotsParams = {}) => {
  return useQuery({
    queryKey: ['inventory-lots', productoId, params],
    queryFn: () => inventoryApi.listLots(productoId, params),
    placeholderData: (prev) => prev,
  })
}

export const useNextFefoLotQuery = (productoId: number | null) => {
  return useQuery({
    queryKey: ['inventory-next-fefo', productoId],
    queryFn: () => inventoryApi.getNextFefoLot(productoId!),
    enabled: productoId !== null,
  })
}

export const useKardexQuery = (productoId: number | null, params: ListKardexParams) => {
  return useQuery({
    queryKey: ['inventory-kardex', productoId, params],
    queryFn: () => inventoryApi.getKardex(productoId, params),
    placeholderData: (prev) => prev,
  })
}

export const useReconciliationQuery = (soloDescuadrados = false) => {
  return useQuery({
    queryKey: ['inventory-reconciliation', soloDescuadrados],
    queryFn: () => inventoryApi.getReconciliation(soloDescuadrados),
  })
}

export const useRegisterLotMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: RegisterLotDto) => inventoryApi.registerLot(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-reconciliation'] })
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Lote registrado con éxito ✨')
    },
    onError: (error: any) => {
      const detail = formatErrorDetail(error, 'Error al registrar el lote.')
      toast.error(`Error: ${detail}`, { duration: 6000 })
    },
  })
}

export const useAdjustStockMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: AdjustStockDto) => inventoryApi.adjustStock(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-kardex'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-reconciliation'] })
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Ajuste de inventario aplicado con éxito ✨')
    },
    onError: (error: any) => {
      const detail = formatErrorDetail(error, 'Error al realizar el ajuste.')
      toast.error(`Error: ${detail}`, { duration: 6000 })
    },
  })
}

export const useAutoAdjustInventoryMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => inventoryApi.autoAdjustInventory(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-kardex'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-reconciliation'] })
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(data.message || 'Autoajuste de inventario completado con éxito ✨')
    },
    onError: (error: any) => {
      const detail = formatErrorDetail(error, 'Error al ejecutar el autoajuste.')
      toast.error(`Error: ${detail}`, { duration: 6000 })
    },
  })
}
