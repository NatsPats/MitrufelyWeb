import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, MessageSquare, User, Search, Filter, Loader2, X, Package } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAdminReviewsQuery, useReviewMetricsQuery } from '../hooks/useAdminReviews'
import type { AdminReviewResponse } from '../api/reviews.api'

export default function AdminReviewsPage() {
  const { data: metrics, isLoading: loadingMetrics } = useReviewMetricsQuery()
  const { data: reviews = [], isLoading: loadingReviews } = useAdminReviewsQuery(100, 0)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRating, setSelectedRating] = useState<number | 'ALL'>('ALL')
  const [selectedReview, setSelectedReview] = useState<AdminReviewResponse | null>(null)

  const filteredReviews = reviews.filter((r) => {
    const matchesSearch =
      r.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id_venta.toString().includes(searchTerm) ||
      (r.comment && r.comment.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesRating = selectedRating === 'ALL' || r.rating === selectedRating
    return matchesSearch && matchesRating
  })

  // Render Stars
  const renderStars = (rating: number, size = 'h-4 w-4') => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${size} ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'fill-stone-200 text-stone-200'
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-[#5c0f1b] tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Reviews de Clientes
        </h1>
        <p className="text-stone-500 font-medium mt-1">Supervisa y analiza las calificaciones de los pedidos entregados.</p>
      </div>

      {/* MÉTRICAS (FASE 3) */}
      {loadingMetrics ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#5c0f1b]" /></div>
      ) : metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tarjeta Promedio */}
          <div className="bg-white rounded-3xl p-6 border border-[#5c0f1b]/10 shadow-sm flex items-center gap-6">
            <div className="h-16 w-16 bg-yellow-100 rounded-full flex items-center justify-center shrink-0">
              <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-stone-500 font-bold uppercase tracking-wider">Promedio Global</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-[#5c0f1b]">{metrics.promedio_calificacion}</span>
                <span className="text-stone-400 font-medium mb-1">/ 5</span>
              </div>
            </div>
          </div>

          {/* Tarjeta Totales */}
          <div className="bg-white rounded-3xl p-6 border border-[#5c0f1b]/10 shadow-sm flex items-center gap-6">
            <div className="h-16 w-16 bg-stone-100 rounded-full flex items-center justify-center shrink-0">
              <MessageSquare className="h-8 w-8 text-stone-500" />
            </div>
            <div>
              <p className="text-sm text-stone-500 font-bold uppercase tracking-wider">Total Reviews</p>
              <span className="text-4xl font-black text-[#5c0f1b]">{metrics.total_reviews}</span>
            </div>
          </div>

          {/* Distribución */}
          <div className="bg-white rounded-3xl p-6 border border-[#5c0f1b]/10 shadow-sm">
            <p className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-3">Distribución</p>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = metrics.distribucion_estrellas[stars] || 0
                const percentage = metrics.total_reviews > 0 ? (count / metrics.total_reviews) * 100 : 0
                return (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-600 w-3">{stars}</span>
                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-stone-500 w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-stone-100">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, ID o comentario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border-none rounded-xl focus:ring-2 focus:ring-[#5c0f1b]/20 font-medium"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="h-5 w-5 text-stone-400" />
          <select
            value={selectedRating}
            onChange={(e) => setSelectedRating(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            className="bg-stone-50 border-none rounded-xl px-4 py-2.5 font-medium text-stone-700 focus:ring-2 focus:ring-[#5c0f1b]/20 outline-none w-full sm:w-auto"
          >
            <option value="ALL">Todas las estrellas</option>
            <option value="5">5 Estrellas</option>
            <option value="4">4 Estrellas</option>
            <option value="3">3 Estrellas</option>
            <option value="2">2 Estrellas</option>
            <option value="1">1 Estrella</option>
          </select>
        </div>
      </div>

      {/* TABLA DE REVIEWS (FASE 2) */}
      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/50 border-b border-stone-200">
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Pedido</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Calificación</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider hidden md:table-cell">Comentario</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loadingReviews ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-stone-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Cargando reviews...
                  </td>
                </tr>
              ) : filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-stone-500 font-medium">
                    No se encontraron calificaciones.
                  </td>
                </tr>
              ) : (
                filteredReviews.map((review) => (
                  <tr
                    key={review.id_review}
                    onClick={() => setSelectedReview(review)}
                    className="border-b border-stone-100 hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <span className="font-black text-[#5c0f1b]">#{review.id_venta}</span>
                      <div className="text-xs text-stone-500 mt-1">{review.estado_pedido}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-stone-700">
                      {review.cliente_nombre}
                    </td>
                    <td className="px-6 py-4">
                      {renderStars(review.rating)}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell max-w-xs">
                      <p className="text-sm text-stone-600 truncate">
                        {review.comment || <span className="text-stone-400 italic">Sin comentario</span>}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-500 font-medium">
                      {format(new Date(review.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALLE DE REVIEW (FASE 4) */}
      <AnimatePresence>
        {selectedReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 bg-stone-50/50">
                <h2 className="font-black text-[#5c0f1b] text-xl flex items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                  Detalle de Calificación
                </h2>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="p-2 hover:bg-stone-200 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-stone-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between bg-stone-50 p-4 rounded-2xl">
                  <div>
                    <p className="text-xs text-stone-500 font-bold uppercase mb-1">Calificación Otorgada</p>
                    {renderStars(selectedReview.rating, 'h-6 w-6')}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-stone-500 font-bold uppercase mb-1">Fecha</p>
                    <p className="text-sm font-bold text-stone-700">
                      {format(new Date(selectedReview.created_at), "dd MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-stone-500 font-bold uppercase mb-2">Comentario del Cliente</p>
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedReview.comment ? (
                        `"${selectedReview.comment}"`
                      ) : (
                        <span className="text-stone-400 italic">El cliente no dejó un comentario escrito.</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-stone-500 font-bold uppercase flex items-center gap-1">
                      <User className="h-3 w-3" /> Cliente
                    </p>
                    <p className="font-bold text-stone-800">{selectedReview.cliente_nombre}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-stone-500 font-bold uppercase flex items-center gap-1">
                      <Package className="h-3 w-3" /> Pedido
                    </p>
                    <p className="font-bold text-stone-800">
                      #{selectedReview.id_venta}
                      <span className="ml-2 text-xs font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {selectedReview.estado_pedido}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-100">
                  <button
                    onClick={() => setSelectedReview(null)}
                    className="w-full py-3 rounded-full bg-stone-100 text-stone-700 font-bold hover:bg-stone-200 transition-colors"
                  >
                    Cerrar Detalle
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
