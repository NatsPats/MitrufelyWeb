/**
 * PacksSection.tsx — Sección de packs de regalo de la HomePage
 *
 * Carrusel interactivo de PackCards con navegación por flechas, puntos (móvil/escritorio) y swipe.
 * Muestra 1, 2 o 3 packs dependiendo del ancho de pantalla.
 */
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PackCard } from './PackCard'
import { usePackages } from '../hooks/usePackages'
import type { Pack } from '../types'

export function PacksSection() {
  const { data: packs, isLoading, isError } = usePackages()
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState(1) // 1 = derecha, -1 = izquierda
  const [itemsToShow, setItemsToShow] = useState(3)

  // Ajustar la cantidad de items visibles según el tamaño de la pantalla
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setItemsToShow(1)
      } else if (window.innerWidth < 1024) {
        setItemsToShow(2)
      } else {
        setItemsToShow(3)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const totalPacks = packs?.length || 0
  const isInfinite = totalPacks > itemsToShow

  const goLeft = useCallback(() => {
    if (totalPacks <= 1) return
    setDirection(-1)
    setActiveIndex((prev) => (prev - 1 + totalPacks) % totalPacks)
  }, [totalPacks])

  const goRight = useCallback(() => {
    if (totalPacks <= 1) return
    setDirection(1)
    setActiveIndex((prev) => (prev + 1) % totalPacks)
  }, [totalPacks])

  // Calcular los packs a mostrar
  const visiblePacks: Pack[] = []
  if (totalPacks > 0) {
    if (isInfinite) {
      for (let i = 0; i < itemsToShow; i++) {
        const pack = packs![((activeIndex + i) % totalPacks + totalPacks) % totalPacks]
        if (pack) visiblePacks.push(pack)
      }
    } else {
      visiblePacks.push(...(packs || []))
    }
  }

  // Anchura fija para evitar que flex modifique los tamaños durante la animación
  const getItemWidth = () => {
    if (itemsToShow === 1) return '100%'
    if (itemsToShow === 2) return 'calc(50% - 16px)' // md:gap-8 (32px) / 2
    return 'calc(33.333% - 21.33px)' // md:gap-8 (32px) * 2 / 3
  }

  return (
    <section id="puntos" className="bg-white py-16 md:py-24 px-4 scroll-mt-20 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10 md:mb-14"
        >
          <span className="inline-block bg-[#5c0f1b]/8 text-[#5c0f1b] text-[10px] font-black uppercase tracking-[0.18em] px-4 py-1.5 rounded-full mb-4 border-[#5c0f1b]/10">
            Packs Especiales
          </span>
          <h3
            className="font-black text-[#2a1115] mb-3"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Packs para compartir{' '}
            <span className="text-[#5c0f1b]">(o para ti solo)</span>
          </h3>
          <p className="text-[#2a1115]/60 max-w-md mx-auto text-base font-light leading-relaxed">
            Nuestras cajas surtidas más exclusivas, diseñadas para regalar, estudiar o disfrutar.
          </p>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className="mx-auto mt-5 h-[2px] w-14 rounded-full bg-gradient-to-r from-[#5c0f1b] to-[#ff7a45] origin-center"
          />
        </motion.div>

        <div className="relative max-w-6xl mx-auto">
          {/* Flecha Izquierda Flotante (Escritorio) */}
          {isInfinite && (
            <button
              aria-label="Pack anterior"
              onClick={goLeft}
              className="hidden lg:flex absolute -left-12 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-[#ff7a45] text-white items-center justify-center shadow-lg hover:bg-[#e86a35] transition-all hover:scale-105 active:scale-95 cursor-pointer border-none"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Estado de Carga / Error */}
          {isLoading && (
            <div className="flex justify-center items-center min-h-[350px]">
              <span className="text-[#5c0f1b] font-bold">Cargando paquetes especiales...</span>
            </div>
          )}
          {isError && (
            <div className="flex justify-center items-center min-h-[350px]">
              <span className="text-red-600 font-bold">Ocurrió un error al cargar los paquetes.</span>
            </div>
          )}
          {!isLoading && !isError && visiblePacks.length === 0 && (
            <div className="flex justify-center items-center min-h-[350px]">
              <span className="text-gray-500 font-medium">Por el momento no hay paquetes disponibles.</span>
            </div>
          )}

          {/* Carrusel Swipeable */}
          {!isLoading && !isError && visiblePacks.length > 0 && (
            <div className="overflow-hidden py-2 touch-pan-y">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={activeIndex}
                  custom={direction}
                  initial={{ opacity: 0, x: direction > 0 ? 50 : -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction > 0 ? -50 : 50 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="flex gap-6 md:gap-8 min-h-[380px] cursor-grab active:cursor-grabbing items-stretch justify-center md:justify-start"
                  onPanEnd={(_e, info) => {
                    if (totalPacks <= 1) return
                    const swipeThreshold = 40
                    if (info.offset.x < -swipeThreshold) goRight()
                    else if (info.offset.x > swipeThreshold) goLeft()
                  }}
                >
                  {visiblePacks.map((pack) => (
                    <div
                      key={pack.id_paquete}
                      className="shrink-0 flex justify-center"
                      style={{ width: getItemWidth() }}
                    >
                      <div className="w-full max-w-[400px] h-full">
                        <PackCard pack={pack} />
                      </div>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Flecha Derecha Flotante (Escritorio) */}
          {isInfinite && (
            <button
              aria-label="Siguiente pack"
              onClick={goRight}
              className=" hidden lg:flex absolute -right-12 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-[#ff7a45] text-white items-center justify-center shadow-lg hover:bg-[#e86a35] transition-all hover:scale-105 active:scale-95 cursor-pointer border-none"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Controles de Navegación y Puntos (Móvil y Tablet) */}
          {!isLoading && !isError && totalPacks > 1 && (
            <div className=" lg:hidden flex items-center justify-center gap-4 mt-6">
              <button
                aria-label="Pack anterior"
                onClick={goLeft}
                className="h-10 w-10 rounded-full bg-[#ff7a45] text-white flex items-center justify-center shadow-md hover:bg-[#e86a35] active:scale-95 transition-all cursor-pointer border-none"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* Dots de Paginación */}
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPacks }).map((_, idx) => (
                  <button
                    key={idx}
                    aria-label={`Ir al pack ${idx + 1}`}
                    onClick={() => {
                      setDirection(idx > activeIndex ? 1 : -1)
                      setActiveIndex(idx)
                    }}
                    className={`h-2.5 rounded-full transition-all cursor-pointer border-none ${
                      idx === activeIndex
                        ? 'w-7 bg-[#5c0f1b]'
                        : 'w-2.5 bg-stone-300 hover:bg-stone-400'
                    }`}
                  />
                ))}
              </div>

              <button
                aria-label="Siguiente pack"
                onClick={goRight}
                className="h-10 w-10 rounded-full bg-[#ff7a45] text-white flex items-center justify-center shadow-md hover:bg-[#e86a35] active:scale-95 transition-all cursor-pointer border-none"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

