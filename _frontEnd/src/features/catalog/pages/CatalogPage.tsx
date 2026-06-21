/**
 * CatalogPage.tsx — Página pública del Catálogo de Trufas Mitrufely.
 *
 * Conectada al backend real:
 *   - Productos desde GET /products/
 *   - Categorías desde GET /categorias/
 *   - Filtros en cliente: categoría, ingrediente, alérgenos, precio, disponibilidad
 *   - Búsqueda global: nombre + descripción + ingredientes
 *   - Ordenamiento: recientes, precio, nombre
 *   - Navegación por slug: /producto/:slug
 */
import { useMemo, useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/app/store'

import { PublicHeader }  from '@/shared/components/layout/PublicHeader'

import { PublicFooter }  from '@/shared/components/layout/PublicFooter'

import { CatalogSidebar } from '../components/CatalogSidebar'
import { ProductGrid }    from '../components/ProductGrid'
import { ProductModal }   from '../components/ProductModal'

import { useCatalogStore } from '@/stores/catalog.store'
import { useActiveProducts } from '@/features/products/hooks/useCatalogAdmin'
import { useCartItemCount } from '@/features/cart/hooks/useCart'
import type { Producto }  from '@/features/products/types'

// ─── Helpers de filtrado ─────────────────────────────────────────────────────

function matchesText(value: string | null | undefined, query: string): boolean {
  if (!value) return false
  return value.toLowerCase().includes(query)
}

function matchesAllergen(
  alergenos: string | null | undefined,
  text: string,
  mode: 'exclude' | 'only',
): boolean {
  if (!text.trim()) return true
  const hay = (alergenos ?? '').toLowerCase()
  const q = text.toLowerCase()
  const contains = hay.includes(q)
  return mode === 'exclude' ? !contains : contains
}

function sortProducts(products: Producto[], sortBy: string): Producto[] {
  const sorted = [...products]
  switch (sortBy) {
    case 'price_asc':
      return sorted.sort((a, b) => a.precio - b.precio)
    case 'price_desc':
      return sorted.sort((a, b) => b.precio - a.precio)
    case 'name_asc':
      return sorted.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    case 'name_desc':
      return sorted.sort((a, b) => b.nombre.localeCompare(a.nombre, 'es'))
    case 'recent':
    default:
      return sorted.sort((a, b) =>
        new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime(),
      )
  }
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const { user, isAuthenticated, logout } = useAuthStore()

  const [searchQuery,  setSearchQuery]  = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const cartCount = useCartItemCount()

  const { filters, pagination, sortBy, setPriceRange } = useCatalogStore()

  // Datos desde backend
  const {
    data: productsRes,
    isLoading,
    isError,
  } = useActiveProducts({ size: 100 })

  const allProducts = productsRes?.items || []

  const [isTransitioning, setIsTransitioning] = useState(false)
  const isInitialLoad = useRef(true)
  const priceInitialized = useRef(false)

  // Disparar loader temporal cuando cambian los filtros, ordenamiento, búsqueda o página
  useEffect(() => {
    // Si la query del backend aún está cargando la primera vez, ignorar transiciones locales
    if (isLoading) {
      isInitialLoad.current = true
      return
    }

    // Esperar a que los filtros de rango de precio se inicialicen con los datos reales
    if (!priceInitialized.current) {
      return
    }

    // Evitar disparar el loader en el montaje inicial cuando los filtros se inicializan
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      return
    }

    setIsTransitioning(true)
    const timer = setTimeout(() => {
      setIsTransitioning(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [filters, sortBy, pagination.page, searchQuery, isLoading])

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

  // ── Filtrado en cliente ─────────────────────────────────────────────────
  const filteredProducts = useMemo<Producto[]>(() => {
    let result = [...allProducts]

    // Búsqueda global: nombre + descripción + ingredientes
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          matchesText(p.nombre, q) ||
          matchesText(p.descripcion, q) ||
          matchesText(p.ingredientes, q),
      )
    }

    // Categoría
    if (filters.categoryId !== null) {
      result = result.filter((p) => p.id_categoria === filters.categoryId)
    }

    // Solo disponibles
    if (filters.soloDisponibles) {
      result = result.filter((p) => p.disponible)
    }

    // Rango de precio
    result = result.filter(
      (p) => p.precio >= filters.priceRange.min && p.precio <= filters.priceRange.max,
    )

    // Ingrediente principal (búsqueda libre)
    if (filters.ingredientSearch.trim()) {
      const q = filters.ingredientSearch.toLowerCase()
      result = result.filter((p) =>
        matchesText(p.ingredientes, q) || matchesText(p.nombre, q),
      )
    }

    // Alérgenos
    if (filters.allergenText.trim()) {
      result = result.filter((p) =>
        matchesAllergen(p.alergenos, filters.allergenText, filters.allergenMode),
      )
    }

    // Ordenamiento
    result = sortProducts(result, sortBy)

    return result
  }, [allProducts, filters, searchQuery, sortBy])

  // ── Paginación ──────────────────────────────────────────────────────────
  const { page, size } = pagination
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / size))
  const safePage   = Math.min(page, totalPages)

  const paginatedProducts = useMemo<Producto[]>(() => {
    const start = (safePage - 1) * size
    return filteredProducts.slice(start, start + size)
  }, [filteredProducts, safePage, size])

  // Stats dinámicos
  const availableCount = allProducts.filter((p) => p.disponible).length
  const minPrice = allProducts.length > 0
    ? Math.min(...allProducts.map((p) => p.precio))
    : 0
  const maxPrice = allProducts.length > 0
    ? Math.max(...allProducts.map((p) => p.precio))
    : 20

  useEffect(() => {
    if (!priceInitialized.current && allProducts.length > 0) {
      const ceiling = Math.ceil(Math.max(...allProducts.map((p) => p.precio))) || 20
      setPriceRange({ min: 0, max: ceiling })
      priceInitialized.current = true
    }
  }, [allProducts, setPriceRange])

  // ── Handlers ────────────────────────────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased overflow-x-hidden">

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

      {/* Banner hero */}
      <section className="bg-gradient-to-br from-[#5c0f1b] to-[#3d0911] py-14 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
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

          {/* Stats dinámicos reales */}
          <div className="flex justify-center gap-8 mt-8">
            {[
              {
                valor: isLoading ? (
                  <span className="inline-block h-8 w-12 bg-white/20 rounded animate-pulse my-0.5" />
                ) : (
                  `${availableCount}`
                ),
                label: 'Disponibles',
              },
              {
                valor: isLoading ? (
                  <span className="inline-block h-8 w-12 bg-white/20 rounded animate-pulse my-0.5" />
                ) : (
                  `${allProducts.length}`
                ),
                label: 'Variedades',
              },
              {
                valor: isLoading ? (
                  <span className="inline-block h-8 w-20 bg-white/20 rounded animate-pulse my-0.5" />
                ) : (
                  `S/. ${Number(minPrice || 0).toFixed(2)}`
                ),
                label: 'Desde',
              },
            ].map(({ valor, label }) => (
              <div key={label} className="text-center flex flex-col items-center">
                <span
                  className="block text-2xl font-black text-accent h-8 leading-8"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {valor}
                </span>
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Cuerpo: Sidebar + Grid */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="flex gap-10">

          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-28">
              <CatalogSidebar
                resultCount={filteredProducts.length}
                maxPrice={maxPrice}
                isLoading={isLoading}
              />
            </div>
          </aside>

          <div className="flex-1 min-w-0">

            {/* Barra de resultados */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
              <div>
                <p className="text-[#2a1115]/55 font-medium text-sm">
                  {isLoading ? (
                    'Cargando productos...'
                  ) : (
                    <>
                      Mostrando{' '}
                      <strong className="text-[#2a1115]">{paginatedProducts.length}</strong>
                      {' '}de{' '}
                      <strong className="text-[#2a1115]">{filteredProducts.length}</strong>
                      {' '}trufas
                    </>
                  )}
                </p>
              </div>
              {totalPages > 1 && (
                <span className="text-xs font-bold text-stone-400">
                  Página {safePage} de {totalPages}
                </span>
              )}
            </div>

            {/* Error API */}
            {isError && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#2a1115] mb-1">Error al cargar</h3>
                  <p className="text-sm text-stone-400 max-w-xs">
                    No pudimos conectar con el servidor. Intenta recargar la página.
                  </p>
                </div>
              </div>
            )}

            {/* Grid de productos */}
            {!isError && (
              <AnimatePresence mode="popLayout">
                <ProductGrid
                  products={paginatedProducts}
                  isLoading={isLoading || isTransitioning}
                  totalPages={totalPages}
                />
              </AnimatePresence>
            )}
          </div>
        </div>
      </main>

      <PublicFooter />
      <ProductModal />
    </div>
  )
}
