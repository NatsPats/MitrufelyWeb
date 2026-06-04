/**
 * CatalogPage.tsx — Página pública del Catálogo de Trufas Mitrufely.
 *
 * Estructura idéntica a HomePage.tsx:
 *   - PublicHeader (header borgoña con buscador)
 *   - PublicNav (barra de navegación secundaria)
 *   - Contenido: layout 2 columnas (CatalogSidebar + ProductGrid)
 *   - PublicFooter
 *   - ProductModal (AnimatePresence igual que HomePage)
 *
 * Datos: MOCK_PRODUCTS filtrados en cliente. Cuando el backend esté
 * disponible, se reemplaza el useMemo por un useQuery de React Query.
 */

import { useMemo, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/app/store'

// ── Layout compartido (igual que HomePage) ─────────────────────────────────────
import { PublicHeader }  from '@/shared/components/layout/PublicHeader'
import { PublicNav }     from '@/shared/components/layout/PublicNav'
import { PublicFooter }  from '@/shared/components/layout/PublicFooter'

// ── Componentes del catálogo ───────────────────────────────────────────────────
import { CatalogSidebar } from '../components/CatalogSidebar'
import { ProductGrid }    from '../components/ProductGrid'
import { ProductModal }   from '../components/ProductModal'

// ── Store y datos ──────────────────────────────────────────────────────────────
import { MOCK_PRODUCTS }  from '@/mocks/mockProducts'
import { useCatalogStore, CATEGORY_FILTER_MAP } from '@/stores/catalog.store'
import type { Producto }  from '@/features/products/types'

// ─── Mapas de keywords para filtros semánticos ─────────────────────────────────

const INGREDIENT_KEYWORDS: Record<string, string[]> = {
  chocolate_negro:  ['negro', 'amargo', 'oscuro', '70%', '75%', '80%', '85%', '90%'],
  chocolate_blanco: ['blanco', 'ruby'],
  frutas:           ['frambuesa', 'maracuyá', 'limón', 'menta', 'jengibre', 'champán', 'matcha'],
  frutos_secos:     ['almendra', 'pistacho', 'avellana', 'maní'],
}

const OCASION_KEYWORDS: Record<string, string[]> = {
  cumpleanos:    ['cumpleaños', 'cumple'],
  san_valentin:  ['valentín', 'san valentin', 'amor', 'corazón'],
  navidad:       ['navidad', 'navideña', 'jengibre', 'festiv'],
  graduacion:    ['graduación', 'graduad'],
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const { user, isAuthenticated, logout } = useAuthStore()

  // ── Estado de UI (idéntico patrón al de HomePage) ─────────────────────────
  const [searchQuery,  setSearchQuery]  = useState('')
  const [cartCount,    setCartCount]    = useState(0)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Forzar fondo claro (igual que HomePage)
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

  // ── Store del catálogo ────────────────────────────────────────────────────
  const { filters, pagination, setPage } = useCatalogStore()

  // ── Filtrado en cliente ───────────────────────────────────────────────────
  const filteredProducts = useMemo<Producto[]>(() => {
    let result = [...MOCK_PRODUCTS]

    // 1. Búsqueda por texto (sincronizada con el buscador del header)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.descripcion ?? '').toLowerCase().includes(q),
      )
    }

    // 2. Categoría
    const categoryId = CATEGORY_FILTER_MAP[filters.category]
    if (categoryId !== null) {
      result = result.filter((p) => p.id_categoria === categoryId)
    }

    // 3. Solo disponibles
    if (filters.soloDisponibles) {
      result = result.filter((p) => p.disponible)
    }

    // 4. Rango de precio
    result = result.filter(
      (p) => p.precio >= filters.priceRange.min && p.precio <= filters.priceRange.max,
    )

    // 5. Ingrediente
    if (filters.ingredient !== 'all') {
      const kws = INGREDIENT_KEYWORDS[filters.ingredient] ?? []
      result = result.filter((p) => {
        const hay = `${p.ingredientes ?? ''} ${p.nombre}`.toLowerCase()
        return kws.some((kw) => hay.includes(kw))
      })
    }

    // 6. Ocasión
    if (filters.ocasion !== 'all') {
      const kws = OCASION_KEYWORDS[filters.ocasion] ?? []
      result = result.filter((p) => {
        const hay = `${p.nombre} ${p.descripcion ?? ''}`.toLowerCase()
        return kws.some((kw) => hay.includes(kw))
      })
    }

    return result
  }, [filters, searchQuery])

  // ── Paginación del resultado filtrado ────────────────────────────────────
  const { page, size } = pagination
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / size))
  const safePage   = Math.min(page, totalPages)

  const paginatedProducts = useMemo<Producto[]>(() => {
    const start = (safePage - 1) * size
    return filteredProducts.slice(start, start + size)
  }, [filteredProducts, safePage, size])

  // ── Handlers (misma firma que HomePage) ──────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    toast.info(`Buscando: "${searchQuery}"`)
  }

  const handleLogout = () => {
    logout()
    setUserMenuOpen(false)
    toast.success('Sesión cerrada correctamente.')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased overflow-x-hidden">

      {/* ── Header borgoña (igual que HomePage) ── */}
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

      {/* ── Barra de navegación secundaria ── */}
      <PublicNav />

      {/* ── Banner hero del catálogo ── */}
      <section className="bg-gradient-to-br from-[#5c0f1b] to-[#3d0911] py-14 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-1.5 rounded-full mb-5">
            <span className="text-[#ff7a45] text-sm font-black">🍫 Catálogo Completo</span>
          </div>
          <h1
            className="text-white font-black mb-3"
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              lineHeight: 1.1,
            }}
          >
            Nuestras Trufas Artesanales
          </h1>
          <p className="text-white/60 font-medium text-base max-w-md mx-auto">
            Elaboradas a mano con el mejor cacao peruano y rellenos irresistibles.
          </p>

          {/* Stats rápidos */}
          <div className="flex justify-center gap-8 mt-8">
            {[
              { valor: `${MOCK_PRODUCTS.filter((p) => p.disponible).length}`, label: 'Disponibles' },
              { valor: `${MOCK_PRODUCTS.length}`, label: 'Variedades' },
              { valor: 'S/. 5.50', label: 'Desde' },
            ].map(({ valor, label }) => (
              <div key={label} className="text-center">
                <span
                  className="block text-2xl font-black text-white"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {valor}
                </span>
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Cuerpo: Sidebar + Grid ── */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="flex gap-10">

          {/* ── Sidebar de filtros (sticky) ── */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-28">
              <CatalogSidebar resultCount={filteredProducts.length} />
            </div>
          </aside>

          {/* ── Área de contenido ── */}
          <div className="flex-1 min-w-0">

            {/* Barra de resultados y ordenamiento */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
              <div>
                <p className="text-[#2a1115]/55 font-medium text-sm">
                  Mostrando{' '}
                  <strong className="text-[#2a1115]">{paginatedProducts.length}</strong>
                  {' '}de{' '}
                  <strong className="text-[#2a1115]">{filteredProducts.length}</strong>
                  {' '}trufas
                </p>
              </div>
              {totalPages > 1 && (
                <span className="text-xs font-bold text-stone-400">
                  Página {safePage} de {totalPages}
                </span>
              )}
            </div>

            {/* Grid de productos con framer-motion layout */}
            <AnimatePresence mode="popLayout">
              <ProductGrid
                products={paginatedProducts}
                isLoading={false}
                totalPages={totalPages}
              />
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <PublicFooter />

      {/* ── Modal superpuesto (framer-motion, idéntico al de HomePage) ── */}
      <ProductModal />
    </div>
  )
}
