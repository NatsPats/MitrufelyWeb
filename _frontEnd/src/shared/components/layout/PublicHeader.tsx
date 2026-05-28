/**
 * PublicHeader.tsx — Header principal de la página pública
 *
 * Contiene: logo, buscador, balance CriptoTrufas, favoritos, carrito, menú usuario.
 * Recibe todo el estado necesario via props — no se conecta directamente al store
 * para mantenerse testeable y desacoplado.
 */
import { Search, Star, User, ShoppingCart, Heart, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

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

  return (
    <header className="bg-gradient-to-r from-[#5c0f1b] to-[#7a1525] sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">

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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
          <input
            id="hp-search"
            type="text"
            className="bg-white/15 rounded-full px-5 pl-10 py-2.5 text-white text-sm font-semibold placeholder:text-white/55 focus:outline-none focus:bg-white/22 transition-all w-full max-w-sm"
            placeholder="Buscar trufas, sabores..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </form>

        {/* Acciones derechas */}
        <div className="flex items-center gap-3 md:gap-4">

          {/* CriptoTrufas balance */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full select-none">
            <Star className="h-4 w-4 fill-[#ff7a45] text-[#ff7a45]" />
            <span className="text-sm font-black text-white">
              {coinsBalance !== null ? coinsBalance.toLocaleString() : '2000'}
            </span>
          </div>

          {/* Favoritos */}
          <button
            id="hp-favorites-btn"
            onClick={() => toast.info('Favoritos disponibles al iniciar sesión.')}
            className="relative p-2 text-white/80 hover:text-white transition-colors"
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
            onClick={() => toast.info('Carrito disponible próximamente.')}
            className="relative p-2 text-white/80 hover:text-white transition-colors"
            aria-label="Carrito"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#ff7a45] text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

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
                className="flex h-9 items-center gap-2 px-4 rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors text-sm font-black"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Ingresar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
