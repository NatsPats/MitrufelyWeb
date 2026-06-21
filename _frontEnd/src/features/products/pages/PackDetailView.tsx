/**
 * PackDetailView.tsx — Página pública de detalle de paquete.
 *
 * Similar a ProductDetailView: muestra imagen, nombre, descripción, productos incluidos
 * y botón "Agregar al carrito" (envía el paquete completo vía API).
 */
import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ShoppingCart, ShoppingBag, Package, ArrowLeft, Plus, Minus, Loader2, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/app/store'
import { PublicHeader } from '@/shared/components/layout/PublicHeader'

import { PublicFooter } from '@/shared/components/layout/PublicFooter'
import { useCartItemCount } from '@/features/cart/hooks/useCart'
import { useAddCartItem } from '@/features/cart/hooks/useCart'
import { useActiveProducts } from '@/features/products/hooks/useCatalogAdmin'
import { usePackageBySlug } from '@/features/products/hooks/usePackages'

export default function PackDetailView() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const cartCount = useCartItemCount()
  const addCartItem = useAddCartItem()

  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)

  const { data: pack, isLoading, isError } = usePackageBySlug(slug || '')

  const { data: productsRes } = useActiveProducts(
    { size: 100 },
    { enabled: !!pack },
  )
  const allProducts = productsRes?.items || []

  const packProducts = (pack?.productos || []).map((pp) => {
    const product = allProducts.find((p) => p.id_producto === pp.id_producto)
    return {
      ...pp,
      nombre: product?.nombre ?? `Producto #${pp.id_producto}`,
      imagen_url: product?.imagen_url ?? null,
    }
  })

  const handleAddToCart = () => {
    if (!pack) return
    addCartItem.mutate(
      { id_producto: pack.id_paquete, cantidad: quantity, es_paquete: true, id_paquete: pack.id_paquete },
      {
        onSuccess: () => {
          toast.success(
            <span>
              {quantity}× <strong>{pack.nombre}</strong> agregado 🛍️{' '}
              <button
                onClick={() => navigate('/carrito')}
                style={{ textDecoration: 'underline', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', padding: 0 }}
              >
                Ver carrito
              </button>
            </span>
          )
          setQuantity(1)
        },
      },
    )
  }

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

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased">
        <PublicHeader cartCount={cartCount} favoriteCount={0} coinsBalance={null} userName={null}
          userMenuOpen={userMenuOpen} onUserMenuToggle={() => setUserMenuOpen((o) => !o)}
          searchQuery={searchQuery} onSearchChange={setSearchQuery}
          onSearchSubmit={(e) => e.preventDefault()} onLogout={() => {}} />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="h-8 w-8 text-[#5c0f1b] animate-spin" />
          <span className="text-[#2a1115]/50 font-bold text-sm">Cargando paquete...</span>
        </div>
        <PublicFooter />
      </div>
    )
  }

  // ─── No encontrado ────────────────────────────────────────────────────────
  if (isError || !pack) {
    return (
      <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased">
        <PublicHeader cartCount={cartCount} favoriteCount={0} coinsBalance={null} userName={null}
          userMenuOpen={userMenuOpen} onUserMenuToggle={() => setUserMenuOpen((o) => !o)}
          searchQuery={searchQuery} onSearchChange={setSearchQuery}
          onSearchSubmit={(e) => e.preventDefault()} onLogout={() => {}} />
        <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="font-black text-[#2a1115] text-xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Paquete no encontrado
          </h3>
          <Link to="/" className="px-6 py-3 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all">
            Volver al inicio
          </Link>
        </div>
        <PublicFooter />
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
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
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Breadcrumb */}
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#5c0f1b]/60 hover:text-[#5c0f1b] transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Imagen */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative rounded-[32px] overflow-hidden bg-[#f0ede8] aspect-square max-h-[500px] shadow-lg"
          >
            {pack.imagen_url ? (
              <img src={pack.imagen_url} alt={pack.nombre} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-20 w-20 text-[#5c0f1b]/15" />
              </div>
            )}
            {!pack.disponible && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                <div className="bg-stone-800/90 text-white px-6 py-2.5 rounded-full shadow-lg">
                  <span className="text-sm font-extrabold uppercase tracking-widest">Agotado</span>
                </div>
              </div>
            )}
            <div className="absolute top-4 left-4 bg-[#5c0f1b] text-white text-xs font-black px-3 py-1.5 rounded-full shadow-md">
              🎁 Pack
            </div>
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col"
          >
            <div className="inline-flex items-center gap-1.5 bg-[#ff7a45]/12 border border-[#ff7a45]/20 px-3 py-1 rounded-full mb-4 text-xs font-black text-[#ff7a45] uppercase tracking-wide self-start">
              ✨ Pack Especial
            </div>

            <h1 className="font-black text-[#2a1115] text-3xl md:text-4xl mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {pack.nombre}
            </h1>

            {pack.descripcion && (
              <p className="text-[#2a1115]/70 font-medium leading-relaxed mb-6 text-base">
                {pack.descripcion}
              </p>
            )}

            {/* Productos incluidos */}
            <div className="mb-6">
              <h3 className="text-xs font-black text-[#2a1115]/60 uppercase tracking-wider mb-3">
                Contiene ({packProducts.length} productos)
              </h3>
              <div className="space-y-2 bg-white rounded-2xl p-4 border border-[#5c0f1b]/6 shadow-sm">
                {packProducts.map((pp) => (
                  <div key={pp.id_paquete_producto} className="flex items-center gap-3 p-1">
                    <div className="h-12 w-12 rounded-lg overflow-hidden bg-[#f0ede8] shrink-0 flex items-center justify-center">
                      {pp.imagen_url ? (
                        <img src={pp.imagen_url} alt={pp.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="h-5 w-5 text-stone-300" />
                      )}
                    </div>
                    <span className="flex-1 text-sm font-bold text-[#2a1115] truncate">{pp.nombre}</span>
                    <span className="text-xs font-black text-[#5c0f1b] shrink-0">×{pp.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Precio + CTA */}
            <div className="mt-auto pt-6 border-t border-[#5c0f1b]/8">
              <div className="flex items-center justify-between gap-4 mb-6">
                <span className="text-3xl font-black text-[#5c0f1b]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  S/. {(Number(pack.precio) * quantity).toFixed(2)}
                </span>

                {pack.disponible && (
                  <div className="flex items-center gap-3 bg-[#f4f3f0] border border-[#5c0f1b]/12 rounded-full px-3 py-1.5">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="text-[#5c0f1b] hover:text-[#ff7a45] transition-colors font-bold cursor-pointer"
                      aria-label="Restar"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-base font-black text-[#5c0f1b] w-6 text-center select-none">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => q + 1)}
                      className="text-[#5c0f1b] hover:text-[#ff7a45] transition-colors font-bold cursor-pointer"
                      aria-label="Agregar"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!pack.disponible || addCartItem.isPending}
                className={`w-full inline-flex items-center justify-center gap-2 py-4 rounded-full font-black text-base shadow-lg transition-all active:scale-95 cursor-pointer border-none ${
                  pack.disponible
                    ? 'bg-[#5c0f1b] text-white hover:bg-[#7a1525]'
                    : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                }`}
              >
                <ShoppingCart className="h-5 w-5" />
                {pack.disponible
                  ? addCartItem.isPending
                    ? 'Agregando...'
                    : 'Agregar al carrito'
                  : 'No disponible'}
              </button>
            </div>
          </motion.div>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
