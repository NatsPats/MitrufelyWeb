/**
 * PackCard.tsx — Componente de dominio: Tarjeta de pack de regalo
 *
 * SRP: renderizar un pack y encapsular su propio estado de "agregado".
 * El feedback visual (toast) vive aquí porque es UI local del componente.
 */
import { useState } from 'react'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import type { Pack } from '../types'

// ─── Props ────────────────────────────────────────────────────────────────

interface PackCardProps {
  pack: Pack
  /** Callback opcional para notificar al padre (ej. incrementar cartCount) */
  onAddToCart?: (packId: number) => void
}

// ─── Componente ───────────────────────────────────────────────────────────

export function PackCard({ pack, onAddToCart }: PackCardProps) {
  const [added, setAdded] = useState(false)

  const handleAdd = () => {
    setAdded(true)
    toast.success(`Pack "${pack.nombre}" agregado al carrito 🛍️`)
    onAddToCart?.(pack.id)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="relative w-full max-w-[300px] h-[400px] overflow-hidden rounded-[24px] shadow-lg group mx-auto">
      {/* ── Imagen de Fondo ── */}
      <img
        src={pack.imagenUrl}
        alt={pack.nombre}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        onError={(e) => {
          ;(e.target as HTMLImageElement).src =
            'https://images.unsplash.com/photo-1513534894444-24c9190c3741?auto=format&fit=crop&q=80&w=600'
        }}
      />

      {/* ── Contenedor de Texto (Efecto Glassmorphism) ── */}
      <div className="absolute bottom-0 left-0 w-full bg-white/40 backdrop-blur-md px-5 py-5 flex flex-col justify-end  border-white/30">
        
        {/* Título */}
        <h4 className="font-display text-[#2a1115] text-xl font-black mb-0.5 line-clamp-1 leading-tight">
          {pack.nombre}
        </h4>

        {/* Precio y Puntos */}
        <div className="flex items-center gap-1 text-[13px] font-bold text-[#2a1115] mb-2.5">
          <span>(S/. {pack.precio.toFixed(2)} | +{pack.puntos.toLocaleString()}</span>
          <Star className="h-3.5 w-3.5 fill-[#ff7a45] text-[#ff7a45] -mt-0.5" />
          <span>)</span>
        </div>

        {/* Descripción */}
        <p className="text-xs text-[#5c0f1b] font-semibold leading-relaxed mb-4 line-clamp-3">
          {pack.descripcion}
        </p>

        {/* Botón */}
        <button
          onClick={handleAdd}
          disabled={added}
          className={`w-full py-2.5 rounded-full text-white font-bold text-sm transition-all shadow-md ${
            added 
              ? 'bg-[#7a1525] opacity-90 scale-95' 
              : 'bg-[#5c0f1b] hover:bg-[#7a1525] hover:-translate-y-0.5'
          }`}
        >
          {added ? '✓ Agregado' : 'Ver mas'}
        </button>
      </div>
    </div>
  )
}