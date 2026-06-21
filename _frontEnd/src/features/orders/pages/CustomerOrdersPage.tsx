/**
 * CustomerOrdersPage.tsx — Historial de pedidos del cliente.
 *
 * Ruta: /mi-cuenta/pedidos
 * Consume: GET /api/v1/ventas (filtrado por cliente automáticamente)
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ShoppingBag, Clock, Star,
  Loader2, ChevronRight, ArrowLeft, Package, XCircle,
} from 'lucide-react'

import { useAuthStore } from '@/app/store'
import { PublicHeader } from '@/shared/components/layout/PublicHeader'

import { PublicFooter } from '@/shared/components/layout/PublicFooter'
import { useCartItemCount } from '@/features/cart/hooks/useCart'
import { useOrdersQuery } from '@/features/orders/hooks/useOrders'

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  PAGADO: { label: 'Pagado', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  PREPARANDO: { label: 'En Preparación', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  EN_CAMINO: { label: 'En Camino', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  ENTREGADO: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-50 text-red-700 border-red-200' },
  DEVUELTO: { label: 'Devuelto', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  REEMBOLSADO: { label: 'Reembolsado', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  ANULADO: { label: 'Anulado', color: 'bg-stone-100 text-stone-800 border-stone-200' },
}

const PAGO_LABELS: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-amber-50 text-amber-700' },
  PAGADO: { label: 'Pagado', color: 'bg-emerald-50 text-emerald-700' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function CustomerOrdersPage() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const cartCount = useCartItemCount()

  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const { data: orders, isLoading, isError } = useOrdersQuery({ limit: 50 })

  const handleSearch = (e: React.FormEvent) => { e.preventDefault() }
  const handleLogout = () => { logout(); setUserMenuOpen(false); toast.success('Sesión cerrada.') }

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased">
      <PublicHeader
        cartCount={cartCount} favoriteCount={0}
        coinsBalance={isAuthenticated && user ? user.sweetCoinsBalance : null}
        userName={isAuthenticated && user ? user.name : null}
        userMenuOpen={userMenuOpen} onUserMenuToggle={() => setUserMenuOpen((o) => !o)}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearch} onLogout={handleLogout}
      />
      <main className="max-w-4xl mx-auto px-4 md:px-8 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#5c0f1b]/60 hover:text-[#5c0f1b] transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </Link>

        <h1 className="font-black text-[#2a1115] text-3xl mb-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Mis Pedidos
        </h1>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 text-[#5c0f1b] animate-spin" />
            <p className="text-sm font-bold text-[#2a1115]/50">Cargando tus pedidos...</p>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <p className="text-sm font-bold text-red-600">Error al cargar los pedidos.</p>
          </div>
        )}

        {!isLoading && !isError && (!orders || orders.length === 0) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-20 gap-6">
            <div className="h-28 w-28 rounded-full bg-[#5c0f1b]/6 flex items-center justify-center">
              <Package className="h-14 w-14 text-[#5c0f1b]/25" />
            </div>
            <div className="text-center">
              <p className="font-black text-[#2a1115] text-xl mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Aún no tienes pedidos
              </p>
              <p className="text-sm text-[#2a1115]/50 font-medium">
                Explora nuestro catálogo y haz tu primer pedido.
              </p>
            </div>
            <Link to="/catalogo" className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all active:scale-95 shadow-md">
              <ShoppingBag className="h-4 w-4" />
              Ir al catálogo
            </Link>
          </motion.div>
        )}

        {!isLoading && !isError && orders && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order, i) => (
              <motion.div
                key={order.id_venta}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/mi-cuenta/pedidos/${order.id_venta}`)}
                className={`rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group ${
                  order.estado === 'ENTREGADO' && !order.has_review
                    ? 'border-yellow-400 bg-yellow-50/50 hover:border-yellow-500'
                    : 'bg-white border-[#5c0f1b]/8 hover:border-[#5c0f1b]/20'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-[#5c0f1b]/6 flex items-center justify-center group-hover:bg-[#5c0f1b]/10 transition-colors">
                      <ShoppingBag className="h-5 w-5 text-[#5c0f1b]" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-[#2a1115] text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>
                          Pedido #{order.id_venta}
                        </p>
                        {order.estado === 'ENTREGADO' && !order.has_review && (
                          <span className="flex items-center gap-1 bg-yellow-100 text-yellow-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-yellow-200">
                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                            Calificar
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-[#2a1115]/50 flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {order.fecha_venta ? formatDate(order.fecha_venta) : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-2 justify-end mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ESTADO_LABELS[order.estado]?.color || 'bg-stone-100 text-stone-700'}`}>
                          {ESTADO_LABELS[order.estado]?.label || order.estado}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PAGO_LABELS[order.estado_pago]?.color || 'bg-stone-50 text-stone-600'}`}>
                          {PAGO_LABELS[order.estado_pago]?.label || order.estado_pago}
                        </span>
                      </div>
                      <p className="font-black text-[#5c0f1b] text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        S/. {Number(order.total).toFixed(2)}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[#2a1115]/20 group-hover:text-[#5c0f1b] transition-colors shrink-0" />
                  </div>
                </div>

                <div className="sm:hidden flex items-center gap-2 mt-3 justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ESTADO_LABELS[order.estado]?.color || 'bg-stone-100 text-stone-700'}`}>
                      {ESTADO_LABELS[order.estado]?.label || order.estado}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PAGO_LABELS[order.estado_pago]?.color || 'bg-stone-50 text-stone-600'}`}>
                      {PAGO_LABELS[order.estado_pago]?.label || order.estado_pago}
                    </span>
                  </div>
                  <p className="font-black text-[#5c0f1b] text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    S/. {Number(order.total).toFixed(2)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  )
}
