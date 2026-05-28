/**
 * TrufaCard.tsx — Componente de dominio: Tarjeta de producto (trufa)
 *
 * Responsabilidad única (SRP): renderizar una trufa individual en el grid.
 * No maneja estado global — recibe todo via props (DIP / inversión de dependencias).
 */
import { motion } from 'framer-motion'
import type { Trufa } from '../types'

// ─── Props ────────────────────────────────────────────────────────────────

interface TrufaCardProps {
  trufa: Trufa
  onSelect: (trufa: Trufa) => void
}

// ─── Componente ───────────────────────────────────────────────────────────

export function TrufaCard({ trufa, onSelect }: TrufaCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-[28px] p-4 flex flex-col shadow-[0_2px_12px_rgba(42,17,21,0.1),0_1px_3px_rgba(42,17,21,0.06)] hover:shadow-[0_8px_28px_rgba(92,15,27,0.12),0_3px_8px_rgba(92,15,27,0.06)] hover:-translate-y-1 transition-all duration-250 group"
    >
      {/* Imagen */}
      <div className="relative rounded-[20px] overflow-hidden mb-4 aspect-square bg-[#f0ede8]">
        <img
          src={trufa.imagenUrl}
          alt={trufa.nombre}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Badge opcional */}
        {trufa.badge && (
          <div className="absolute top-3 left-3 bg-[#5c0f1b] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm">
            {trufa.badge}
          </div>
        )}
      </div>

      {/* Detalles */}
      <div className="px-2 pb-2">
        {/* Nombre + Precio en la misma línea */}
        <div className="flex justify-between items-center mb-3 gap-2">
          <h4 className="font-display text-[#2a1115] text-lg font-black line-clamp-1 group-hover:text-[#5c0f1b] transition-colors">
            {trufa.nombre}
          </h4>
          {/* shrink-0 evita que el precio se aplaste si el nombre es largo */}
          <p className="text-xl font-black text-[#5c0f1b] shrink-0">
            S/{trufa.precio}
          </p>
        </div>

        <button
          onClick={() => onSelect(trufa)}
          className="w-full inline-flex items-center justify-center bg-[#5c0f1b] text-white font-black rounded-full py-2.5 text-sm hover:bg-[#7a1525] transition-all active:scale-95 cursor-pointer border-none"
        >
          Ver más
        </button>
      </div>
    </motion.div>
  )
}
