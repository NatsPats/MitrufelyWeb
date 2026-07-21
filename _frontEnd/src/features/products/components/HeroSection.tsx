/**
 * HeroSection.tsx — Sección Hero de la HomePage pública
 *
 * SRP: renderizar únicamente el bloque hero (texto + imagen de fondo).
 * Recibe un callback para hacer scroll al catálogo.
 *
 * OPTIMIZACIÓN (v3):
 *   - Imagen de fondo: /4.webp (62KB vs 2.4MB PNG), preload en index.html
 *   - Animaciones con CSS + framer-motion para contadores y zoom cinematográfico
 */

import { Button } from '@/shared/components/ui/Button'
import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion'

// ─── Props ────────────────────────────────────────────────────────────────

interface HeroSectionProps {
  onCatalogClick: () => void
  onCriptotrufasClick: () => void
}

// ─── Datos estáticos ──────────────────────────────────────────────────────

const STATS = [
  { numericValue: 500, format: (n: number) => `+${Math.round(n)}`, label: 'Clientes felices' },
  { numericValue: 100, format: (n: number) => `${Math.round(n)}%`, label: 'Artesanal' },
  { numericValue: 4.9, format: (n: number) => `${n.toFixed(1)}★`, label: 'Calificación' },
] as const

function AnimatedCounter({ target, format }: { target: number; format: (n: number) => string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const count = useMotionValue(0)
  const display = useTransform(count, (latest) => format(latest))

  useEffect(() => {
    if (inView) {
      animate(count, target, { duration: 2.5, ease: 'easeOut' })
    }
  }, [inView, target, count])

  return <motion.span ref={ref}>{display}</motion.span>
}

// ─── Componente ───────────────────────────────────────────────────────────

export function HeroSection({ onCatalogClick, onCriptotrufasClick }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden -mt-15" style={{ minHeight: '100vh' }}>
      {/* Imagen de fondo — mármol con trufas (alineada a la derecha) */}
      {/* Usamos motion.img para el zoom lento cinematográfico */}
      <motion.img
        src="/hero.jpeg"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
        width={1600}
        height={716}
        className="absolute inset-0 h-full w-full object-cover object-right bg-[#5c0f1b]"
        initial={{ scale: 1.15 }}
        animate={{ scale: 1 }}
        transition={{ duration: 20, ease: 'easeOut' }}
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
      <div
        className="relative z-10 max-w-7xl mx-auto px-2 md:px-10 flex items-start pt-28 md:pt-[18vh]"
        style={{ minHeight: '100vh' }}
      >
        {/* ── Columna de texto (animación CSS stagger) — máximo 50% del ancho ── */}
        <div className="flex flex-col items-start text-left w-full max-w-[860px] hero-stagger">
          {/* Titular principal — blanco, grande, negrita */}
          <h1
            className="hero-item font-black text-[var(--color-primary)] leading-[1.04] mb-6"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(2.9rem, 5.5vw, 4.2rem)' }}
          >
            El antojo perfecto
            <br />
            <span className="text-[var(--color-primary)]">que te recompensa.</span>
          </h1>

          {/* Subtítulo — blanco */}
          <p className="hero-item text-base md:text-lg font-light mb-9 leading-[1.75] max-w-[460px]">
            <span className="text-[#ffffff] font-normal">
              Gana puntos{' '}
              <button
                type="button"
                onClick={onCriptotrufasClick}
                className="text-[#892700] hover:text-[#ff7a45] hover:underline font-black bg-transparent border-none p-0 inline cursor-pointer align-baseline select-none"
                style={{ fontSize: 'inherit', fontFamily: 'inherit' }}
              >
                CriptoTrufas
              </button>{' '}
              por cada compra.{' '}
            </span>
            <span className="text-white font-semibold">Canjéalos por descuentos y más trufas.</span>
          </p>

          {/* Stats */}
          <div className="hero-item flex items-center gap-8 md:gap-10 mb-10">
            {STATS.map(({ numericValue, format, label }) => (
              <div key={label} className="text-center">
                <p
                  className="text-2xl font-black text-white leading-none"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  <AnimatedCounter target={numericValue} format={format} />
                </p>
                <p className="text-[11px] text-white/60 font-semibold mt-0.5 uppercase tracking-wider">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="hero-item">
            <Button
              id="hp-hero-cta"
              variant="primary"
              onClick={onCatalogClick}
              className="px-10 py-4 text-base shadow-[0_8px_24px_rgba(92,15,27,0.22)] transition-transform hover:scale-105 active:scale-95"
            >
              Ver Catálogo
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
