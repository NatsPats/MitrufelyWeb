import { useState, useMemo } from 'react'
import { Link } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Sparkles,
  ArrowLeft,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

import type { VentaResponse } from '../types'
import { useOrdersQuery, useTransitionVentaMutation } from '../hooks/useOrders'
import { AdminDataTable } from '@/features/products/components/AdminDataTable'

// Helper for formatting date
function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso))
}

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')

  // Estado para el modal de confirmación personalizado
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; id: number | null; action: string | null }>({
    isOpen: false,
    id: null,
    action: null,
  })

  // Query sales
  const {
    data: orders = [],
    isLoading,
    isError,
  } = useOrdersQuery({
    limit: 100, // Fetch top 100 for client side filter & sorting in DataTable
  })

  // Mutation for state transitions (M14)
  const transitionMut = useTransitionVentaMutation()

  const handleTransition = (id: number, action: string, e: React.MouseEvent) => {
    e.preventDefault()
    setConfirmModal({ isOpen: true, id, action })
  }

  const confirmTransition = () => {
    if (confirmModal.id && confirmModal.action) {
      transitionMut.mutate(
        { id: confirmModal.id, action: confirmModal.action },
        {
          onSuccess: () => {
            closeConfirmModal()
          },
          onError: () => {
            closeConfirmModal()
          },
        }
      )
    }
  }

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, id: null, action: null })
  }

  // Filter orders on client side to enable clean dashboard-like control
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const statusMatch = statusFilter === 'all' || order.estado === statusFilter
      const paymentMatch = paymentFilter === 'all' || order.estado_pago === paymentFilter
      return statusMatch && paymentMatch
    })
  }, [orders, statusFilter, paymentFilter])

  // tanstack-table columns
  const columns = useMemo<ColumnDef<VentaResponse>[]>(
    () => [
      {
        accessorKey: 'id_venta',
        header: 'ID Pedido',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-black text-[#5c0f1b]">
            #{row.getValue('id_venta')}
          </span>
        ),
      },
      {
        accessorKey: 'fecha_venta',
        header: 'Fecha y Hora',
        cell: ({ row }) => (
          <span className="text-xs font-mono text-stone-500">
            {formatDateTime(row.getValue('fecha_venta'))}
          </span>
        ),
      },
      {
        accessorKey: 'id_cliente',
        header: 'ID Cliente',
        cell: ({ row }) => (
          <span className="text-xs font-mono text-stone-600">
            Cliente #{row.getValue('id_cliente')}
          </span>
        ),
      },
      {
        accessorKey: 'estado',
        header: 'Estado Pedido',
        cell: ({ row }) => {
          const val = row.getValue('estado') as string
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border',
                val === 'PAGADO' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                val === 'PENDIENTE' && 'bg-amber-50 text-amber-700 border-amber-200',
                val === 'ENTREGADO' && 'bg-purple-50 text-purple-700 border-purple-200',
                val === 'ANULADO' && 'bg-red-50 text-red-700 border-red-200'
              )}
            >
              {val === 'PAGADO' && <CheckCircle2 className="h-3 w-3" />}
              {val === 'PENDIENTE' && <HelpCircle className="h-3 w-3" />}
              {val === 'ANULADO' && <AlertCircle className="h-3 w-3" />}
              {val}
            </span>
          )
        },
      },
      {
        accessorKey: 'estado_pago',
        header: 'Estado Pago',
        cell: ({ row }) => {
          const val = row.getValue('estado_pago') as string
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border',
                val === 'PAGADO' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
              )}
            >
              {val === 'PAGADO' ? 'Pagado' : 'Pendiente'}
            </span>
          )
        },
      },
      {
        accessorKey: 'total',
        header: 'Monto Total',
        cell: ({ row }) => (
          <span className="font-black text-[#5c0f1b]">
            S/. {Number(row.getValue('total')).toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: 'puntos_ganados',
        header: 'SweetCoins',
        cell: ({ row }) => (
          <span className="font-extrabold text-xs text-[#ff7a45]">
            ⭐️ +{row.getValue('puntos_ganados')} SC
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => {
          const order = row.original
          
          return (
            <div className="flex items-center gap-2">
              <Link
                to={`/orders/${order.id_venta}`}
                className="inline-flex items-center justify-center p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-[#5c0f1b] transition-all shadow-2xs cursor-pointer"
                title="Ver detalles"
              >
                <Eye className="h-4 w-4" />
              </Link>
              
              <div className="relative group">
                <button className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-bold text-stone-600">
                  Acciones ▼
                </button>
                <div className="absolute right-0 mt-1 w-36 bg-white border border-stone-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                  {order.estado === 'PENDIENTE' && (
                    <>
                      <button onClick={(e) => handleTransition(order.id_venta, 'pagar', e)} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-blue-50 text-blue-700">Marcar Pagado</button>
                      <button onClick={(e) => handleTransition(order.id_venta, 'cancelar', e)} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-red-50 text-red-700">Cancelar</button>
                    </>
                  )}
                  {order.estado === 'PAGADO' && (
                    <>
                      <button onClick={(e) => handleTransition(order.id_venta, 'preparar', e)} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-orange-50 text-orange-700">Preparar</button>
                      <button onClick={(e) => handleTransition(order.id_venta, 'reembolsar', e)} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-purple-50 text-purple-700">Reembolsar</button>
                    </>
                  )}
                  {order.estado === 'PREPARANDO' && (
                    <button onClick={(e) => handleTransition(order.id_venta, 'despachar', e)} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-indigo-50 text-indigo-700">Despachar</button>
                  )}
                  {order.estado === 'EN_CAMINO' && (
                    <button onClick={(e) => handleTransition(order.id_venta, 'entregar', e)} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-emerald-50 text-emerald-700">Entregar</button>
                  )}
                  {order.estado === 'ENTREGADO' && (
                    <button onClick={(e) => handleTransition(order.id_venta, 'devolver', e)} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-rose-50 text-rose-700">Devolver</button>
                  )}
                </div>
              </div>
            </div>
          )
        },
      },
    ],
    [transitionMut.isPending]
  )

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
                  Panel Administrativo
                </span>
                <Sparkles className="h-4 w-4 text-[#ff7a45] animate-pulse" />
              </div>
              <h1 className="text-2xl font-black text-[#5c0f1b] tracking-tight mt-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Gestión de Pedidos / Ventas
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Cuerpo principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Filtros rápidos */}
        <div className="bg-white p-5 rounded-2xl border border-[#5c0f1b]/10 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Filtro de Estado Pedido */}
          <div>
            <label className="block text-xs font-bold text-[#5c0f1b] uppercase tracking-wider mb-2">
              Estado de Venta
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5c0f1b]/20 focus:border-[#5c0f1b] transition-all text-[#2a1115] cursor-pointer font-bold"
            >
              <option value="all">Todos los estados</option>
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="PAGADO">PAGADO</option>
              <option value="ENTREGADO">ENTREGADO</option>
              <option value="ANULADO">ANULADO</option>
            </select>
          </div>

          {/* Filtro de Estado Pago */}
          <div>
            <label className="block text-xs font-bold text-[#5c0f1b] uppercase tracking-wider mb-2">
              Estado de Pago
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5c0f1b]/20 focus:border-[#5c0f1b] transition-all text-[#2a1115] cursor-pointer font-bold"
            >
              <option value="all">Todos los pagos</option>
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="PAGADO">PAGADO</option>
            </select>
          </div>

          {/* Total de ventas filtradas */}
          <div className="flex flex-col justify-end text-right md:pr-4">
            <span className="text-[10px] font-black uppercase text-stone-400 block mb-1">Monto total filtrado</span>
            <span className="text-xl font-black text-[#5c0f1b]" style={{ fontFamily: "'Outfit', sans-serif" }}>
              S/. {filteredOrders.reduce((sum, order) => sum + Number(order.total), 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Tabla de órdenes */}
        {isError ? (
          <div className="bg-red-50 border border-red-200 p-6 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-semibold">
            <span>Error al cargar las ventas desde el servidor. Revisa tu conexión.</span>
          </div>
        ) : (
          <AdminDataTable
            columns={columns}
            data={filteredOrders}
            searchPlaceholder="Buscar por ID o Cliente..."
            isLoading={isLoading}
            searchKey="id_venta"
          />
        )}
      </main>

      {/* Modal de Confirmación Custom */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative border border-[#5c0f1b]/10 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-black text-[#5c0f1b] mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>Confirmar Acción</h3>
            <p className="text-sm text-stone-600 mb-6">
              ¿Estás seguro de que deseas aplicar la acción <strong>'{confirmModal.action}'</strong> a la venta <strong>#{confirmModal.id}</strong>?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={closeConfirmModal}
                disabled={transitionMut.isPending}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-sm hover:bg-stone-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmTransition}
                disabled={transitionMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-[#5c0f1b] text-white font-bold text-sm hover:bg-[#7a1525] transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {transitionMut.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Sí, aplicar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
