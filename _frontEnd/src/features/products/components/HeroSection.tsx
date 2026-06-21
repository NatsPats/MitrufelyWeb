/**
 * HeroSection.tsx — Sección Hero de la HomePage pública
 *
 * SRP: renderizar únicamente el bloque hero (texto + imagen de fondo).
 * Recibe un callback para hacer scroll al catálogo.
 *
 * UI REFACTOR (v2):
 *   - min-height: 100vh (pantalla completa)
 *   - Imagen de fondo: mármol con trufas (/image.png), alineada a la derecha
 *   - Texto alineado a la izquierda con gran espacio respirable
 *   - Subtítulo bicolor: gris-marrón oscuro + borgoña (NO rosa)
 *   - Tarjetas flotantes con animación suave (framer-motion)
 */


import { motion, type Variants } from 'framer-motion'
import { Button } from '@/shared/components/ui/Button'

// ─── Props ────────────────────────────────────────────────────────────────

interface HeroSectionProps {
  onCatalogClick: () => void
}

// ─── Datos estáticos ──────────────────────────────────────────────────────

const STATS = [
  { value: '+500', label: 'Clientes felices' },
  { value: '100%', label: 'Artesanal'        },
  { value: '4.9★', label: 'Calificación'     },
] as const

// ─── Variantes de animación ───────────────────────────────────────────────

/** Contenedor del texto: stagger 80 ms entre hijos */
const textContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
}

/** Cada hijo del stack de texto */
const textItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 100 } },
}



// ─── Componente ───────────────────────────────────────────────────────────

export function HeroSection({ onCatalogClick }: HeroSectionProps) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: '100vh' }}
    >
      {/* Imagen de fondo — mármol con trufas (alineada a la derecha) */}
      <div
        className="absolute inset-0 bg-[#5c0f1b]"
        style={{
          backgroundImage: 'url(/4.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center right',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Overlay izquierdo — menos intenso y rojizo (borgoña) */}
      <div
        className="absolute inset-0"
        style={{
          background:
          'linear-gradient(to right, rgba(255, 122, 69, 0.95) 10%, rgba(255, 122, 69, 0.65) 30%, rgba(255, 122, 69, 0.15) 65%, transparent 70%)',
        }}
      />

      {/* Contenido */}
      <div className="relative z-10 max-w-7xl mx-auto px-2 md:px-10 flex items-start pt-8 md:pt-[10vh]" style={{ minHeight: '100vh' }}>

        {/* ── Columna de texto (stagger) — máximo 50% del ancho ── */}
        <motion.div
          variants={textContainer}
          initial="hidden"
          animate="show"
          className="flex flex-col items-start text-left w-full max-w-[860px]"
        >
          {/* Etiqueta superior */}
          <motion.span
            variants={textItem}
            className="inline-flex items-center gap-1.5 mb-6 text-[15px] font-black uppercase tracking-[0.2em] text-white/90  border-white/20 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-sm"
          >
            🍫 La Trufería de Élite
          </motion.span>

          {/* Titular principal — blanco, grande, negrita */}
          <motion.h1
            variants={textItem}
            className="font-black text-[var(--color-primary)] leading-[1.04] mb-6"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(2.6rem, 5.5vw, 4.2rem)' }}
          >
            El antojo perfecto<br />
            <span className="text-[var(--color-primary)]">que te recompensa.</span>
          </motion.h1>

          {/* Subtítulo — blanco */}
          <motion.p
            variants={textItem}
            className="text-base md:text-lg font-light mb-9 leading-[1.75] max-w-[460px]"
          >
            <span className="text-[#ffffff] font-normal">
              Gana puntos{' '}
              <strong className="text-[#892700] font-black">CriptoTrufas</strong>
              {' '}por cada compra.{' '}
            </span>
            <span className="text-white font-semibold">
              Canjéalos por descuentos y más trufas.
            </span>
          </motion.p>

          {/* Stats */}
          <motion.div variants={textItem} className="flex items-center gap-8 md:gap-10 mb-10">
            {STATS.map(({ value, label }, i) => (
              <div key={label} className="text-center">
                {i > 0 && <div className="hidden" />}
                <p
                  className="text-2xl font-black text-white leading-none"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {value}
                </p>
                <p className="text-[11px] text-white/60 font-semibold mt-0.5 uppercase tracking-wider">
                  {label}
                </p>
              </div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div variants={textItem} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              id="hp-hero-cta"
              variant="primary"
              onClick={onCatalogClick}
              className="px-10 py-4 text-base shadow-[0_8px_24px_rgba(92,15,27,0.22)]"
            >
              Ver Catálogo
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Tarjeta flotante: precio (esquina inferior izquierda) */}
      

      {/* Tarjeta flotante: puntos (esquina superior derecha del área visible) */}
      
    </section>
  )
}
