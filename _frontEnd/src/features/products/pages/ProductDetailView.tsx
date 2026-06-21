/**
 * ProductDetailView.tsx — Vista de Detalle de Producto (SIAM / Mitrufely).
 *
 * Ruta: /producto/:slug
 *
 * Layout fiel a la imagen de referencia:
 *   - Columna izquierda: imagen grande + botón de cotización WhatsApp
 *   - Columna derecha:   nombre, categoría, precio + rating, descripción,
 *                        botones "Información Adicional" y "Calificame!",
 *                        selector de cantidad + "Añadir al carrito"
 *
 * Integraciones:
 *   - useParams para leer :slug
 *   - useActiveProducts para buscar el producto por slug desde el backend
 *   - useCartStore.addToCart para agregar al carrito
 *   - InfoModal para información adicional
 *   - WhatsApp link dinámico para cotizaciones
 */

import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  Plus,
  Minus,
  ShoppingCart,
  ShoppingBag,
  Star,
  MessageCircle,
  ChevronLeft,
  Package,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Layout compartido ──────────────────────────────────────────────────────────
import { PublicHeader } from '@/shared/components/layout/PublicHeader'

import { PublicFooter } from '@/shared/components/layout/PublicFooter'

// ── Store ──────────────────────────────────────────────────────────────────────
import { useCartItemCount, useAddCartItem } from '@/features/cart/hooks/useCart'
import { useAuthStore } from '@/app/store'

// ── Datos y hooks ──────────────────────────────────────────────────────────────
import { useActiveProducts } from '../hooks/useCatalogAdmin'

// ── InfoModal ─────────────────────────────────────────────────────────────────
import { InfoModal } from '../components/InfoModal'

// ─── Constantes ───────────────────────────────────────────────────────────────

const WHATSAPP_NUMBER = '51906491859'

// ─── Helper: estrellas de rating ──────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  const stars = Array.from({ length: 5 }, (_, i) => i + 1)
  return (
    <div className="flex items-center gap-0.5">
      {stars.map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 transition-colors ${
            s <= Math.round(rating)
              ? 'fill-[#ff7a45] text-[#ff7a45]'
              : 'fill-transparent text-[#5c0f1b]/20'
          }`}
          strokeWidth={1.5}
        />
      ))}
      <span className="ml-1.5 text-sm font-black text-[#5c0f1b]">
        {Number(rating || 0).toFixed(1)}
      </span>
    </div>
  )
}

// ─── Vista principal ──────────────────────────────────────────────────────────

export default function ProductDetailView() {
  const { slug } = useParams<{ slug: string }>()
  const navigate  = useNavigate()

  const { user, isAuthenticated, logout } = useAuthStore()
  const addToCartMutation = useAddCartItem()
  const cartCount  = useCartItemCount()

  // UI state
  const [searchQuery,   setSearchQuery]   = useState('')
  const [userMenuOpen,  setUserMenuOpen]  = useState(false)
  const [quantity,      setQuantity]      = useState(1)
  const [infoOpen,      setInfoOpen]      = useState(false)
  const [addedAnim,     setAddedAnim]     = useState(false)

  // Buscar producto por slug desde backend
  const { data: productsRes, isLoading: productLoading } = useActiveProducts({ size: 100 })
  const product = productsRes?.items?.find((p) => p.slug === slug) ?? null

  // Fondo claro consistente
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

  // Resetear cantidad al cambiar de producto
  useEffect(() => {
    setQuantity(1)
  }, [slug])

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  const handleDecrement = () =>
    setQuantity((q) => Math.max(1, q - 1))

  const handleIncrement = () => {
    if (!product) return
    setQuantity((q) => (product.stock_actual > 0 ? Math.min(product.stock_actual, q + 1) : q))
  }

  const handleAddToCart = () => {
    if (!product || !product.disponible) return
    addToCartMutation.mutate({ id_producto: product.id_producto, cantidad: quantity })
    setAddedAnim(true)
    setTimeout(() => setAddedAnim(false), 1000)
    toast.success(
      <span>
        {quantity}× <strong>{product.nombre}</strong> agregado al carrito 🛍️{' '}
        <button
          onClick={() => navigate('/carrito')}
          style={{
            textDecoration: 'underline',
            fontWeight: 700,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: 'inherit',
            padding: 0,
          }}
        >
          Ver carrito
        </button>
      </span>,
    )
  }

  const handleWhatsApp = () => {
    if (!product) return
    const message = encodeURIComponent(
      `Hola Mitrufely, deseo realizar una cotización para eventos del producto: ${product.nombre}. Me gustaría saber precios por volumen, disponibilidad y opciones de personalización. ¡Gracias!`,
    )
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank', 'noopener,noreferrer')
  }

  const handleRating = () => {
    toast.info('¡Gracias! Las calificaciones estarán disponibles próximamente.')
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (productLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased">
        <PublicHeader
          cartCount={cartCount}
          favoriteCount={0}
          coinsBalance={null}
          userName={null}
          userMenuOpen={false}
          onUserMenuToggle={() => {}}
          searchQuery=""
          onSearchChange={() => {}}
          onSearchSubmit={(e) => e.preventDefault()}
          onLogout={() => {}}
        />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#5c0f1b] border-t-transparent" />
          <span className="text-[#2a1115]/50 font-bold text-sm">Cargando producto...</span>
        </div>
        <PublicFooter />
      </div>
    )
  }

  // ─── Producto no encontrado ───────────────────────────────────────────────

  if (!product) {
    return (
      <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased">
        <PublicHeader
          cartCount={cartCount}
          favoriteCount={0}
          coinsBalance={null}
          userName={null}
          userMenuOpen={false}
          onUserMenuToggle={() => {}}
          searchQuery=""
          onSearchChange={() => {}}
          onSearchSubmit={(e) => e.preventDefault()}
          onLogout={() => {}}
        />
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <ShoppingBag className="h-20 w-20 text-[#5c0f1b]/20" />
          <div className="text-center">
            <h1
              className="font-black text-[#2a1115] text-2xl mb-2"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Producto no encontrado
            </h1>
            <p className="text-sm text-[#2a1115]/50 font-medium">
              El producto que buscas no existe o ya no está disponible.
            </p>
          </div>
          <Link
            to="/catalogo"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all active:scale-95 shadow-md"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver al catálogo
          </Link>
        </div>
        <PublicFooter />
      </div>
    )
  }

  const isAvailable = product.disponible
  const isLowStock  = isAvailable && product.stock_actual <= 10
  const totalPrice  = (Number(product.precio) * quantity).toFixed(2)

  // ─── Render principal ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased overflow-x-hidden">

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

      {/* ── Breadcrumb ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-5 pb-2">
        <nav className="flex items-center gap-2 text-xs font-semibold text-[#2a1115]/40">
          <Link to="/" className="hover:text-[#5c0f1b] transition-colors">Inicio</Link>
          <span>/</span>
          <Link to="/catalogo" className="hover:text-[#5c0f1b] transition-colors">Catálogo</Link>
          <span>/</span>
          <span className="text-[#5c0f1b] font-black truncate max-w-48">{product.nombre}</span>
        </nav>
      </div>

      {/* ── Cuerpo principal ── */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="bg-[#e8e4df] rounded-[32px] overflow-hidden shadow-[0_4px_32px_rgba(42,17,21,0.08)]">
          <div className="grid grid-cols-1 md:grid-cols-2 min-h-[480px]">

            {/* ══════════════════════════════════════════════════════════════
                COLUMNA IZQUIERDA — Imagen + botón cotización
            ══════════════════════════════════════════════════════════════ */}
            <div className="relative flex flex-col items-center justify-center p-10 md:p-14">

              {/* Imagen */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="relative w-full max-w-sm aspect-square"
              >
                {product.imagen_url ? (
                  <img
                    src={product.imagen_url}
                    alt={product.nombre}
                    className="w-full h-full object-cover rounded-[24px] shadow-[0_8px_40px_rgba(92,15,27,0.18)]"
                    loading="eager"
                  />
                ) : (
                  <div className="w-full h-full rounded-[24px] bg-[#d4cfc8] flex items-center justify-center">
                    <ShoppingBag className="h-24 w-24 text-[#5c0f1b]/20" />
                  </div>
                )}

                {/* Badge agotado */}
                {!isAvailable && (
                  <div className="absolute inset-0 rounded-[24px] bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                    <span className="bg-stone-700/90 text-white text-sm font-extrabold uppercase tracking-widest px-5 py-2 rounded-full shadow-lg">
                      Agotado
                    </span>
                  </div>
                )}

                {/* Badge últimas unidades */}
                {isLowStock && (
                  <div className="absolute top-3 left-3">
                    <span className="bg-[#5c0f1b] text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-sm">
                      ¡Últimas {product.stock_actual}!
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Botón cotización WhatsApp */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="mt-8 text-center"
              >
                <p className="text-xs text-[#2a1115]/45 font-semibold mb-2">
                  ¿Deseas para un evento o por paquetes? ✦
                </p>
                <button
                  id="product-detail-whatsapp"
                  onClick={handleWhatsApp}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#ff7a45] text-white font-black text-sm hover:bg-[#e8682e] transition-all active:scale-95 shadow-md cursor-pointer border-none"
                >
                  <MessageCircle className="h-4 w-4" />
                  Realizar una cotización
                  <span className="text-white/70 text-xs">›</span>
                </button>
              </motion.div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                COLUMNA DERECHA — Detalles + acciones
            ══════════════════════════════════════════════════════════════ */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-[#d8d3cd] md:bg-[#e0dbd5] flex flex-col justify-center px-8 md:px-12 py-10"
            >
              {/* Nombre */}
              <h1
                className="font-black text-[#2a1115] mb-1 leading-tight"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
                }}
              >
                {product.nombre}
              </h1>

              {/* Categoría */}
              {product.categoria_nombre && (
                <p className="text-sm font-semibold text-[#2a1115]/50 mb-4">
                  {product.categoria_nombre}
                </p>
              )}

              {/* Precio + Rating */}
              <div className="flex items-center gap-6 mb-5">
                <span
                  className="font-black text-[#5c0f1b]"
                  style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2rem' }}
                >
                  S/ {Number(product.precio).toFixed(2)}
                </span>
                {product.rating !== undefined && (
                  <StarRating rating={product.rating} />
                )}
              </div>

              {/* Descripción */}
              {product.descripcion && (
                <p className="text-sm text-[#2a1115]/70 font-medium leading-relaxed mb-6 text-justify">
                  {product.descripcion}
                </p>
              )}

              {/* Badges de stock */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold border ${
                    isAvailable
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-red-600 bg-red-50 border-red-200'
                  }`}
                >
                  <Package className="h-3.5 w-3.5" />
                  {isAvailable ? `${product.stock_actual} en stock` : 'Agotado'}
                </span>
                {product.peso_gramos && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold border border-stone-300 bg-white/50 text-stone-600">
                    {product.peso_gramos}g
                  </span>
                )}
                {product.alergenos && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-extrabold border border-amber-300 bg-amber-50 text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    Alérgenos
                  </span>
                )}
              </div>

              {/* Botones de información */}
              <div className="flex flex-col gap-2 mb-6">
                <button
                  id="product-detail-info-btn"
                  onClick={() => setInfoOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#ff7a45] text-white font-bold text-sm hover:bg-[#e8682e] transition-all active:scale-95 cursor-pointer border-none w-fit"
                >
                  Información Adicional
                  <span className="text-white/70 text-xs">›</span>
                </button>
                <button
                  id="product-detail-rating-btn"
                  onClick={handleRating}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#ff7a45] text-white font-bold text-sm hover:bg-[#e8682e] transition-all active:scale-95 cursor-pointer border-none w-fit"
                >
                  ¡Calificame!
                  <span className="text-white/70 text-xs">›</span>
                </button>
              </div>

              {/* Separador */}
              <div className="border-t border-dashed border-[#5c0f1b]/20 mb-6" />

              {/* Selector de cantidad + Add to cart */}
              <div className="flex items-center gap-4">
                {/* Contador */}
                <div className="flex items-center gap-3 bg-white/60 border border-[#5c0f1b]/15 rounded-full px-4 py-2.5 shadow-sm">
                  <button
                    id="product-detail-minus"
                    onClick={handleDecrement}
                    disabled={!isAvailable}
                    className="text-[#5c0f1b] hover:text-[#ff7a45] transition-colors font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Restar cantidad"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span
                    className="text-lg font-black text-[#5c0f1b] w-7 text-center select-none"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {quantity}
                  </span>
                  <button
                    id="product-detail-plus"
                    onClick={handleIncrement}
                    disabled={!isAvailable}
                    className="text-[#5c0f1b] hover:text-[#ff7a45] transition-colors font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Agregar cantidad"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Botón agregar al carrito */}
                <button
                  id="product-detail-add-cart"
                  onClick={handleAddToCart}
                  disabled={!isAvailable}
                  className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-full font-black text-sm transition-all active:scale-95 cursor-pointer border-none shadow-lg ${
                    isAvailable
                      ? addedAnim
                        ? 'bg-emerald-600 text-white scale-95'
                        : 'bg-[#5c0f1b] text-white hover:bg-[#7a1525]'
                      : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                  }`}
                  aria-label="Añadir al carrito"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {addedAnim
                    ? '¡Agregado! ✓'
                    : isAvailable
                      ? `Añadir al carrito · S/ ${totalPrice}`
                      : 'No disponible'}
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── Enlace volver al catálogo ── */}
        <div className="mt-6">
          <Link
            to="/catalogo"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#5c0f1b]/50 hover:text-[#5c0f1b] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver al catálogo
          </Link>
        </div>
      </main>

      {/* ── Footer ── */}
      <PublicFooter />

      {/* ── InfoModal ── */}
      <InfoModal
        product={product}
        isOpen={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </div>
  )
}
