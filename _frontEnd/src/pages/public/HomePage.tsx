/**
 * HomePage.tsx — Página pública principal de Mitrufely
 *
 * Única responsabilidad: orquestar estado de UI y componer las secciones.
 *
 * Este archivo NO contiene:
 *   - JSX de layout detallado  → shared/components/layout/
 *   - Secciones de dominio     → features/products/components/
 *   - Tipos / datos            → features/products/types.ts + api/mockData.ts
 *   - CSS custom               → eliminado; todo es Tailwind utility
 */
import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/app/store'

// Layout compartido
import { PublicHeader }  from '@/shared/components/layout/PublicHeader'
import { PublicNav }     from '@/shared/components/layout/PublicNav'
import { PublicFooter }  from '@/shared/components/layout/PublicFooter'

// Secciones de dominio
import { HeroSection }    from '@/features/products/components/HeroSection'
import { CatalogSection } from '@/features/products/components/CatalogSection'
import { PacksSection }   from '@/features/products/components/PacksSection'
import { BenefitsSection } from '@/features/products/components/BenefitsSection'

// Modal de detalle
import {
  X, Plus, Minus, ShoppingCart,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TabKey, Trufa } from '@/features/products/types'

// ─── Página ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, isAuthenticated, logout } = useAuthStore()

  // ── Estado de UI ──────────────────────────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState('')
  const [activeTab,     setActiveTab]     = useState<TabKey>('best_sellers')
  const [selectedTrufa, setSelectedTrufa] = useState<Trufa | null>(null)
  const [trufaQuantity, setTrufaQuantity] = useState(1)
  const [cartCount,     setCartCount]     = useState(0)
  const [favorites,     setFavorites]     = useState<number[]>([])
  const [userMenuOpen,  setUserMenuOpen]  = useState(false)

  const catalogRef = useRef<HTMLElement>(null)

  // Forzar fondo claro ignorando el dark mode del sistema operativo
  useEffect(() => {
    const prevBg    = document.body.style.backgroundColor
    const prevColor = document.body.style.color
    document.body.style.backgroundColor = '#faf8f5'
    document.body.style.color           = '#2a1115'
    return () => {
      document.body.style.backgroundColor = prevBg
      document.body.style.color           = prevColor
    }
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    toast.info(`Buscando: "${searchQuery}"`)
  }

  const handleAddToCart = (nombre: string, qty: number) => {
    setCartCount((c) => c + qty)
    toast.success(`${qty}× ${nombre} agregado al carrito 🛍️`)
    setSelectedTrufa(null)
    setTrufaQuantity(1)
  }

  const handleLogout = () => {
    logout()
    setUserMenuOpen(false)
    toast.success('Sesión cerrada correctamente.')
  }

  const scrollToCatalog = () =>
    catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased overflow-x-hidden">

      <PublicHeader
        cartCount={cartCount}
        favoriteCount={favorites.length}
        coinsBalance={isAuthenticated && user ? user.sweetCoinsBalance : null}
        userName={isAuthenticated && user ? user.name : null}
        userMenuOpen={userMenuOpen}
        onUserMenuToggle={() => setUserMenuOpen((o) => !o)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearch}
        onLogout={handleLogout}
      />

      <PublicNav />

      <HeroSection onCatalogClick={scrollToCatalog} />

      <CatalogSection
        ref={catalogRef}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSelectTrufa={setSelectedTrufa}
      />

      <PacksSection onPackAdded={() => setCartCount((c) => c + 1)} />

      <BenefitsSection />

      <PublicFooter />

      {/* ── Modal de detalle de trufa ── */}
      <AnimatePresence>
        {selectedTrufa && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedTrufa(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 30, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 240 }}
              className="bg-white w-full max-w-2xl rounded-[36px] overflow-hidden shadow-2xl relative grid grid-cols-1 md:grid-cols-2 border border-[#5c0f1b]/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cerrar */}
              <button
                id="hp-modal-close"
                onClick={() => { setSelectedTrufa(null); setTrufaQuantity(1) }}
                className="absolute top-4 right-4 z-20 p-2 bg-white rounded-full border border-[#5c0f1b]/10 text-[#5c0f1b] hover:text-[#ff7a45] shadow-sm transition-all hover:scale-110 active:scale-90 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Imagen */}
              <div className="relative h-[220px] md:h-full bg-[#f0ede8]">
                <img
                  src={selectedTrufa.imagenUrl}
                  alt={selectedTrufa.nombre}
                  className="w-full h-full object-cover"
                />
                {selectedTrufa.badge && (
                  <div className="absolute top-4 left-4 bg-[#5c0f1b] text-white text-xs font-black px-3 py-1.5 rounded-full shadow-md">
                    {selectedTrufa.badge}
                  </div>
                )}
              </div>

              {/* Contenido */}
              <div className="p-6 md:p-8 flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-[#ff7a45]/12 border border-[#ff7a45]/20 px-3 py-1 rounded-full mb-4 text-xs font-black text-[#ff7a45] uppercase tracking-wide">
                    🍫 Artesanal
                  </div>
                  <h3
                    className="font-black text-[#2a1115] text-2xl mb-3"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {selectedTrufa.nombre}
                  </h3>
                  <p className="text-sm text-[#2a1115]/70 font-medium leading-relaxed mb-6">
                    {selectedTrufa.descripcion}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-4 mb-5 pt-4 border-t border-[#5c0f1b]/8">
                    <span
                      className="text-2xl font-black text-[#5c0f1b]"
                      style={{ fontFamily: "'Outfit', sans-serif" }}
                    >
                      S/. {(selectedTrufa.precio * trufaQuantity).toFixed(2)}
                    </span>
                    {/* Selector cantidad */}
                    <div className="flex items-center gap-3 bg-[#f4f3f0] border border-[#5c0f1b]/12 rounded-full px-3 py-1.5">
                      <button
                        onClick={() => setTrufaQuantity((q) => Math.max(1, q - 1))}
                        className="text-[#5c0f1b] hover:text-[#ff7a45] transition-colors font-bold cursor-pointer"
                        aria-label="Restar cantidad"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-base font-black text-[#5c0f1b] w-6 text-center select-none">
                        {trufaQuantity}
                      </span>
                      <button
                        onClick={() => setTrufaQuantity((q) => q + 1)}
                        className="text-[#5c0f1b] hover:text-[#ff7a45] transition-colors font-bold cursor-pointer"
                        aria-label="Sumar cantidad"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <button
                    id="hp-modal-add"
                    onClick={() => handleAddToCart(selectedTrufa.nombre, trufaQuantity)}
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#5c0f1b] text-white font-black rounded-full py-4 text-sm shadow-lg hover:bg-[#7a1525] transition-all active:scale-95 cursor-pointer border-none"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    Agregar al carrito
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
