/**
 * PacksSection.tsx — Sección de packs de regalo de la HomePage
 *
 * SRP: renderizar el grid de PackCards con flechas decorativas.
 * Sin estado propio — todos los packs vienen de mockData.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PackCard } from './PackCard'
import { PACKS_MOCK } from '../api/mockData'

// ─── Props ────────────────────────────────────────────────────────────────

interface PacksSectionProps {
  /** Callback opcional al agregar un pack (ej. incrementar cartCount en la página) */
  onPackAdded?: () => void
}

// ─── Componente ───────────────────────────────────────────────────────────

export function PacksSection({ onPackAdded }: PacksSectionProps) {
  return (
    <section
      id="puntos"
      className="bg-gradient-to-b from-[#f7f3ee] to-[#f2ece3] py-20 px-4 scroll-mt-20"
    >
      <div className="max-w-7xl mx-auto">

        {/* Encabezado */}
        <div className="text-center mb-14">
          <span className="inline-block bg-[#5c0f1b]/8 text-[#5c0f1b] text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full mb-3">
            Packs Especiales
          </span>
          <h3
            className="font-black text-[#2a1115] mb-3"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}
          >
            Packs para compartir{' '}
            <span className="text-[#5c0f1b]">(o para ti solo)</span>
          </h3>
          <p className="text-[#2a1115]/55 max-w-md mx-auto text-sm font-medium">
            Nuestras cajas surtidas más exclusivas, diseñadas para regalar, estudiar o disfrutar.
          </p>
        </div>

        {/* Grid con flechas decorativas */}
        <div className="relative max-w-6xl mx-auto">

          {/* Flecha izquierda — decorativa en pantallas grandes */}
          <button
            aria-label="Pack anterior"
            className="hidden lg:flex absolute -left-12 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-[#ff7a45] text-white items-center justify-center shadow-lg hover:bg-[#e86a35] transition-all hover:scale-105 active:scale-95"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          {/* Grid: 1 col móvil / 2 tablet / 3 desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {PACKS_MOCK.map((pack) => (
              <PackCard key={pack.id} pack={pack} onAddToCart={onPackAdded} />
            ))}
          </div>

          {/* Flecha derecha — decorativa en pantallas grandes */}
          <button
            aria-label="Siguiente pack"
            className="hidden lg:flex absolute -right-12 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-[#ff7a45] text-white items-center justify-center shadow-lg hover:bg-[#e86a35] transition-all hover:scale-105 active:scale-95"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

        </div>
      </div>
    </section>
  )
}
