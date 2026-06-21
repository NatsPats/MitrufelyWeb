import { useState, useMemo } from 'react'
import { Link } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Sparkles,
  ArrowLeft,
  Boxes,
  History,
  CheckSquare,
  Plus,
  SlidersHorizontal,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

import type { Lote, MovimientoStock } from '../types'
import {
  useLotsQuery,
  useRegisterLotMutation,
  useAdjustStockMutation,
  useKardexQuery,
} from '../hooks/useInventory'
import { useAdminProducts } from '@/features/products/hooks/useCatalogAdmin'

import { LotsTable } from '../components/LotsTable'
import { RegisterLotModal } from '../components/RegisterLotModal'
import { AdjustStockModal } from '../components/AdjustStockModal'
import { KardexModal } from '../components/KardexModal'
import { ReconciliationPanel } from '../components/ReconciliationPanel'
import { AdminDataTable } from '@/features/products/components/AdminDataTable'

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'lots' | 'kardex' | 'reconciliation'>('lots')

  // Lots product selection state
  const [selectedLotsProductId, setSelectedLotsProductId] = useState<number | null>(null)

  // Modals state
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [selectedLotForAdjustment, setSelectedLotForAdjustment] = useState<Lote | null>(null)
  
  const [kardexModalOpen, setKardexModalOpen] = useState(false)
  const [kardexProduct, setKardexProduct] = useState<{ id: number; name: string } | null>(null)

  // Inline Kardex state
  const [selectedKardexProductId, setSelectedKardexProductId] = useState<number | null>(null)
  const [inlineKardexPage, setInlineKardexPage] = useState(0)
  const [inlineKardexPageSize, setInlineKardexPageSize] = useState(10)

  // Fetch all active products for selectors (max 100)
  const { data: productsData } = useAdminProducts({ size: 100, activo: true })
  const productsList = productsData?.items || []

  // Fetch lots
  const {
    data: lotsData = [],
    isLoading: lotsLoading,
    isError: lotsError,
  } = useLotsQuery(selectedLotsProductId)

  // Inline Kardex query
  const { data: inlineKardexData, isLoading: inlineKardexLoading } = useKardexQuery(
    selectedKardexProductId,
    {
      page: inlineKardexPage + 1,
      page_size: inlineKardexPageSize,
    }
  )

  // Mutators
  const registerLotMut = useRegisterLotMutation()
  const adjustStockMut = useAdjustStockMutation()

  // Handlers
  const handleOpenRegisterModal = () => {
    setRegisterModalOpen(true)
  }

  const handleOpenAdjustModal = (lot: Lote | null = null) => {
    setSelectedLotForAdjustment(lot)
    setAdjustModalOpen(true)
  }

  const handleViewKardex = (productoId: number, productName: string) => {
    setKardexProduct({ id: productoId, name: productName })
    setKardexModalOpen(true)
  }

  const handleRegisterLotSubmit = (data: {
    id_producto: number
    cantidad_inicial: number
    fecha_vencimiento: string | null
  }) => {
    registerLotMut.mutate(data, {
      onSuccess: () => setRegisterModalOpen(false),
    })
  }

  const handleAdjustStockSubmit = (data: {
    id_producto: number
    id_lote: number
    tipo_movimiento: any
    cantidad: number
    observacion?: string | null
  }) => {
    adjustStockMut.mutate(data, {
      onSuccess: () => {
        setAdjustModalOpen(false)
        setSelectedLotForAdjustment(null)
      },
    })
  }

  // Columns definition for Inline Kardex table
  const inlineKardexColumns = useMemo<ColumnDef<MovimientoStock>[]>(
    () => [
      {
        accessorKey: 'fecha_movimiento',
        header: 'Fecha / Hora',
        cell: ({ row }) => {
          const val = row.getValue('fecha_movimiento') as string
          return (
            <span className="text-xs font-mono text-stone-500">
              {new Date(val).toLocaleString()}
            </span>
          )
        },
      },
      {
        accessorKey: 'tipo_movimiento',
        header: 'Tipo',
        cell: ({ row }) => {
          const type = row.getValue('tipo_movimiento') as string
          const isNegative = ['VENTA', 'AJUSTE_NEGATIVO', 'MERMA', 'VENCIMIENTO'].includes(type)
          
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border',
                isNegative
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              )}
            >
              {isNegative ? (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              ) : (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              )}
              {type.replace('_', ' ')}
            </span>
          )
        },
      },
      {
        accessorKey: 'id_lote',
        header: 'Lote físico',
        cell: ({ row }) => {
          const val = row.getValue('id_lote') as number | null
          if (!val) return <span className="text-stone-400 text-xs">FEFO / Auto</span>
          return <span className="font-mono text-xs font-bold text-stone-600">Lote #{val}</span>
        },
      },
      {
        accessorKey: 'cantidad',
        header: 'Cantidad',
        cell: ({ row }) => {
          const qty = row.getValue('cantidad') as number
          const type = row.original.tipo_movimiento
          const isNegative = ['VENTA', 'AJUSTE_NEGATIVO', 'MERMA', 'VENCIMIENTO'].includes(type)

          return (
            <span
              className={cn(
                'font-extrabold text-sm',
                isNegative ? 'text-red-600' : 'text-green-600'
              )}
            >
              {isNegative ? '-' : '+'}{qty} uds
            </span>
          )
        },
      },
      {
        accessorKey: 'stock_resultante',
        header: 'Kardex Resultante',
        cell: ({ row }) => (
          <span className="font-black text-[#5c0f1b]">{row.getValue('stock_resultante')} uds</span>
        ),
      },
      {
        accessorKey: 'observacion',
        header: 'Observación / Motivo',
        cell: ({ row }) => {
          const val = row.getValue('observacion') as string | null
          return (
            <span className="text-xs text-stone-600 max-w-xs block truncate" title={val || ''}>
              {val || <span className="text-stone-300 italic">Sin observaciones</span>}
            </span>
          )
        },
      },
    ],
    []
  )

  const selectedProductName = useMemo(() => {
    return productsList.find((p) => p.id_producto === selectedKardexProductId)?.nombre || ''
  }, [productsList, selectedKardexProductId])

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased pb-12">
      {/* Cabecera */}
      <header className="bg-white border-b border-[#5c0f1b]/10 sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition-all shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black bg-[#ff7a45]/12 border border-[#ff7a45]/20 px-2.5 py-1 rounded-full text-[#ff7a45] uppercase tracking-wide">
                  Panel de Control
                </span>
                <Sparkles className="h-4 w-4 text-[#ff7a45] animate-pulse" />
              </div>
              <h1 className="text-2xl font-black text-[#5c0f1b] tracking-tight mt-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Gestión de Inventario (FEFO)
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => handleOpenAdjustModal(null)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white border border-[#5c0f1b]/20 text-[#5c0f1b] hover:bg-stone-50 px-5 py-2.5 rounded-xl text-sm font-bold shadow-2xs transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Ajuste de Stock
            </button>
            <button
              onClick={handleOpenRegisterModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#5c0f1b] text-white hover:bg-[#7a1525] px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-[#5c0f1b]/15 transition-all hover:scale-[1.02] active:scale-95 border-none cursor-pointer"
            >
              <Plus className="h-4.5 w-4.5" />
              Ingresar Lote Nuevo
            </button>
          </div>
        </div>
      </header>

      {/* Cuerpo principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Selector de Pestañas */}
        <div className="flex border-b border-[#5c0f1b]/10 gap-6">
          <button
            onClick={() => setActiveTab('lots')}
            className={cn(
              'pb-4 text-sm font-black transition-all cursor-pointer flex items-center gap-2 relative border-none bg-transparent',
              activeTab === 'lots'
                ? 'text-[#5c0f1b]'
                : 'text-stone-400 hover:text-stone-600'
            )}
          >
            <Boxes className="h-4.5 w-4.5" />
            Lotes Físicos
            {activeTab === 'lots' && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#5c0f1b] rounded-t-full" />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('kardex')}
            className={cn(
              'pb-4 text-sm font-black transition-all cursor-pointer flex items-center gap-2 relative border-none bg-transparent',
              activeTab === 'kardex'
                ? 'text-[#5c0f1b]'
                : 'text-stone-400 hover:text-stone-600'
            )}
          >
            <History className="h-4.5 w-4.5" />
            Historial Kardex
            {activeTab === 'kardex' && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#5c0f1b] rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('reconciliation')}
            className={cn(
              'pb-4 text-sm font-black transition-all cursor-pointer flex items-center gap-2 relative border-none bg-transparent',
              activeTab === 'reconciliation'
                ? 'text-[#5c0f1b]'
                : 'text-stone-400 hover:text-stone-600'
            )}
          >
            <CheckSquare className="h-4.5 w-4.5" />
            Conciliación de Stock
            {activeTab === 'reconciliation' && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#5c0f1b] rounded-t-full" />
            )}
          </button>
        </div>

        {/* Pestaña: Lotes */}
        {activeTab === 'lots' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-[#5c0f1b]/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="max-w-md w-full">
                <label className="block text-xs font-bold text-[#5c0f1b] uppercase tracking-wider mb-2">
                  Seleccionar Producto para ver Lotes
                </label>
                <select
                  value={selectedLotsProductId || ''}
                  onChange={(e) => {
                    setSelectedLotsProductId(e.target.value ? Number(e.target.value) : null)
                  }}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5c0f1b]/20 focus:border-[#5c0f1b] transition-all text-[#2a1115] cursor-pointer font-bold"
                >
                  <option value="">-- Todos los productos --</option>
                  {productsList.map((p) => (
                    <option key={p.id_producto} value={p.id_producto}>
                      {p.nombre} (Stock: {p.stock_actual} uds)
                    </option>
                  ))}
                </select>
              </div>

              {selectedLotsProductId === null && (
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-stone-400 block">Vista actual</span>
                  <span className="text-sm font-extrabold text-[#5c0f1b]">Todos los lotes (Orden de Ingreso)</span>
                </div>
              )}
              {selectedLotsProductId !== null && (
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-stone-400 block">Producto Seleccionado</span>
                  <span className="text-sm font-extrabold text-[#5c0f1b]">
                    {productsList.find((p) => p.id_producto === selectedLotsProductId)?.nombre || ''}
                  </span>
                </div>
              )}
            </div>

            {lotsError ? (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 text-xs font-semibold">
                <span>Error al cargar lotes físicos del servidor. Revisa tu conexión.</span>
              </div>
            ) : (
              <LotsTable
                lots={lotsData}
                productsList={productsList}
                isLoading={lotsLoading}
                onAdjustStock={(lot) => handleOpenAdjustModal(lot)}
                onViewKardex={handleViewKardex}
              />
            )}
          </div>
        )}

        {/* Pestaña: Kardex */}
        {activeTab === 'kardex' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-[#5c0f1b]/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="max-w-md w-full">
                <label className="block text-xs font-bold text-[#5c0f1b] uppercase tracking-wider mb-2">
                  Seleccionar Producto para ver Kardex
                </label>
                <select
                  value={selectedKardexProductId || ''}
                  onChange={(e) => {
                    setSelectedKardexProductId(e.target.value ? Number(e.target.value) : null)
                    setInlineKardexPage(0)
                  }}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5c0f1b]/20 focus:border-[#5c0f1b] transition-all text-[#2a1115] cursor-pointer font-bold"
                >
                  <option value="">-- Todos los productos --</option>
                  {productsList.map((p) => (
                    <option key={p.id_producto} value={p.id_producto}>
                      {p.nombre} (Stock: {p.stock_actual} uds)
                    </option>
                  ))}
                </select>
              </div>

              {selectedKardexProductId === null && (
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-stone-400 block">Vista actual</span>
                  <span className="text-sm font-extrabold text-[#5c0f1b]">Kardex Global (Orden de Ingreso)</span>
                </div>
              )}
              {selectedKardexProductId !== null && (
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-stone-400 block">Vista actual</span>
                  <span className="text-sm font-extrabold text-[#5c0f1b]">{selectedProductName}</span>
                </div>
              )}
            </div>

            <AdminDataTable
              columns={inlineKardexColumns}
              data={inlineKardexData?.items || []}
              searchKey="tipo_movimiento"
              searchPlaceholder="Filtrar movimientos..."
              isLoading={inlineKardexLoading}
              pageCount={inlineKardexData?.pages || 1}
              pageIndex={inlineKardexPage}
              pageSize={inlineKardexPageSize}
              totalCount={inlineKardexData?.total || 0}
              onPageChange={(page) => setInlineKardexPage(page - 1)}
              onPageSizeChange={(size) => {
                setInlineKardexPageSize(size)
                setInlineKardexPage(0)
              }}
            />
          </div>
        )}

        {/* Pestaña: Conciliación */}
        {activeTab === 'reconciliation' && (
          <ReconciliationPanel />
        )}
      </main>

      {/* Modal: Ingresar Lote */}
      {registerModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRegisterModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative border border-[#5c0f1b]/10 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <RegisterLotModal
              productsList={productsList}
              onSubmit={handleRegisterLotSubmit}
              onCancel={() => setRegisterModalOpen(false)}
              isSubmitting={registerLotMut.isPending}
            />
          </div>
        </div>
      )}

      {/* Modal: Ajustar Stock */}
      {adjustModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            setAdjustModalOpen(false)
            setSelectedLotForAdjustment(null)
          }}
        >
          <div
            className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative border border-[#5c0f1b]/10 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <AdjustStockModal
              productsList={productsList}
              initialLot={selectedLotForAdjustment}
              onSubmit={handleAdjustStockSubmit}
              onCancel={() => {
                setAdjustModalOpen(false)
                setSelectedLotForAdjustment(null)
              }}
              isSubmitting={adjustStockMut.isPending}
            />
          </div>
        </div>
      )}

      {/* Modal: Ver Kardex */}
      {kardexModalOpen && kardexProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            setKardexModalOpen(false)
            setKardexProduct(null)
          }}
        >
          <div
            className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl relative border border-[#5c0f1b]/10 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <KardexModal
              productoId={kardexProduct.id}
              productName={kardexProduct.name}
              onClose={() => {
                setKardexModalOpen(false)
                setKardexProduct(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
