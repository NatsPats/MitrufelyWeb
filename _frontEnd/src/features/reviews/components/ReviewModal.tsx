import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Star, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { reviewsApi } from '../api/reviews.api'

interface ReviewModalProps {
  isOpen: boolean
  onClose: () => void
  id_venta: number
  onSuccess?: () => void
}

export function ReviewModal({ isOpen, onClose, id_venta, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(5)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await reviewsApi.crearReview(id_venta, { rating, comment })
      toast.success('¡Gracias por tu calificación! 🌟')
      onSuccess?.()
      onClose()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Error al enviar calificación.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#5c0f1b]/10">
              <h2 className="font-black text-[#2a1115] text-lg">Calificar Pedido #{id_venta}</h2>
              <button onClick={onClose} className="text-[#2a1115]/40 hover:text-red-500 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-bold text-[#2a1115]/60 uppercase">¿Qué te pareció?</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        className={`h-10 w-10 ${
                          star <= (hoveredRating || rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-stone-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#2a1115]/70 uppercase">Comentario (Opcional)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7a45]/40 min-h-[100px] resize-none"
                  placeholder="¡Las trufas estaban deliciosas!..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Enviando...' : 'Enviar calificación'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
