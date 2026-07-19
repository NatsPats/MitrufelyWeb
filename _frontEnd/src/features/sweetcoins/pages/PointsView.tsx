/**
 * PointsView.tsx — Vista principal de Tus Puntos (CriptoTrufas).
 *
 * Estructura:
 *   - PublicHeader + PublicNav + PublicFooter (layout compartido)
 *   - Hero: saldo actual en grande + historial
 *   - Mis Cupones: carrusel horizontal fluido (track continuo)
 *   - Layout 2 columnas: Zona de Recompensas (izq) + Arcade Ruleta (der)
 *
 * Integraciones:
 *   - useCriptoTrufaStore para estado global
 *   - useCartItemCount para badge del header
 *   - useAuthStore para datos del usuario en el header
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Clock,
  Gift,
  TicketCheck,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Layout ─────────────────────────────────────────────────────────────────────
import { PublicHeader } from '@/shared/components/layout/PublicHeader'
import { PublicFooter } from '@/shared/components/layout/PublicFooter'
import { useNavigate } from 'react-router'
import { AuthRequireModal } from '@/features/auth/components/AuthRequireModal'

// ── Stores ─────────────────────────────────────────────────────────────────────
import { useAuthStore } from '@/app/store'
import { useLogout } from '@/features/auth/hooks/useLogout'
import { useCartItemCount } from '@/features/cart/hooks/useCart'
import { useCriptoTrufaStore } from '@/stores/criptotrufa.store'

// ── Componentes propios ────────────────────────────────────────────────────────
import { CouponCard   } from '../components/CouponCard'
import { RewardCard   } from '../components/RewardCard'
import { ArcadeSection} from '../components/ArcadeSection'

// ─── Helper fecha ─────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

// ─── Vista ────────────────────────────────────────────────────────────────────

export default function PointsView() {
  const navigate = useNavigate()

  // Stores
  const { user, isAuthenticated } = useAuthStore()
  const logout = useLogout()
  const cartCount       = useCartItemCount()
  const saldoActual     = useCriptoTrufaStore((s) => s.saldoActual)
  const cuponesCliente  = useCriptoTrufaStore((s) => s.cuponesCliente)
  const cuponesMaestro  = useCriptoTrufaStore((s) => s.cuponesMaestro)
  const historial       = useCriptoTrufaStore((s) => s.historialMovimientos)
  const canjearCupon    = useCriptoTrufaStore((s) => s.canjearCupon)
  const hydrateSweetCoins = useCriptoTrufaStore((s) => s.hydrateSweetCoins)

  // UI local
  const [searchQuery,   setSearchQuery]  = useState('')
  const [userMenuOpen,  setUserMenuOpen] = useState(false)
  const [carouselIdx,   setCarouselIdx]  = useState(0)
  const [historialOpen, setHistorialOpen] = useState(false)
  
  // Estado responsivo para el carrusel
  const [visibleCount, setVisibleCount] = useState(3)
  const [redeemLoading, setRedeemLoading] = useState(false)

  // Fondo claro y carga inicial
  useEffect(() => {
    const prev = document.body.style.backgroundColor
    document.body.style.backgroundColor = '#faf8f5'
    if (isAuthenticated) {
      hydrateSweetCoins()
    }
    return () => { document.body.style.backgroundColor = prev }
  }, [isAuthenticated, hydrateSweetCoins])

  // Efecto para determinar cuántos cupones mostrar según el ancho de pantalla
  useEffect(() => {
    const updateVisibleCount = () => {
      if (window.innerWidth < 640) setVisibleCount(1)
      else if (window.innerWidth < 1024) setVisibleCount(2)
      else setVisibleCount(3)
    }
    
    updateVisibleCount()
    window.addEventListener('resize', updateVisibleCount)
    return () => window.removeEventListener('resize', updateVisibleCount)
  }, [])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault() }
  const handleLogout = async () => { await logout(); setUserMenuOpen(false); toast.success('Sesión cerrada.') }

  // Canje con feedback
  const handleCanjear = async (id_cupon: number) => {
    setRedeemLoading(true)
    try {
      const result = await canjearCupon(id_cupon)
      if (result.success) {
        // Actualizar el saldo del auth store (parte superior / header) con el saldo real obtenido
        const nuevoSaldo = useCriptoTrufaStore.getState().saldoActual
        useAuthStore.getState().updateUser({ sweetCoinsBalance: nuevoSaldo })
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error('Ocurrió un error inesperado al canjear el cupón.')
    } finally {
      setRedeemLoading(false)
    }
  }

  // Lógica del carrusel fluido
  const maxIdx  = Math.max(0, cuponesCliente.length - visibleCount)
  const canPrev = carouselIdx > 0
  const canNext = carouselIdx < maxIdx

  // Si el índice supera el máximo (ej: cambia el tamaño de la pantalla o se elimina un cupón), reseteamos
  useEffect(() => {
    if (carouselIdx > maxIdx) {
      setCarouselIdx(maxIdx)
    }
  }, [maxIdx, carouselIdx])

  // Calculo dinámico para el desplazamiento de la pista (track) del carrusel
  const gapSize = 16 // 1rem = 16px (gap-4)
  const itemWidth = `calc((100% - ${(visibleCount - 1) * gapSize}px) / ${visibleCount})`
  const trackX = `calc(-${carouselIdx} * (100% + ${gapSize}px) / ${visibleCount})`

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased">

      {/* ── Header ── */}
      <PublicHeader
        cartCount={cartCount}
        favoriteCount={0}
        coinsBalance={isAuthenticated && user ? user.sweetCoinsBalance : null}
        userName={isAuthenticated && user ? user.name : null}
        userMenuOpen={userMenuOpen}
        onUserMenuToggle={() => setUserMenuOpen((o) => !o)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearch}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-10">

        {/* ══════════════════════════════════════════════════════════════════════
            HERO — Saldo actual
        ══════════════════════════════════════════════════════════════════════ */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#5c0f1b] via-[#7a1525] to-[#8a1a2e] shadow-[0_8px_40px_rgba(92,15,27,0.25)] p-8 md:p-12"
          >
            {/* Decoración de fondo */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/5" />
              <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/4" />
              <div className="absolute top-1/2 right-1/4 h-3 w-3 rounded-full bg-[#ff7a45]/30" />
              <div className="absolute top-1/3 right-1/3 h-2 w-2 rounded-full bg-white/20" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-5 w-5 text-[#ff7a45]" fill="#ff7a45" />
                  <span className="text-white/70 text-sm font-bold uppercase tracking-widest">
                    Tus CriptoTrufas
                  </span>
                </div>
                <div
                  className="text-white font-black leading-none mb-2"
                  style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(3rem, 8vw, 5.5rem)' }}
                >
                  {saldoActual.toLocaleString()}
                </div>
                <p className="text-white/50 text-sm font-semibold">
                  Criptotrufas de fidelización acumuladas
                </p>
              </div>

              {/* Mini-estadísticas */}
              <div className="flex gap-4 flex-wrap">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 text-center min-w-[100px]">
                  <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mb-1">Cupones</p>
                  <p className="text-white font-black text-2xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {cuponesCliente.filter((c) => c.estado === 'DISPONIBLE').length}
                  </p>
                  <p className="text-white/40 text-[10px] font-semibold">disponibles</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 text-center min-w-[100px]">
                  <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mb-1">Canjeables</p>
                  <p className="text-white font-black text-2xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {cuponesMaestro.filter((r) => r.costo_puntos !== null && saldoActual >= (r.costo_puntos ?? 0)).length}
                  </p>
                  <p className="text-white/40 text-[10px] font-semibold">recompensas</p>
                </div>

                {/* Botón historial */}
                <button
                  id="puntos-historial-btn"
                  onClick={() => setHistorialOpen((o) => !o)}
                  className="bg-[#ff7a45]/20 hover:bg-[#ff7a45]/35 border border-[#ff7a45]/30 backdrop-blur-sm rounded-2xl px-5 py-4 text-center min-w-[100px] transition-all cursor-pointer"
                >
                  <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-1">Historial</p>
                  <p className="text-white font-black text-2xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {historial.length}
                  </p>
                  <p className="text-white/60 text-[10px] font-semibold">movimientos</p>
                </button>
              </div>
            </div>
          </motion.div>

          {/* ── Historial desplegable ── */}
          <AnimatePresence>
            {historialOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="bg-white rounded-[22px] mt-4 p-5 shadow-sm">
                  <h3
                    className="font-black text-[#2a1115] text-sm uppercase tracking-widest mb-4"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    Historial de movimientos
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {historial.map((mov) => (
                      <div
                        key={mov.id_movimiento_punto}
                        className="flex items-center gap-3 p-3 rounded-xl bg-[#faf8f5]"
                      >
                        <div
                          className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                            mov.cantidad > 0
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-red-50 text-red-500'
                          }`}
                        >
                          {mov.cantidad > 0
                            ? <TrendingUp className="h-4 w-4" />
                            : <TrendingDown className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-[#2a1115] truncate">
                            {mov.justificacion ?? mov.tipo_movimiento.replace(/_/g, ' ')}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-[#2a1115]/40 font-semibold mt-0.5">
                            <Clock className="h-3 w-3" />
                            {formatDate(mov.fecha_movimiento)}
                          </div>
                        </div>
                        <span
                          className={`text-sm font-black shrink-0 ${
                            mov.cantidad > 0 ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          {mov.cantidad > 0 ? '+' : ''}{mov.cantidad.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            MIS CUPONES DISPONIBLES (Carrusel fluido tipo pista/track)
        ══════════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TicketCheck className="h-5 w-5 text-[#5c0f1b]" />
              <h2
                className="font-black text-[#2a1115] text-xl"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Mis Cupones
              </h2>
              {cuponesCliente.length > 0 && (
                <span className="bg-[#5c0f1b] text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                  {cuponesCliente.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCarouselIdx((i) => Math.max(0, i - 1))}
                disabled={!canPrev}
                className="h-8 w-8 rounded-full flex items-center justify-center text-[#5c0f1b] hover:bg-[#5c0f1b]/6 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-default shadow-sm"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCarouselIdx((i) => Math.min(maxIdx, i + 1))}
                disabled={!canNext}
                className="h-8 w-8 rounded-full flex items-center justify-center text-[#5c0f1b] hover:bg-[#5c0f1b]/6 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-default shadow-sm"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {cuponesCliente.length === 0 ? (
            <div className="bg-white rounded-[22px] p-10 text-center shadow-sm">
              <TicketCheck className="h-12 w-12 text-[#5c0f1b]/15 mx-auto mb-3" />
              <p className="font-black text-[#2a1115]/40 text-sm">Aún no tienes cupones.</p>
              <p className="text-xs text-[#2a1115]/30 font-semibold mt-1">
                Canjea tus CriptoTrufas en la Zona de Recompensas.
              </p>
            </div>
          ) : (
            <div className=" overflow-hidden">
              <motion.div
                className="flex gap-4"
                animate={{ x: trackX }}
                transition={{ type: 'spring', stiffness: 200, damping: 28, mass: 0.8 }}
              >
                {cuponesCliente.map((c, i) => (
                  <div
                    key={c.id_cupon_cliente}
                    className="shrink-0"
                    style={{ width: itemWidth }}
                  >
                    <CouponCard coupon={c} index={i} />
                  </div>
                ))}
              </motion.div>
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            ZONA DE RECOMPENSAS + ARCADE (2 columnas)
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Zona de Recompensas (ocupa 2/3) ── */}
          <section className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-5">
              <Gift className="h-5 w-5 text-[#5c0f1b]" />
              <h2
                className="font-black text-[#2a1115] text-xl"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Zona de Recompensas
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cuponesMaestro.map((r, i) => (
                <RewardCard
                  key={r.id_cupon}
                  reward={r}
                  saldoActual={saldoActual}
                  onCanjear={handleCanjear}
                  index={i}
                />
              ))}
            </div>
          </section>

          {/* ── Arcade / Ruleta Dulce (1/3) ── */}
          <section className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">🎰</span>
              <h2
                className="font-black text-[#2a1115] text-xl"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Arcade
              </h2>
            </div>
            <ArcadeSection />
          </section>
        </div>

        {/* ── Nota informativa ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-[#5c0f1b]/4 rounded-2xl px-6 py-4 text-center"
        >
          <p className="text-xs font-semibold text-[#2a1115]/50 leading-relaxed">
            🍫 Las CriptoTrufas se acumulan automáticamente al completar tus compras.
            Los cupones son de uso único. Consulta términos y condiciones en nuestra tienda.
          </p>
        </motion.div>
      </main>

      <PublicFooter />

      {/* ── Modal de Carga para el Canje ── */}
      <AnimatePresence>
        {redeemLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-8 flex flex-col items-center text-center gap-4 max-w-xs shadow-2xl relative"
            >
              <div className="h-14 w-14 rounded-full bg-[#5c0f1b]/5 flex items-center justify-center animate-pulse">
                <Loader2 className="h-7 w-7 text-[#5c0f1b] animate-spin" />
              </div>
              <div>
                <h3
                  className="text-lg font-black text-[#2a1115] mb-1"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  Procesando Canje
                </h3>
                <p className="text-xs text-stone-500 font-medium leading-relaxed">
                  Por favor, no cierres esta ventana ni refresques la página mientras generamos tu cupón.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AuthRequireModal isOpen={!isAuthenticated} onClose={() => navigate('/')} />
    </div>
  )
}