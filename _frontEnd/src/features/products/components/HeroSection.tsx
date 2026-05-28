/**
 * HeroSection.tsx — Sección Hero de la HomePage pública
 *
 * SRP: renderizar únicamente el bloque hero (texto + estadísticas + imagen flotante).
 * Recibe un callback para hacer scroll al catálogo.
 */
import { Star } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/shared/components/ui/Button'

// ─── Props ────────────────────────────────────────────────────────────────

interface HeroSectionProps {
  onCatalogClick: () => void
}

// ─── Datos estáticos de la sección ────────────────────────────────────────

const STATS = [
  { value: '+500', label: 'Clientes felices' },
  { value: '100%', label: 'Artesanal' },
  { value: '4.9★', label: 'Calificación' },
] as const

// ─── Componente ───────────────────────────────────────────────────────────

export function HeroSection({ onCatalogClick }: HeroSectionProps) {
  return (
    <section className="bg-gradient-to-br from-[#faf8f5] via-[#f5f0e8] to-[#f0e8d8] relative overflow-hidden py-16 md:py-24 px-4">
      {/* Destellos decorativos de fondo */}
      <div className="pointer-events-none absolute top-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(255,122,69,0.08)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(92,15,27,0.06)_0%,transparent_70%)]" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 items-center gap-10 lg:gap-16 relative z-10">

        {/* ── Texto ── */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-start text-left"
        >
          <h2
            className="font-black text-[#2a1115] leading-[1.05] mb-6"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(2.25rem, 5vw, 3.75rem)' }}
          >
            El antojo perfecto<br />
            <span className="text-[#5c0f1b]">que te recompensa</span>
          </h2>

          <p className="text-base md:text-lg text-[#2a1115]/75 font-medium mb-8 leading-relaxed max-w-lg">
            Gana puntos{' '}
            <strong className="text-[#ff7a45] font-black">CriptoTrufas</strong> por cada compra.{' '}
            <span className="text-[#5c0f1b] font-bold">
              Canjéalos por descuentos exclusivos y más trufas.
            </span>
          </p>

          {/* Estadísticas */}
          <div className="flex items-center gap-6 mb-8">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p
                  className="text-xl font-black text-[#5c0f1b]"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {value}
                </p>
                <p className="text-xs text-[#2a1115]/50 font-semibold">{label}</p>
              </div>
            ))}
          </div>

          <Button id="hp-hero-cta" variant="primary" onClick={onCatalogClick} className="px-10 py-4 text-base">
            Ver Catálogo
          </Button>
        </motion.div>

        {/* ── Imagen ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          className="relative flex justify-center lg:justify-end"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,122,69,0.15)_0%,transparent_70%)]" />

          <div className="relative z-10 w-full max-w-lg">
            <div className="rounded-[40px] overflow-hidden shadow-[0_20px_60px_rgba(92,15,27,0.18),0_8px_24px_rgba(92,15,27,0.1)]">
              <img
                src="/hero_truffles.png"
                alt="Trufas Artesanales Premium Mitrufely"
                className="w-full h-[320px] md:h-[400px] object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&q=80&w=800'
                }}
              />
            </div>

            {/* Tarjeta flotante: precio */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="absolute -bottom-4 -left-4 md:-left-8 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-xl bg-[#5c0f1b] flex items-center justify-center text-lg">
                🍫
              </div>
              <div>
                <p className="text-xs text-[#2a1115]/50 font-semibold">Desde</p>
                <p
                  className="text-lg font-black text-[#5c0f1b]"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  S/. 2.20
                </p>
              </div>
            </motion.div>

            {/* Tarjeta flotante: puntos */}
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: 0.5 }}
              className="absolute -top-4 -right-4 md:-right-6 bg-[#ff7a45] rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2"
            >
              <Star className="h-5 w-5 fill-white text-white" />
              <div>
                <p className="text-xs text-white/75 font-semibold">Ganas</p>
                <p className="text-base font-black text-white">+250 pts</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
