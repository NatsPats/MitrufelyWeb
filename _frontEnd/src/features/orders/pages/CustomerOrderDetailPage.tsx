/**
 * CustomerOrderDetailPage.tsx — Detalle de pedido para el cliente.
 *
 * Ruta: /mi-cuenta/pedidos/:id
 * Consume: GET /api/v1/ventas/{id}
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, ShoppingBag, Clock, Package, Receipt, CreditCard, Coins, Star, AlertTriangle } from 'lucide-react'

import { useAuthStore } from '@/app/store'
import { PublicHeader } from '@/shared/components/layout/PublicHeader'
import { PublicFooter } from '@/shared/components/layout/PublicFooter'
import { useCartItemCount } from '@/features/cart/hooks/useCart'
import { useOrderDetailQuery } from '@/features/orders/hooks/useOrders'
import { OrderTrackingTimeline } from '@/features/orders/components/OrderTrackingTimeline'
import { ReviewModal } from '@/features/reviews/components/ReviewModal'
import { IssueModal } from '@/features/issues/components/IssueModal'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { reviewsApi } from '@/features/reviews/api/reviews.api'

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
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function CustomerOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, isAuthenticated, logout } = useAuthStore()
  const cartCount = useCartItemCount()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  
  // Modals state
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)

  const orderId = id ? Number(id) : null

  const { data: order, isLoading, isError } = useOrderDetailQuery(orderId)

  const { data: reviewData } = useQuery({
    queryKey: ['orders', 'detail', orderId, 'review'],
    queryFn: () => reviewsApi.getReview(orderId!),
    enabled: !!orderId && order?.estado === 'ENTREGADO',
  })

  const handleSearch = (e: React.FormEvent) => { e.preventDefault() }
  const handleLogout = () => { logout(); setUserMenuOpen(false); toast.success('Sesión cerrada.') }

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] })
    queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId, 'review'] })
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased">
        <PublicHeader cartCount={cartCount} favoriteCount={0} coinsBalance={null} userName={null}
          userMenuOpen={false} onUserMenuToggle={() => {}} searchQuery="" onSearchChange={() => {}}
          onSearchSubmit={(e) => e.preventDefault()} onLogout={() => {}} />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="h-8 w-8 text-[#5c0f1b] animate-spin" />
          <span className="text-[#2a1115]/50 font-bold text-sm">Cargando pedido...</span>
        </div>
        <PublicFooter />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased">
        <PublicHeader cartCount={cartCount} favoriteCount={0} coinsBalance={null} userName={null}
          userMenuOpen={false} onUserMenuToggle={() => {}} searchQuery="" onSearchChange={() => {}}
          onSearchSubmit={(e) => e.preventDefault()} onLogout={() => {}} />
        <div className="flex flex-col items-center justify-center py-32 gap-6 text-center max-w-md mx-auto">
          <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
            <Package className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="font-black text-[#2a1115] text-xl" style={{ fontFamily: "'Outfit', sans-serif" }}>Pedido no encontrado</h3>
          <Link to="/mi-cuenta/pedidos" className="px-6 py-3 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all">
            Volver a mis pedidos
          </Link>
        </div>
        <PublicFooter />
      </div>
    )
  }

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
      <main className="max-w-5xl mx-auto px-4 md:px-8 py-10">
        <Link to="/mi-cuenta/pedidos" className="inline-flex items-center gap-2 text-sm font-bold text-[#5c0f1b]/60 hover:text-[#5c0f1b] transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Volver a mis pedidos
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="font-black text-[#2a1115] text-3xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Pedido #{order.id_venta}
              </h1>
              {order.fecha_venta && (
                <p className="text-sm text-[#2a1115]/50 font-semibold mt-1 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> {formatDate(order.fecha_venta)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${ESTADO_LABELS[order.estado]?.color || 'bg-stone-100'}`}>
                {ESTADO_LABELS[order.estado]?.label || order.estado}
              </span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${PAGO_LABELS[order.estado_pago]?.color || 'bg-stone-50'}`}>
                {PAGO_LABELS[order.estado_pago]?.label || order.estado_pago}
              </span>
            </div>
          </div>

          {/* Timeline M14 */}
          {order.order_events && (
            <OrderTrackingTimeline 
              events={order.order_events} 
              currentState={order.estado} 
              pct={order.progreso_pct ?? 0} 
            />
          )}

          {/* Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            
            <div className="space-y-6">
              {/* Acciones de Cliente (Reviews / Issues) */}
              {(order.estado === 'ENTREGADO' || !['CANCELADO', 'DEVUELTO', 'REEMBOLSADO', 'ANULADO'].includes(order.estado)) && (
                <div className="bg-white rounded-2xl border border-[#5c0f1b]/8 p-5 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
                  {order.estado === 'ENTREGADO' && (
                    <div className="flex items-center justify-between w-full sm:w-auto sm:gap-4 border-b sm:border-b-0 sm:border-r border-stone-100 pb-4 sm:pb-0 sm:pr-4">
                      {reviewData ? (
                        <>
                          <div className="max-w-[200px]">
                            <p className="font-black text-[#2a1115] text-sm">¡Gracias por calificar!</p>
                            <p className="text-xs text-[#2a1115]/50 italic truncate">"{reviewData.comment || 'Sin comentario'}"</p>
                          </div>
                          <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1.5 rounded-lg shrink-0">
                            <span className="font-black text-yellow-700 text-sm">{reviewData.rating}.0</span>
                            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="font-black text-[#2a1115] text-sm">¿Te gustaron tus trufas?</p>
                            <p className="text-xs text-[#2a1115]/50">Califica tu pedido</p>
                          </div>
                          <button 
                            onClick={() => setReviewModalOpen(true)}
                            className="px-4 py-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer shrink-0"
                          >
                            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" /> Calificar
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {!['CANCELADO', 'DEVUELTO', 'REEMBOLSADO', 'ANULADO'].includes(order.estado) && (
                    <div className="flex items-center justify-between w-full sm:w-auto sm:gap-4 pt-4 sm:pt-0">
                      <div>
                        <p className="font-black text-[#2a1115] text-sm">¿Tuviste un problema?</p>
                        <p className="text-xs text-[#2a1115]/50">Reportar incidencia</p>
                      </div>
                      <button 
                        onClick={() => setIssueModalOpen(true)}
                        className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> Reportar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Productos */}
              <div className="bg-white rounded-2xl border border-[#5c0f1b]/8 p-5">
                <h3 className="font-black text-[#2a1115] text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-[#5c0f1b]" />
                  Productos
                </h3>
                {order.detalles && order.detalles.length > 0 ? (
                  <div className="space-y-3">
                    {order.detalles.map((det) => (
                      <div key={det.id_detalle} className="flex items-center gap-3 py-2 border-b border-stone-50 last:border-0">
                        <div className="h-12 w-12 rounded-lg bg-[#f0ede8] overflow-hidden shrink-0 flex items-center justify-center">
                          {(det.imagen_url || det.imagen_url_producto) ? (
                            <img src={(det.imagen_url || det.imagen_url_producto)!} alt={det.nombre_producto || ''} className="w-full h-full object-cover" />
                          ) : (
                            <ShoppingBag className="h-5 w-5 text-stone-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#2a1115] text-sm truncate">
                            {det.nombre_producto || det.nombre || `Producto #${det.id_producto}`}
                          </p>
                          <p className="text-xs text-[#2a1115]/50 font-semibold">
                            {det.cantidad} × S/. {Number(det.precio_unitario).toFixed(2)}
                          </p>
                        </div>
                        <p className="font-black text-[#5c0f1b] text-sm shrink-0">
                          S/. {Number(det.subtotal).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#2a1115]/40 font-medium text-center py-8">
                    Sin detalles de productos disponibles.
                  </p>
                )}
              </div>
            </div>

            {/* Resumen */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#5c0f1b]/8 p-5 space-y-3">
                <h3 className="font-black text-[#2a1115] text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-[#5c0f1b]" />
                  Resumen
                </h3>

                {order.subtotal_productos !== undefined && order.subtotal_productos !== null && (
                  <div className="flex justify-between text-sm font-semibold text-[#2a1115]/70">
                    <span>Subtotal</span>
                    <span>S/. {Number(order.subtotal_productos).toFixed(2)}</span>
                  </div>
                )}

                {order.costo_envio !== undefined && order.costo_envio !== null && Number(order.costo_envio) > 0 && (
                  <div className="flex justify-between text-sm font-semibold text-[#2a1115]/70">
                    <span>Envío</span>
                    <span>S/. {Number(order.costo_envio).toFixed(2)}</span>
                  </div>
                )}

                {order.monto_descuento_cupon !== undefined && order.monto_descuento_cupon !== null && Number(order.monto_descuento_cupon) > 0 && (
                  <div className="flex justify-between text-sm font-semibold text-emerald-600">
                    <span>Descuento</span>
                    <span>− S/. {Number(order.monto_descuento_cupon).toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-semibold text-[#2a1115]/70">
                  <span>IGV</span>
                  <span>S/. {Number(order.igv ?? (Number(order.total) / 1.18 * 0.18)).toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-lg font-black text-[#5c0f1b] border-t border-[#5c0f1b]/10 pt-2 mt-2">
                  <span>Total</span>
                  <span>S/. {Number(order.total_final || order.total).toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#5c0f1b]/8 p-5 space-y-3">
                <h3 className="font-black text-[#2a1115] text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#5c0f1b]" />
                  Pago
                </h3>
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-[#2a1115]/60">Método</span>
                  <span className="text-[#2a1115]">
                    {order.metodos_pago?.[0]?.tipo_pago === 'TARJETA' ? 'Tarjeta' : order.metodos_pago?.[0]?.tipo_pago || 'Tarjeta'}
                  </span>
                </div>
                {order.puntos_ganados !== undefined && order.puntos_ganados !== null && (
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-[#2a1115]/60 flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5 text-[#ff7a45]" />
                      SweetCoins
                    </span>
                    <span className="text-[#ff7a45] font-black">+{order.puntos_ganados}</span>
                  </div>
                )}
              </div>

              {/* Placeholders para futuras fases */}
              <div className="bg-white rounded-2xl border border-dashed border-[#5c0f1b]/15 p-5 space-y-3">
                <h3 className="font-black text-[#2a1115] text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                  Documentos
                </h3>
                {order.documentos && order.documentos.length > 0 ? (
                  order.documentos.map((doc) => (
                    <div key={doc.id_documento} className="flex justify-between text-sm font-semibold">
                      <span className="text-[#2a1115]/60">{doc.tipo_documento === 'BOLETA' ? 'Boleta' : doc.tipo_documento}</span>
                      <span className="text-[#2a1115]">{doc.numero_serie || '—'}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#2a1115]/30 font-medium text-center py-4 italic">
                    Comprobante disponible próximamente
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      <PublicFooter />

      {/* Modals M14 */}
      <ReviewModal 
        isOpen={reviewModalOpen} 
        onClose={() => setReviewModalOpen(false)} 
        id_venta={orderId!} 
        onSuccess={handleModalSuccess} 
      />

      <IssueModal 
        isOpen={issueModalOpen} 
        onClose={() => setIssueModalOpen(false)} 
        id_venta={orderId!} 
        onSuccess={handleModalSuccess} 
      />
    </div>
  )
}
