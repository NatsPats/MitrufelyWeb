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
import { Loader2, ArrowLeft, ShoppingBag, Clock, Package, Receipt, CreditCard, Coins, Star, AlertTriangle, Download, Ban, AlertCircle, XCircle } from 'lucide-react'

import { useOrderDetailQuery, useTransitionVentaMutation } from '@/features/orders/hooks/useOrders'
import { OrderTrackingTimeline } from '@/features/orders/components/OrderTrackingTimeline'
import { ReviewModal } from '@/features/reviews/components/ReviewModal'
import { IssueModal } from '@/features/issues/components/IssueModal'
import { reportsApi, descargarBlob } from '@/features/reports/api/reports.api'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { reviewsApi } from '@/features/reviews/api/reviews.api'
import { useProfileData } from '@/features/auth/hooks/useProfile'

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
  const queryClient = useQueryClient()
  
  // Modals state
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [downloadingComprobante, setDownloadingComprobante] = useState(false)
  // Cancelación por el cliente
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelMotivo, setCancelMotivo] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)
  const transitionMut = useTransitionVentaMutation()
  const { data: profileData } = useProfileData()

  const orderId = id ? Number(id) : null

  const ESTADOS_CANCELABLES = ['PENDIENTE', 'PAGADO', 'PREPARANDO']

  const handleCancelarPedido = () => {
    if (!orderId) return
    if (cancelMotivo.trim().length < 5) {
      setCancelError('El motivo debe tener al menos 5 caracteres.')
      return
    }
    transitionMut.mutate(
      { id: orderId, action: 'cancelar', payload: { motivo: cancelMotivo.trim() } },
      {
        onSuccess: () => {
          setCancelModalOpen(false)
          setCancelMotivo('')
          setCancelError(null)
        },
        onError: (error: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = error as any
          const detail = e?.response?.data?.detail
          let msg = 'No se pudo cancelar el pedido.'
          if (Array.isArray(detail)) msg = detail.map((err) => err.msg || err).join(', ')
          else if (typeof detail === 'string') msg = detail
          setCancelError(msg)
        },
      }
    )
  }

  const handleDownloadComprobante = async () => {
    if (!orderId) return
    setDownloadingComprobante(true)
    try {
      const blob = await reportsApi.descargarComprobante(orderId)
      const tipo = order?.documentos?.[0]?.tipo_documento?.toLowerCase() ?? 'comprobante'
      const serie = order?.documentos?.[0]?.numero_serie ?? String(orderId)
      descargarBlob(blob, `${tipo}_${serie}.pdf`)
      toast.success('Comprobante descargado')
    } catch {
      toast.error('No se pudo generar el comprobante')
    } finally {
      setDownloadingComprobante(false)
    }
  }

  const { data: order, isLoading, isError } = useOrderDetailQuery(orderId)
  const esPropietario = !!profileData?.cliente?.id_cliente && profileData.cliente.id_cliente === order?.id_cliente

  // Totales calculados en el frontend únicamente: total = subtotal + igv + costo_envio - descuento
  const subtotalVal = Number(order?.subtotal_productos || 0)
  const igvVal = Number(order?.igv || (subtotalVal / 1.18 * 0.18))
  const envioVal = Number(order?.costo_envio || 0)
  const descuentoVal = Number(order?.monto_descuento_cupon || 0)
  const totalCalculado = subtotalVal + igvVal + envioVal - descuentoVal

  const { data: reviewData } = useQuery({
    queryKey: ['orders', 'detail', orderId, 'review'],
    queryFn: () => reviewsApi.getReview(orderId!),
    enabled: !!orderId && order?.estado === 'ENTREGADO',
  })



  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] })
    queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId, 'review'] })
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="w-full">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="h-8 w-8 text-[#5c0f1b] animate-spin" />
          <span className="text-[#2a1115]/50 font-bold text-sm">Cargando pedido...</span>
        </div>
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="w-full">
        <div className="flex flex-col items-center justify-center py-32 gap-6 text-center max-w-md mx-auto">
          <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
            <Package className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="font-black text-[#2a1115] text-xl" style={{ fontFamily: "'Outfit', sans-serif" }}>Pedido no encontrado</h3>
          <Link to="/mi-cuenta/pedidos" className="px-6 py-3 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all">
            Volver a mis pedidos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
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
              {/* Alerta de Administrador/Consulta si no es propietario */}
              {order && !esPropietario && (
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex items-start gap-2.5 shadow-sm">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-black text-amber-900 text-sm">Vista de Administrador / Consulta</h4>
                    <p className="text-xs text-amber-800 font-semibold mt-1">
                      Este pedido pertenece al cliente: <span className="underline font-black">{order.cliente_nombre || 'Cliente de Mitrufely'}</span>.
                      Las opciones de calificación, reportes y cancelación de pedido están deshabilitadas para tu usuario.
                    </p>
                  </div>
                </div>
              )}

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
                            disabled={!esPropietario}
                            className="px-4 py-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={!esPropietario ? 'Solo el propietario del pedido puede calificar' : undefined}
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
                        disabled={!esPropietario}
                        className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!esPropietario ? 'Solo el propietario del pedido puede reportar incidencias' : undefined}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> Reportar
                      </button>
                    </div>
                  )}

                  {/* Cancelación por el cliente (solo estados cancelables) */}
                  {ESTADOS_CANCELABLES.includes(order.estado) && (
                    <div className="flex items-center justify-between w-full sm:w-auto sm:gap-4 pt-4 sm:pt-0">
                      <div>
                        <p className="font-black text-[#2a1115] text-sm">¿Ya no lo necesitas?</p>
                        <p className="text-xs text-[#2a1115]/50">Cancelar pedido (reintegra stock)</p>
                      </div>
                      <button
                        onClick={() => {
                          setCancelMotivo('')
                          setCancelError(null)
                          setCancelModalOpen(true)
                        }}
                        disabled={!esPropietario}
                        className="px-4 py-2 bg-[#5c0f1b]/8 text-[#5c0f1b] hover:bg-[#5c0f1b]/15 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!esPropietario ? 'Solo el propietario del pedido puede cancelarlo' : undefined}
                      >
                        <Ban className="h-3.5 w-3.5" /> Cancelar pedido
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
                  <span>S/. {igvVal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-lg font-black text-[#5c0f1b] border-t border-[#5c0f1b]/10 pt-2 mt-2">
                  <span>Total</span>
                  <span>S/. {totalCalculado.toFixed(2)}</span>
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
                      Criptotrufas
                    </span>
                    <span className="text-[#ff7a45] font-black">+{order.puntos_ganados}</span>
                  </div>
                )}
              </div>

              {/* Comprobante electrónico (PDF generado en servidor) */}
              <div className="bg-white rounded-2xl border border-dashed border-[#5c0f1b]/15 p-5 space-y-3">
                <h3 className="font-black text-[#2a1115] text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-[#5c0f1b]" />
                  Comprobante Electrónico
                </h3>
                {order.documentos && order.documentos.length > 0 ? (
                  <div className="space-y-3">
                    {order.documentos.map((doc) => (
                      <div key={doc.id_documento} className="flex justify-between items-center text-sm font-semibold">
                        <span className="text-[#2a1115]/60">{doc.tipo_documento === 'BOLETA' ? 'Boleta' : doc.tipo_documento === 'FACTURA' ? 'Factura' : doc.tipo_documento}</span>
                        <span className="text-[#2a1115]">{doc.numero_serie || '—'}</span>
                      </div>
                    ))}
                    <button
                      onClick={handleDownloadComprobante}
                      disabled={downloadingComprobante}
                      className="w-full inline-flex items-center justify-center gap-2 bg-[#5c0f1b] hover:bg-[#7a1525] text-white text-sm font-bold py-2.5 rounded-xl transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {downloadingComprobante ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Descargar comprobante PDF
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-[#2a1115]/50 font-medium text-center py-2 italic">
                      Genera tu comprobante electrónico en formato PDF.
                    </p>
                    <button
                      onClick={handleDownloadComprobante}
                      disabled={downloadingComprobante}
                      className="w-full inline-flex items-center justify-center gap-2 bg-[#5c0f1b] hover:bg-[#7a1525] text-white text-sm font-bold py-2.5 rounded-xl transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {downloadingComprobante ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Generar comprobante PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>


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

      {/* Modal de cancelación (cliente) */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#5c0f1b]/10">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-black text-[#5c0f1b]">Cancelar pedido #{orderId}</h3>
              <button
                onClick={() => setCancelModalOpen(false)}
                disabled={transitionMut.isPending}
                className="cursor-pointer disabled:opacity-50"
              >
                <XCircle className="h-6 w-6 text-stone-400 hover:text-stone-600" />
              </button>
            </div>
            <p className="text-sm text-stone-600 mb-4">
              Indica el motivo de la cancelación. El stock de los productos será reintegrado
              automáticamente.
            </p>

            <label className="block text-xs font-black uppercase tracking-wide text-stone-500 mb-1">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={cancelMotivo}
              onChange={(e) => {
                setCancelMotivo(e.target.value)
                setCancelError(null)
              }}
              placeholder="Ej: Ya no necesito el pedido, me equivoqué..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] outline-none focus:border-[#5c0f1b] resize-none"
              disabled={transitionMut.isPending}
            />
            <p className="text-[10px] text-stone-400 mt-1 mb-3">{cancelMotivo.trim().length}/5 mínimo</p>

            {cancelError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{cancelError}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setCancelModalOpen(false)}
                disabled={transitionMut.isPending}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-sm hover:bg-stone-50 transition-all cursor-pointer disabled:opacity-50"
              >
                Cerrar
              </button>
              <button
                onClick={handleCancelarPedido}
                disabled={transitionMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-[#5c0f1b] text-white font-bold text-sm hover:bg-[#7a1525] transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {transitionMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" />
                    Confirmar cancelación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
