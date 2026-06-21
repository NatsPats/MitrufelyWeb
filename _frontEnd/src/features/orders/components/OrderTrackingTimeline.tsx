import { motion } from 'framer-motion'
import { CheckCircle, Clock, Package, Truck, XCircle, Undo2, RotateCcw } from 'lucide-react'
import type { OrderEventResponse, EstadoVenta } from '../types'

interface TimelineProps {
  events: OrderEventResponse[]
  currentState: EstadoVenta
  pct: number
}

function getIconForEventType(type: string) {
  switch (type) {
    case 'ORDER_CREATED': return <Package className="h-4 w-4" />
    case 'PAYMENT_CONFIRMED': return <CheckCircle className="h-4 w-4" />
    case 'PREPARATION_STARTED': return <Clock className="h-4 w-4" />
    case 'DELIVERY_DISPATCHED': return <Truck className="h-4 w-4" />
    case 'DELIVERY_COMPLETED': return <CheckCircle className="h-4 w-4 text-emerald-500" />
    case 'ORDER_CANCELLED': return <XCircle className="h-4 w-4 text-red-500" />
    case 'ORDER_RETURNED': return <Undo2 className="h-4 w-4 text-rose-500" />
    case 'REFUND_PROCESSED': return <RotateCcw className="h-4 w-4 text-purple-500" />
    default: return <Clock className="h-4 w-4" />
  }
}

export function OrderTrackingTimeline({ events, currentState, pct }: TimelineProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#5c0f1b]/8 p-5 sm:p-8 shadow-[0_4px_20px_rgba(42,17,21,0.04)] relative overflow-hidden">
      {/* Background Decorator */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff7a45]/5 rounded-bl-[100px] pointer-events-none -z-10" />

      <h3 className="font-black text-[#2a1115] text-lg mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>
        Línea de Tiempo del Pedido
      </h3>

      {/* Barra de Progreso General */}
      <div className="mb-10">
        <div className="flex justify-between mb-2">
          <span className="text-xs font-bold text-[#2a1115]/50 uppercase tracking-wider">Progreso</span>
          <span className="text-xs font-black text-[#5c0f1b]">{pct}%</span>
        </div>
        <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full ${
              currentState === 'CANCELADO' || currentState === 'DEVUELTO' || currentState === 'ANULADO'
                ? 'bg-red-500'
                : currentState === 'REEMBOLSADO'
                ? 'bg-purple-500'
                : 'bg-emerald-500'
            }`}
          />
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-[#2a1115]/40 italic py-4 text-center">
          No hay eventos registrados aún.
        </p>
      ) : (
        <div className="relative pl-3 sm:pl-4 space-y-8 before:absolute before:inset-0 before:ml-[1.4rem] sm:before:ml-[1.6rem] before:w-[2px] before:-translate-x-px before:bg-stone-100">
          {events.map((evt, idx) => (
            <motion.div
              key={evt.id_event}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="relative flex items-start gap-4 sm:gap-6"
            >
              {/* Timeline dot */}
              <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white border-2 border-[#5c0f1b]/10 text-[#5c0f1b] shadow-sm shrink-0">
                {getIconForEventType(evt.event_type)}
              </div>

              {/* Content */}
              <div className="flex-1 pb-1">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
                  <p className="text-sm font-black text-[#2a1115] leading-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {evt.description}
                  </p>
                  <time className="text-[10px] font-bold text-[#2a1115]/40 uppercase tracking-wider whitespace-nowrap">
                    {new Date(evt.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {new Date(evt.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
                  </time>
                </div>
                
                {/* Opcional: mostrar un detalle extra si es reembolso u observación */}
                {evt.detail_json && (evt.detail_json as any)['motivo'] && (
                  <p className="mt-1.5 text-xs text-stone-500 bg-stone-50 p-2 rounded-lg border border-stone-100">
                    <span className="font-bold">Motivo:</span> {(evt.detail_json as any)['motivo']}
                  </p>
                )}
                {evt.detail_json && (evt.detail_json as any)['refund_amount'] && (
                  <p className="mt-1 text-xs font-black text-rose-600 bg-rose-50 p-2 rounded-lg inline-block">
                    Reembolso: S/. {Number((evt.detail_json as any)['refund_amount']).toFixed(2)}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
