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
import { Trash2, Plus, Minus, ShoppingBag, Tag, X, ArrowRight, ShoppingCart, Loader2, Star, AlertTriangle } from 'lucide-react'
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
import { useCriptoTrufaStore } from '@/stores/criptotrufa.store'
import { useAuthStore } from '@/app/store'
import { useShippingCost } from '@/features/config/hooks/useConfig'
import { useActiveCategories } from '@/features/products/hooks/useCategories'

import { PaymentModal } from './PaymentModal'

function normalizeName(name: string): string {
  if (!name) return ''
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

export default function CartView() {
  const { user, isAuthenticated, logout } = useAuthStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  
  // Estado para el modal de advertencia de cupón incompatible
  const [couponWarningOpen, setCouponWarningOpen] = useState(false)
  const [dismissedCouponId, setDismissedCouponId] = useState<number | null>(null)

  const { cuponesCliente, hydrateSweetCoins, publicConfig } = useCriptoTrufaStore()
  const { coupon, discount, fidelizacionCoupon, applyFidelizacionCoupon, removeCoupon } = useCartStore()

  const {
    data: cartData,
    isLoading: cartLoading,
    isError: cartError,
  } = useCartQuery()
  
  const items = cartData?.items ?? []
  const subtotal = Number(cartData?.subtotal ?? 0)
  
  // M14: Obtener costo de envío dinámicamente
  const { data: shippingData, isLoading: shippingLoading } = useShippingCost(subtotal, items.length > 0)
  const { data: categoriesRes } = useActiveCategories({ size: 100 })
  const categories = categoriesRes?.items || []
  const categoryMap = new Map(categories.map(c => [c.id_categoria, c.nombre]))
  const costoEnvio = shippingData?.costo_envio ?? 0
  const subtotalConDescuento = Math.max(0, subtotal - discount)
  const baseImponible = subtotalConDescuento / 1.18
  const igv = subtotalConDescuento - baseImponible
  const total = subtotalConDescuento + costoEnvio

  const tasaConversion = publicConfig?.tasa_conversion ? Number(publicConfig.tasa_conversion) : 0.10
  const puntosAGanar = Math.max(0, Math.floor(total * tasaConversion))
  
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()
  const itemCount = useCartItemCount()
  const availableCoupons = cuponesCliente.filter(
    (c) => c.estado === 'DISPONIBLE' && new Date(c.fecha_expiracion) > new Date()
  )

  useEffect(() => {
    const prevBg = document.body.style.backgroundColor
    const prevColor = document.body.style.color
    document.body.style.backgroundColor = '#faf8f5'
    document.body.style.color = '#2a1115'
    return () => {
      document.body.style.backgroundColor = prevBg
      document.body.style.color = prevColor
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      hydrateSweetCoins()
    }
  }, [isAuthenticated, hydrateSweetCoins])

  useEffect(() => {
    if (fidelizacionCoupon) {
      applyFidelizacionCoupon(fidelizacionCoupon, items)
    }
  }, [items, fidelizacionCoupon, applyFidelizacionCoupon])

  // Efecto para disparar el modal cuando el cupón no aplica a ningún producto
  useEffect(() => {
    if (fidelizacionCoupon && discount === 0) {
      // Si el usuario aún no ha descartado la advertencia para este cupón específico
      if (dismissedCouponId !== fidelizacionCoupon.id_cupon_cliente) {
        setCouponWarningOpen(true)
      }
    } else if (!fidelizacionCoupon || discount > 0) {
      // Resetear el descarte si se cambia de cupón o si ya aplica correctamente
      setCouponWarningOpen(false)
      setDismissedCouponId(null)
    }
  }, [fidelizacionCoupon, discount, dismissedCouponId])

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

  const handleRemoveCoupon = () => {
    removeCoupon()
    setCouponWarningOpen(false)
    setDismissedCouponId(null)
    toast.info('Cupón eliminado.')
  }

  const hasStockIssues = items.some(
    (item) => item.stock_actual !== undefined && item.stock_actual !== null && item.cantidad > item.stock_actual
  )

  const handleContinue = () => {
    if (items.length === 0) {
      toast.error('Tu carrito está vacío.')
      return
    }
    if (hasStockIssues) {
      toast.error('Por favor, reduce las cantidades que superan el stock disponible antes de pagar.')
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

                        {/* Indicador de Stock */}
                        <div className="flex items-center gap-1.5 mt-1 select-none">
                          {item.stock_actual !== undefined && item.stock_actual !== null ? (
                            item.stock_actual <= 0 ? (
                              <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-red-100 uppercase tracking-wider">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Sin stock disponible (Agotado)
                              </span>
                            ) : item.cantidad > item.stock_actual ? (
                              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-100 uppercase tracking-wider">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Supera el stock disponible ({item.stock_actual} uds)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-100 uppercase tracking-wider">
                                Stock disponible: {item.stock_actual} uds
                              </span>
                            )
                          ) : null}
                        </div>

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
                            onClick={() => {
                              if (item.stock_actual !== undefined && item.stock_actual !== null && item.cantidad >= item.stock_actual) {
                                toast.warning(`Sólo hay ${item.stock_actual} unidades disponibles de este producto.`)
                                return
                              }
                              updateItem.mutate({ id_producto: item.id_producto, cantidad: item.cantidad + 1 })
                            }}
                            disabled={item.stock_actual !== undefined && item.stock_actual !== null && item.cantidad >= item.stock_actual}
                            className="h-6 w-6 rounded-full flex items-center justify-center border border-[#5c0f1b]/20 text-[#5c0f1b] hover:bg-[#5c0f1b]/8 transition-all active:scale-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
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
                  Mis Cupones de Fidelización
                </p>

                {!isAuthenticated ? (
                  <p className="text-xs text-[#2a1115]/50 font-medium">
                    <Link to="/login" className="text-[#5c0f1b] underline font-bold hover:text-[#ff7a45]">Inicia sesión</Link> para usar tus cupones de fidelización CriptoTrufas.
                  </p>
                ) : availableCoupons.length === 0 ? (
                  <p className="text-xs text-[#2a1115]/50 font-medium">
                    No tienes cupones de fidelización disponibles. ¡Canjea tus CriptoTrufas por cupones en la sección de <Link to="/puntos" className="text-[#5c0f1b] underline font-bold hover:text-[#ff7a45]">puntos</Link>!
                  </p>
                ) : fidelizacionCoupon ? (
                  <div className="space-y-2">
                    <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${
                      discount === 0 
                        ? 'bg-amber-50 border-amber-200' 
                        : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      <Tag className={`h-4 w-4 shrink-0 ${discount === 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                          {discount === 0 ? 'Cupón Inactivo' : 'Cupón Aplicado'}
                        </p>
                        <p className={`text-sm font-black truncate ${discount === 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {fidelizacionCoupon.codigo_unico} — {fidelizacionCoupon.cupon_maestro.nombre} ({Number(fidelizacionCoupon.cupon_maestro.porcentaje_descuento)}% OFF)
                        </p>
                        {fidelizacionCoupon.cupon_maestro.id_categoria && (
                          <span className="inline-block text-[9px] bg-[#ff7a45]/10 text-[#5c0f1b] px-1.5 py-0.5 rounded-md font-bold mt-0.5">
                            Exclusivo categoría: {categoryMap.get(fidelizacionCoupon.cupon_maestro.id_categoria!) || 'Cargando...'}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <button
                          onClick={handleRemoveCoupon}
                          className="text-xs text-red-500 hover:text-red-700 font-black cursor-pointer border-none bg-transparent hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                    {discount === 0 && (
                      <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3.5 mt-2 flex items-start gap-2.5 shadow-sm">
                        <span className="text-lg shrink-0">⚠️</span>
                        <div className="text-xs font-semibold leading-relaxed">
                          <p className="font-black text-amber-800 mb-0.5">Cupón no aplica</p>
                          Este cupón requiere productos de la categoría <strong className="underline">{fidelizacionCoupon.cupon_maestro.id_categoria ? (categoryMap.get(fidelizacionCoupon.cupon_maestro.id_categoria) || 'específica') : 'específica'}</strong>, pero ninguno de los productos o componentes de paquetes en tu carrito coincide con ella.
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value
                        if (!val) {
                          applyFidelizacionCoupon(null, items)
                        } else {
                          const found = availableCoupons.find(c => c.id_cupon_cliente === Number(val))
                          if (found) {
                            applyFidelizacionCoupon(found, items)
                            toast.success(`Cupón ${found.codigo_unico} aplicado.`)
                          }
                        }
                      }}
                      className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115] focus:outline-none focus:ring-2 focus:ring-[#ff7a45]/40 transition-all bg-white cursor-pointer"
                    >
                      <option value="">-- Selecciona un cupón disponible --</option>
                      {availableCoupons.map((c) => {
                        const catName = c.cupon_maestro.id_categoria ? categoryMap.get(c.cupon_maestro.id_categoria) : null
                        return (
                          <option key={c.id_cupon_cliente} value={c.id_cupon_cliente}>
                            {c.codigo_unico} — {c.cupon_maestro.nombre} ({Number(c.cupon_maestro.porcentaje_descuento)}% OFF) {c.cupon_maestro.id_categoria ? ` (Solo categoría: ${catName || '...'})` : ''}
                          </option>
                        )
                      })}
                    </select>
                    <p className="text-[10px] text-stone-400 font-semibold leading-normal">
                      * El descuento se calcula sobre el subtotal elegible del carrito de compras.
                    </p>
                  </div>
                )}
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
                    <span>Descuentos {coupon && `(${coupon})`}</span>
                    <span>{discount > 0 ? `S/ -${Number(discount || 0).toFixed(2)}` : 'S/ 0.00'}</span>
                  </div>

                  {/* Base imponible e IGV */}
                  <div className="flex justify-between text-xs font-semibold text-[#2a1115]/50 pt-1 border-t border-[#5c0f1b]/5">
                    <span>Subtotal (Base Imponible)</span>
                    <span>S/ {Number(baseImponible || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-[#2a1115]/50">
                    <span>IGV (18%)</span>
                    <span>S/ {Number(igv || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-lg font-black text-[#5c0f1b] pt-2 border-t border-[#5c0f1b]/10">
                    <span style={{ fontFamily: "'Outfit', sans-serif" }}>Total a pagar</span>
                    <span style={{ fontFamily: "'Outfit', sans-serif" }}>S/ {Number(total || 0).toFixed(2)}</span>
                  </div>

                  {isAuthenticated && puntosAGanar > 0 && (
                    <div className="flex justify-between items-center text-xs font-bold text-[#ff7a45] bg-[#ff7a45]/8 p-3 rounded-xl border border-[#ff7a45]/20 mt-2 select-none">
                      <span className="flex items-center gap-1.5">
                        <Star className="h-4 w-4 fill-[#ff7a45] text-[#ff7a45] animate-pulse" />
                        CriptoTrufas a ganar
                      </span>
                      <span>+{puntosAGanar} pts</span>
                    </div>
                  )}

                  {shippingData?.aplica_envio_gratis && (
                    <div className="text-[10px] text-center font-bold text-emerald-600 bg-emerald-50 p-2 rounded-lg mt-2">
                      ¡Felicidades! Tienes envío gratis en este pedido 🎉
                    </div>
                  )}

                   {hasStockIssues && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3 rounded-xl flex items-start gap-2 mt-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                      <span>Algunos productos en tu carrito superan el stock disponible. Por favor ajusta las cantidades para continuar.</span>
                    </div>
                  )}

                  <button
                    onClick={handleContinue}
                    disabled={shippingLoading || hasStockIssues}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all active:scale-95 shadow-lg cursor-pointer border-none mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#5c0f1b]"
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

      {/* Modal de Advertencia: Cupón no coincide con productos en el carrito */}
      <AnimatePresence>
        {couponWarningOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setCouponWarningOpen(false)
              setDismissedCouponId(fidelizacionCoupon?.id_cupon_cliente || null)
            }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full text-center border border-[#5c0f1b]/10 relative"
            >
              <button 
                onClick={() => {
                  setCouponWarningOpen(false)
                  setDismissedCouponId(fidelizacionCoupon?.id_cupon_cliente || null)
                }}
                className="absolute top-4 right-4 text-[#2a1115]/40 hover:text-[#2a1115] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="h-16 w-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>

              <h3 className="font-black text-[#2a1115] text-xl mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Cupón no aplica
              </h3>
              <p className="text-sm text-[#2a1115]/60 font-medium mb-6">
                El cupón <strong className="text-[#5c0f1b]">{fidelizacionCoupon?.codigo_unico}</strong> requiere productos de la categoría <strong>{fidelizacionCoupon?.cupon_maestro?.id_categoria ? (categoryMap.get(fidelizacionCoupon.cupon_maestro.id_categoria) || 'específica') : 'específica'}</strong>, pero ninguno de los productos o componentes de paquetes en tu carrito coincide con ella.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    setCouponWarningOpen(false)
                    setDismissedCouponId(fidelizacionCoupon?.id_cupon_cliente || null)
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#5c0f1b]/8 text-[#5c0f1b] font-bold text-sm hover:bg-[#5c0f1b]/15 transition-all active:scale-95 cursor-pointer border-none"
                >
                  Mantener cupón
                </button>
                <button
                  onClick={handleRemoveCoupon}
                  className="px-6 py-2.5 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all active:scale-95 cursor-pointer border-none shadow-md"
                >
                  Quitar cupón
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}