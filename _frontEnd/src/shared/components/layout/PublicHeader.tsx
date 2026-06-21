/**
 * PublicHeader.tsx — Header principal de la página pública
 *
 * Contiene: logo, buscador, balance CriptoTrufas, favoritos, carrito, menú usuario.
 * Recibe todo el estado necesario via props — no se conecta directamente al store
 * para mantenerse testeable y desacoplado.
 *
 * UI REFACTOR: Fondo claro crema, sin borde superior, parte del bloque sticky.
 */
import { Search, Star, User, ShoppingCart, Heart, LogOut, LayoutDashboard } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAuthStore } from '@/app/store'
import { useState, useEffect, useRef } from 'react'
import { PublicNav } from './PublicNav'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { useOrdersQuery } from '@/features/orders/hooks/useOrders'

// ─── Props ────────────────────────────────────────────────────────────────

interface PublicHeaderProps {
  /** Número de ítems en el carrito */
  cartCount: number
  /** IDs de trufas marcadas como favorito */
  favoriteCount: number
  /** Balance de CriptoTrufas del usuario */
  coinsBalance: number | null
  /** Nombre del usuario autenticado (null si no hay sesión) */
  userName: string | null
  /** Estado de menú de usuario */
  userMenuOpen: boolean
  onUserMenuToggle: () => void
  /** Valor actual del campo de búsqueda */
  searchQuery: string
  onSearchChange: (q: string) => void
  onSearchSubmit: (e: React.FormEvent) => void
  onLogout: () => void
}

// ─── Componente ───────────────────────────────────────────────────────────

export function PublicHeader({
  cartCount,
  favoriteCount,
  coinsBalance,
  userName,
  userMenuOpen,
  onUserMenuToggle,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onLogout,
}: PublicHeaderProps) {
  const navigate = useNavigate()
  const isAuthenticated = userName !== null
  const { user } = useAuthStore()

  // ── Auto-hide al scroll ───────────────────────────────────────────────
  const [visible, setVisible] = useState(true)
  const lastY = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY
      if (currentY < 60) {
        // Siempre visible cerca del top
        setVisible(true)
      } else if (currentY > lastY.current + 4) {
        // Bajando: ocultar
        setVisible(false)
      } else if (currentY < lastY.current - 4) {
        // Subiendo: mostrar
        setVisible(true)
      }
      lastY.current = currentY
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Notificaciones de Calificación Pendiente ──────────────────────────────
  const { data: orders = [] } = useOrdersQuery()
  const pendingReviews = orders.filter((o) => o.estado === 'ENTREGADO' && !o.has_review)
  useEffect(() => {
    const alreadyNotified = sessionStorage.getItem('pendingReviewsNotified')
    if (isAuthenticated && pendingReviews.length > 0 && !alreadyNotified) {
      toast.custom((t) => (
        <div className="bg-white border-2 border-yellow-400 rounded-2xl p-4 shadow-xl flex gap-4 items-start w-full sm:w-[350px]">
          <div className="h-10 w-10 bg-yellow-100 rounded-full flex items-center justify-center shrink-0">
            <Star className="h-5 w-5 text-yellow-600 fill-yellow-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-[#5c0f1b] text-base" style={{ fontFamily: "'Outfit', sans-serif" }}>
              ¡Hola{userName ? `, ${userName.split(' ')[0]}` : ''}!
            </h3>
            <p className="text-xs text-[#2a1115]/70 font-medium mt-0.5">
              Tienes {pendingReviews.length} pedido(s) entregado(s) esperando tu calificación.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  toast.dismiss(t)
                  navigate('/mi-cuenta/pedidos')
                }}
                className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold text-xs rounded-xl transition-colors"
              >
                Calificar ahora
              </button>
              <button
                onClick={() => toast.dismiss(t)}
                className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-xs rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ), { id: 'pending-reviews', duration: 10000 })
      sessionStorage.setItem('pendingReviewsNotified', 'true')
    }
  }, [isAuthenticated, pendingReviews.length, navigate, userName])

  return (
    <motion.div
      animate={{ y: visible ? 0 : '-100%' }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="sticky top-0 z-50 shadow-sm"
    >
    <header className="bg-[#5c0f1b]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="shrink-0 select-none group">
          <span
            className="text-white font-black text-2xl md:text-3xl tracking-tight group-hover:text-[#ff7a45] transition-colors"
            style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.01em' }}
          >
            Mitrufely
          </span>
        </Link>

        {/* Buscador */}
        <form onSubmit={onSearchSubmit} className="hidden md:flex flex-1 max-w-sm relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
          <input
            id="hp-search"
            type="text"
            className="bg-white/15 border border-white/20 rounded-full px-5 pl-10 py-2.5 text-white text-sm font-medium placeholder:text-white/50 focus:outline-none focus:bg-white/22 focus:border-white/35 transition-all w-full max-w-sm"
            placeholder="Buscar trufas, sabores..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </form>

        {/* Acciones derechas */}
        <div className="flex items-center gap-3 md:gap-4">

          {/* CriptoTrufas balance */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 select-none">
            <Star className="h-4 w-4 fill-[#ff7a45] text-[#ff7a45]" />
            <span className="text-sm font-black text-white">
              {coinsBalance !== null ? coinsBalance.toLocaleString() : '2000'}
            </span>
          </div>

          {/* Notificaciones (M14) */}
          {isAuthenticated && (
            <NotificationBell />
          )}

          {/* Favoritos */}
          <button
            id="hp-favorites-btn"
            onClick={() => toast.info('Favoritos disponibles al iniciar sesión.')}
            className="relative p-2 text-white/70 hover:text-white transition-colors"
            aria-label="Favoritos"
          >
            <Heart
              className={`h-5 w-5 ${favoriteCount > 0 ? 'fill-[#ff7a45] text-[#ff7a45]' : ''}`}
            />
            {favoriteCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#ff7a45] text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center">
                {favoriteCount}
              </span>
            )}
          </button>

          {/* Carrito */}
          <button
            id="hp-cart-btn"
            onClick={() => navigate('/carrito')}
            className="relative p-2 text-white/70 hover:text-white transition-colors"
            aria-label="Carrito"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#ff7a45] text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Dashboard button for admin/staff users */}
          {isAuthenticated && user && user.role !== 'customer' && (
            <button
              id="hp-dashboard-btn"
              onClick={() => navigate('/dashboard')}
              className="flex h-9 items-center gap-2 px-3.5 rounded-full bg-white/15 text-white hover:bg-white/25 border border-white/25 transition-colors text-sm font-black shadow-md hover:scale-[1.02] active:scale-[0.98]"
              title="Panel de Administración"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
          )}

          {/* Usuario */}
          <div className="relative">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  id="hp-user-btn"
                  onClick={onUserMenuToggle}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 border border-white/25 text-white hover:bg-white/25 font-black text-sm transition-colors"
                >
                  {userName ? userName.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                </button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-[#5c0f1b]/10 overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-[#5c0f1b]/8">
                        <p className="text-xs text-[#2a1115]/50 font-semibold">Sesión activa</p>
                        <p className="text-sm font-black text-[#5c0f1b] truncate">{userName}</p>
                      </div>
                      {user && user.role !== 'customer' && (
                        <button
                          onClick={() => {
                            navigate('/dashboard')
                            onUserMenuToggle()
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-[#5c0f1b] hover:bg-[#5c0f1b]/5 transition-colors border-b border-[#5c0f1b]/8"
                        >
                          <LayoutDashboard className="h-4 w-4 text-[#ff7a45]" />
                          Panel de Administración
                        </button>
                      )}
                      <button
                        onClick={() => navigate('/mi-cuenta/pedidos')}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-[#5c0f1b] hover:bg-[#5c0f1b]/5 transition-colors"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Mis Pedidos
                      </button>
                      <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-[#5c0f1b] hover:bg-[#5c0f1b]/5 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Cerrar sesión
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                id="hp-login-btn"
                onClick={() => navigate('/login')}
                className="flex h-9 items-center gap-2 px-4 rounded-full bg-white/15 text-white hover:bg-white/25 border border-white/25 transition-colors text-sm font-black"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Ingresar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
    <PublicNav />
    </motion.div>
  )
}
