/**
 * CartView.tsx — Vista principal del Carrito de Compras.
 *
 * Conectado al backend real vía React Query (Redis):
 *   - GET /api/v1/cart → items
 *   - PUT/DELETE → mutations
 *   - Cupón: lógica local
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Plus, Minus, ShoppingBag, Tag, X, ArrowRight, ShoppingCart, Loader2 } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { PublicHeader } from '@/shared/components/layout/PublicHeader'

import { PublicFooter } from '@/shared/components/layout/PublicFooter'

import {
  useCartQuery,
  useUpdateCartItem,
  useRemoveCartItem,
  useCartItemCount,
} from '../hooks/useCart'
import { useCartStore } from '@/stores/cart.store'
import { useAuthStore } from '@/app/store'
import { useShippingCost } from '@/features/config/hooks/useConfig'

import { PaymentModal } from './PaymentModal'

function normalizeName(name: string): string {
  if (!name) return ''
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

export default function CartView() {
  const { user, isAuthenticated, logout } = useAuthStore()

  const [searchQuery,  setSearchQuery]  = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [paymentOpen,  setPaymentOpen]  = useState(false)
  const [couponInput,  setCouponInput]  = useState('')
  const [couponApplied, setCouponApplied] = useState(false)

  const { coupon, discount, applyCoupon, removeCoupon } = useCartStore()
  const {
    data: cartData,
    isLoading: cartLoading,
    isError: cartError,
  } = useCartQuery()
  
  const items = cartData?.items ?? []
  const subtotal = Number(cartData?.subtotal ?? 0)
  
  // M14: Obtener costo de envío dinámicamente
  const { data: shippingData, isLoading: shippingLoading } = useShippingCost(subtotal, items.length > 0)
  const costoEnvio = shippingData?.costo_envio ?? 0
  const subtotalConDescuento = Math.max(0, subtotal - discount)
  const total = subtotalConDescuento + costoEnvio
  
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()
  const itemCount = useCartItemCount()

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

  useEffect(() => {
    setCouponApplied(!!coupon)
    if (coupon) setCouponInput(coupon)
  }, [coupon])

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

  const handleApplyCoupon = () => {
    if (!couponInput.trim()) {
      toast.error('Ingresa un código de cupón.')
      return
    }
    const result = applyCoupon(couponInput, subtotal)
    if (result.success) {
      toast.success(result.message)
      setCouponApplied(true)
    } else {
      toast.error(result.message)
    }
  }

  const handleRemoveCoupon = () => {
    removeCoupon()
    setCouponInput('')
    setCouponApplied(false)
    toast.info('Cupón eliminado.')
  }

  const handleContinue = () => {
    if (items.length === 0) {
      toast.error('Tu carrito está vacío.')
      return
    }
    setPaymentOpen(true)
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased overflow-x-hidden">
      <PublicHeader
        cartCount={itemCount}
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

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        <div className="mb-8">
          <h1
            className="text-2xl font-black text-[#2a1115]"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Carrito{' '}
            <span className="text-[#2a1115]/45 font-semibold text-lg">
              ({itemCount} {itemCount === 1 ? 'producto' : 'productos'})
            </span>
          </h1>
        </div>

        {/* Loading */}
        {cartLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-10 w-10 text-[#5c0f1b] animate-spin" />
            <p className="text-sm font-bold text-[#2a1115]/50">Cargando carrito...</p>
          </div>
        )}

        {/* Error */}
        {cartError && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
              <X className="h-8 w-8 text-red-400" />
            </div>
            <p className="text-sm font-bold text-red-600">Error al cargar el carrito. Intenta recargar.</p>
          </div>
        )}

        {/* Vacío */}
        {!cartLoading && !cartError && items.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-6"
          >
            <div className="h-28 w-28 rounded-full bg-[#5c0f1b]/6 flex items-center justify-center">
              <ShoppingCart className="h-14 w-14 text-[#5c0f1b]/25" />
            </div>
            <div className="text-center">
              <p className="font-black text-[#2a1115] text-xl mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Tu carrito está vacío
              </p>
              <p className="text-sm text-[#2a1115]/50 font-medium">
                Explora nuestro catálogo y agrega tus trufas favoritas.
              </p>
            </div>
            <Link
              to="/catalogo"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all active:scale-95 shadow-md"
            >
              <ShoppingBag className="h-4 w-4" />
              Ir al catálogo
            </Link>
          </motion.div>
        )}

        {/* Contenido del carrito */}
        {!cartLoading && !cartError && items.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">

            {/* Columna izquierda: lista de items */}
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {items.map((item) => {
                  const lineTotal = Number(item.precio_unitario) * item.cantidad
                  return (
                    <motion.div
                      key={item.id_producto}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.25 }}
                      className="bg-white rounded-2xl shadow-md border-[#5c0f1b]/8 p-4 flex items-center gap-4"
                    >
                      <div className="h-30 w-30 rounded-xl overflow-hidden bg-[#f0ede8] shrink-0">
                        {item.imagen_url ? (
                          <img
                            src={item.imagen_url}
                            alt={item.nombre}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="h-10 w-7 text-[#5c0f1b]/20" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-black text-[#2a1115] text-xl line-clamp-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                          {normalizeName(item.nombre)}
                        </p>
                        <p className="text-l text-[#2a1115]/45 font-semibold mt-0.5">
                          {item.es_paquete ? 'Paquete Especial' : 'Trufa Artesanal'}
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() =>
                              updateItem.mutate({ id_producto: item.id_producto, cantidad: item.cantidad - 1 })
                            }
                            className="h-6 w-6 rounded-full flex items-center justify-center border border-[#5c0f1b]/20 text-[#5c0f1b] hover:bg-[#5c0f1b]/8 transition-all active:scale-90 cursor-pointer"
                            aria-label="Restar"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-lg font-black text-[#5c0f1b] w-5 text-center select-none">
                            {item.cantidad}
                          </span>
                          <button
                            onClick={() =>
                              updateItem.mutate({ id_producto: item.id_producto, cantidad: item.cantidad + 1 })
                            }
                            className="h-6 w-6 rounded-full flex items-center justify-center border border-[#5c0f1b]/20 text-[#5c0f1b] hover:bg-[#5c0f1b]/8 transition-all active:scale-90 cursor-pointer"
                            aria-label="Agregar"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <p className="font-black text-[#5c0f1b] text-base" style={{ fontFamily: "'Outfit', sans-serif" }}>
                          S/ {Number(lineTotal || 0).toFixed(2)}
                        </p>
                        <button
                          onClick={() => removeItem.mutate(item.id_producto)}
                          className="p-1.5 rounded-lg border border-[#5c0f1b]/15 text-[#5c0f1b]/50 hover:text-[#5c0f1b] hover:bg-[#5c0f1b]/8 transition-all active:scale-90 cursor-pointer"
                          aria-label={`Eliminar ${item.nombre}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {/* Cupón */}
              <div className="bg-white rounded-2xl shadow-md border-[#5c0f1b]/8 p-5 shadow-[0_2px_10px_rgba(42,17,21,0.06)]">
                <p className="text-sm font-black text-[#2a1115] mb-3 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-[#ff7a45]" />
                  Tengo un cupón de descuento
                </p>

                {couponApplied ? (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <Tag className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="flex-1 text-sm font-black text-emerald-700">
                      {coupon} — Descuento: S/ {Number(discount || 0).toFixed(2)}
                    </span>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-emerald-500 hover:text-red-500 transition-colors cursor-pointer"
                      aria-label="Eliminar cupón"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Código de cupón"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                        className="w-full rounded-xl border border-[#5c0f1b]/20 px-4 py-2.5 text-sm font-semibold text-[#2a1115] placeholder:text-[#2a1115]/30 focus:outline-none focus:ring-2 focus:ring-[#ff7a45]/40 transition-all bg-white hover:border-[#5c0f1b]/40"
                      />
                    </div>
                    <button
                      onClick={handleApplyCoupon}
                      className="px-5 py-2.5 rounded-xl bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all active:scale-95 cursor-pointer border-none shadow-sm"
                    >
                      Aplicar
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-[#2a1115]/35 font-semibold mt-2">
                  Prueba con: <strong>TRUFA20</strong>
                </p>
              </div>

              <Link
                to="/catalogo"
                className="inline-flex items-center gap-2 text-sm font-bold text-[#5c0f1b]/60 hover:text-[#5c0f1b] transition-colors"
              >
                ← Seguir comprando
              </Link>
            </div>

            {/* Columna derecha: resumen */}
            <div className="lg:sticky lg:top-28 h-fit">
              <div className="bg-white rounded-2xl shadow-md border-[#5c0f1b]/10 shadow-[0_4px_20px_rgba(92,15,27,0.08)] overflow-hidden">
                <div className="px-6 py-5 border-[#5c0f1b]/8">
                  <h2 className="font-black text-[#2a1115] text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Resumen de la compra
                  </h2>
                </div>

                <div className="px-4 py-4 space-y-3 max-h-72 overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.div
                        key={item.id_producto}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-3"
                      >
                        <div className="h-20 w-20 rounded-xl overflow-hidden bg-[#f0ede8] shrink-0">
                          {item.imagen_url ? (
                            <img src={item.imagen_url} alt={item.nombre} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="h-6 w-6 text-[#5c0f1b]/20" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-black text-[#2a1115] text-sm line-clamp-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {normalizeName(item.nombre)}
                          </p>
                          <p className="text-xs text-[#2a1115]/45 font-semibold">
                            {item.es_paquete ? 'Paquete' : 'Trufa Clásica'}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <button
                              onClick={() => updateItem.mutate({ id_producto: item.id_producto, cantidad: item.cantidad - 1 })}
                              className="h-5 w-5 rounded-full flex items-center justify-center border border-[#5c0f1b]/20 text-[#5c0f1b] hover:bg-[#5c0f1b]/8 transition-all active:scale-90 cursor-pointer"
                              aria-label="Restar"
                            >
                              <Minus className="h-2.5 w-2.5" />
                            </button>
                            <span className="text-xs font-black text-[#5c0f1b] w-4 text-center select-none">{item.cantidad}</span>
                            <button
                              onClick={() => updateItem.mutate({ id_producto: item.id_producto, cantidad: item.cantidad + 1 })}
                              className="h-5 w-5 rounded-full flex items-center justify-center border border-[#5c0f1b]/20 text-[#5c0f1b] hover:bg-[#5c0f1b]/8 transition-all active:scale-90 cursor-pointer"
                              aria-label="Agregar"
                            >
                              <Plus className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          <p className="font-black text-[#5c0f1b] text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>
                            S/ {(Number(item.precio_unitario) * item.cantidad).toFixed(2)}
                          </p>
                          <button
                            onClick={() => removeItem.mutate(item.id_producto)}
                            className="p-1 rounded-lg border border-[#5c0f1b]/15 text-[#5c0f1b]/40 hover:text-[#5c0f1b] hover:bg-[#5c0f1b]/8 transition-all active:scale-90 cursor-pointer"
                            aria-label={`Eliminar ${item.nombre}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <div className="px-6 py-5 border-[#5c0f1b]/8 space-y-3">
                  <div className="flex justify-between text-sm font-semibold text-[#2a1115]/70">
                    <span>Productos ({itemCount})</span>
                    <span>S/ {Number(subtotal || 0).toFixed(2)}</span>
                  </div>
                  
                  {/* Costo de Envío M14 */}
                  <div className="flex justify-between text-sm font-semibold text-[#2a1115]/70">
                    <span className="flex items-center gap-1">
                      Envío 
                      {shippingLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                      {shippingData?.aplica_envio_gratis && (
                        <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-sm">GRATIS</span>
                      )}
                    </span>
                    <span>
                      {shippingData?.aplica_envio_gratis ? (
                        <span className="text-emerald-600">S/ 0.00</span>
                      ) : (
                        `S/ ${Number(costoEnvio || 0).toFixed(2)}`
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm font-bold text-[#ff7a45]">
                    <span>Descuentos</span>
                    <span>{discount > 0 ? `S/ ${Number(discount || 0).toFixed(2)}` : 'S/ 0.00'}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-[#5c0f1b] pt-2 border-t border-[#5c0f1b]/10">
                    <span style={{ fontFamily: "'Outfit', sans-serif" }}>Total a pagar</span>
                    <span style={{ fontFamily: "'Outfit', sans-serif" }}>S/ {Number(total || 0).toFixed(2)}</span>
                  </div>

                  {shippingData?.aplica_envio_gratis && (
                    <div className="text-[10px] text-center font-bold text-emerald-600 bg-emerald-50 p-2 rounded-lg mt-2">
                      ¡Felicidades! Tienes envío gratis en este pedido 🎉
                    </div>
                  )}

                  <button
                    onClick={handleContinue}
                    disabled={shippingLoading}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all active:scale-95 shadow-lg cursor-pointer border-none mt-2 disabled:opacity-50"
                  >
                    Continuar compra
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <PublicFooter />

      <PaymentModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        subtotal={subtotal}
        total={total}
      />
    </div>
  )
}

