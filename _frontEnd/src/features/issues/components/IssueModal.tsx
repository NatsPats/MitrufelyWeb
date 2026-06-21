import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { issuesApi } from '../api/issues.api'

interface IssueModalProps {
  isOpen: boolean
  onClose: () => void
  id_venta: number
  onSuccess?: () => void
}

export function IssueModal({ isOpen, onClose, id_venta, onSuccess }: IssueModalProps) {
  const [issueType, setIssueType] = useState('PEDIDO_DANADO')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (description.length < 10) {
      toast.error('Por favor brinda una descripción más detallada (mín. 10 caracteres).')
      return
    }
    
    setIsSubmitting(true)
    try {
      await issuesApi.crearIncidencia(id_venta, { issue_type: issueType, description })
      toast.success('Incidencia reportada correctamente. Te contactaremos pronto.')
      onSuccess?.()
      onClose()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Error al reportar la incidencia.')
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#5c0f1b]/10 bg-red-50/50">
              <h2 className="font-black text-red-900 text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" /> Reportar Problema
              </h2>
              <button onClick={onClose} className="text-red-900/40 hover:text-red-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="px-6 pt-4">
              <p className="text-sm text-stone-600 font-medium">
                Lamentamos que hayas tenido inconvenientes con tu pedido #{id_venta}. Cuéntanos qué pasó para poder ayudarte.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#2a1115]/70 uppercase">Motivo principal</label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/40 bg-white"
                >
                  <option value="PEDIDO_DANADO">Llegó dañado o en mal estado</option>
                  <option value="PEDIDO_INCOMPLETO">Pedido incompleto o producto incorrecto</option>
                  <option value="ERROR_ENTREGA">Hubo un error en la entrega (retraso, dirección, etc.)</option>
                  <option value="PEDIDO_PERDIDO">El pedido nunca llegó o se perdió</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#2a1115]/70 uppercase">Detalles</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/40 min-h-[120px] resize-none"
                  placeholder="Por favor, describe exactamente cuál fue el problema..."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-red-600 text-white font-black text-sm hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Enviando...' : 'Enviar Reporte'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
