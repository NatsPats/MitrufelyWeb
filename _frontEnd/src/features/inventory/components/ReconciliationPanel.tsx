import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { RefreshCw, CheckCircle, AlertOctagon, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReconciliationItem } from '../types'
import { useReconciliationQuery, useAutoAdjustInventoryMutation } from '../hooks/useInventory'
import { AdminDataTable } from '@/features/products/components/AdminDataTable'

export function ReconciliationPanel() {
  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useReconciliationQuery()

  const autoAdjust = useAutoAdjustInventoryMutation()

  // Audit results summary
  const summary = useMemo(() => {
    const total = items.length
    const discrepancies = items.filter((i) => i.descuadrado).length
    return {
      total,
      discrepancies,
      isClean: discrepancies === 0,
    }
  }, [items])

  const columns = useMemo<ColumnDef<ReconciliationItem>[]>(
    () => [
      {
        accessorKey: 'id_producto',
        header: 'ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-stone-500">
            #{row.getValue('id_producto')}
          </span>
        ),
      },
      {
        accessorKey: 'nombre',
        header: 'Producto',
        cell: ({ row }) => (
          <span className="font-bold text-[#2a1115]">{row.getValue('nombre')}</span>
        ),
      },
      {
        accessorKey: 'stock_actual',
        header: 'Stock Caché',
        cell: ({ row }) => (
          <span className="font-bold text-stone-700">{row.getValue('stock_actual')} uds</span>
        ),
      },
      {
        accessorKey: 'stock_calculado_kardex',
        header: 'Kardex (Transaccional)',
        cell: ({ row }) => (
          <span className="font-semibold text-stone-600">
            {row.getValue('stock_calculado_kardex')} uds
          </span>
        ),
      },
      {
        accessorKey: 'stock_calculado_lotes',
        header: 'Lotes Activos (Físico)',
        cell: ({ row }) => (
          <span className="font-semibold text-stone-600">
            {row.getValue('stock_calculado_lotes')} uds
          </span>
        ),
      },
      {
        accessorKey: 'descuadrado',
        header: 'Estado Auditoría',
        cell: ({ row }) => {
          const isDrifting = row.getValue('descuadrado') as boolean

          return (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border',
                isDrifting
                  ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                  : 'bg-green-50 text-green-700 border-green-200'
              )}
            >
              {isDrifting ? (
                <>
                  <AlertOctagon className="h-3.5 w-3.5" />
                  DESALINEADO
                </>
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  CUADRADO
                </>
              )}
            </span>
          )
        },
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      {/* Resumen de Auditoría */}
      <div
        className={cn(
          'p-5 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4',
          summary.isClean
            ? 'bg-green-50/50 border-green-200/60'
            : 'bg-red-50/50 border-red-200/60'
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'p-3 rounded-xl',
              summary.isClean ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}
          >
            {summary.isClean ? (
              <CheckCircle className="h-6 w-6" />
            ) : (
              <AlertTriangle className="h-6 w-6" />
            )}
          </div>
          <div>
            <h3
              className={cn(
                'text-lg font-black',
                summary.isClean ? 'text-green-800' : 'text-red-800'
              )}
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {summary.isClean
                ? 'Inventario Conciliado'
                : 'Se detectaron discrepancias de stock'}
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              La conciliación triple compara las existencias en caché del producto, la suma de
              movimientos del Kardex, y el stock en lotes físicos activos.
            </p>
            {!summary.isClean && (
              <p className="text-xs font-bold text-red-600 mt-2">
                ⚠️ Hay {summary.discrepancies} producto(s) desalineado(s). Ejecute el autoajuste basado en lotes activos o haga una corrección manual.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 shrink-0 w-full md:w-auto">
          {!summary.isClean && (
            <button
              onClick={() => autoAdjust.mutate()}
              disabled={autoAdjust.isPending || isLoading || isRefetching}
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-600/15 transition-all border-none cursor-pointer active:scale-95"
            >
              {autoAdjust.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Autoajustar Stock
            </button>
          )}

          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching || autoAdjust.isPending}
            className="inline-flex items-center justify-center gap-2 bg-[#5c0f1b] text-white hover:bg-[#7a1525] disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-[#5c0f1b]/15 transition-all border-none cursor-pointer active:scale-95"
          >
            <RefreshCw className={cn('h-4 w-4', (isLoading || isRefetching) && 'animate-spin')} />
            Ejecutar Auditoría
          </button>
        </div>
      </div>

      {/* Tabla de Conciliación */}
      {isError ? (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 text-xs font-semibold">
          Error al cargar los datos de conciliación de inventario.
        </div>
      ) : (
        <AdminDataTable
          columns={columns}
          data={items}
          searchKey="nombre"
          searchPlaceholder="Buscar por producto..."
          isLoading={isLoading || isRefetching}
        />
      )}
    </div>
  )
}
