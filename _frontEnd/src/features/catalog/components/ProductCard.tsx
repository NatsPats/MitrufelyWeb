/**
 * ProductCard.tsx — Tarjeta de producto del Catálogo Público.
 *
 * Diseño consistente con TrufaCard.tsx de la HomePage:
 *   - rounded-[28px], aspect-square, sombra suave tipo Mitrufely
 *   - Badge de stock/disponibilidad
 *   - Botón "Ver más" rounded-full borgoña
 *   - Animación framer-motion (layout + hover)
 */

import { motion } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
import type { Producto } from '@/features/products/types'
import { useCatalogStore } from '@/stores/catalog.store'

interface ProductCardProps {
  product: Producto
}

/** Normaliza nombre: primera letra mayúscula, resto minúscula */
function normalizeName(name: string): string {
  if (!name) return ''
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

export function ProductCard({ product }: ProductCardProps) {
  const openModal = useCatalogStore((s) => s.openModal)

  const { nombre, precio, imagen_url, disponible, stock_actual, estado } = product
  const isAvailable = disponible && estado && stock_actual > 0
  const isLowStock = isAvailable && stock_actual <= 10

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-[28px] p-4 flex flex-col shadow-[0_2px_12px_rgba(42,17,21,0.1),0_1px_3px_rgba(42,17,21,0.06)] hover:shadow-[0_8px_28px_rgba(92,15,27,0.12),0_3px_8px_rgba(92,15,27,0.06)] hover:-translate-y-1 transition-all duration-250 group"
    >
      {/* ── Imagen ── */}
      <div className="relative rounded-[20px] overflow-hidden mb-4 aspect-square bg-[#f0ede8]">
        {imagen_url ? (
          <img
            src={imagen_url}
            alt={nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <ShoppingBag className="h-10 w-10 text-[#5c0f1b]/20" />
            <span className="text-[10px] font-bold text-stone-300 uppercase tracking-wider">
              Sin imagen
            </span>
          </div>
        )}

        {/* Badge: Agotado */}
        {!isAvailable && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
            <span className="bg-stone-700/90 text-white text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
              Agotado
            </span>
          </div>
        )}

        {/* Badge: Últimas unidades */}
        {isLowStock && (
          <div className="absolute top-3 left-3">
            <span className="bg-[#5c0f1b] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm">
              ¡Últimas!
            </span>
          </div>
        )}
      </div>

      {/* ── Detalles ── */}
      <div className="px-2 pb-2">
        {/* Nombre + Precio */}
        <div className="flex justify-between items-center mb-3 gap-2">
          <h4
            className="font-black text-[#2a1115] text-lg line-clamp-1 group-hover:text-[#5c0f1b] transition-colors"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            {normalizeName(nombre)}
          </h4>
          <p className="text-xl font-black text-[#5c0f1b] shrink-0">
            S/{Number(precio).toFixed(2)}
          </p>
        </div>

        {/* Botón Ver más */}
        <button
          onClick={() => openModal(product)}
          disabled={!isAvailable}
          id={`catalogo-ver-mas-${product.id_producto}`}
          className={`w-full inline-flex items-center justify-center font-black rounded-full py-2.5 text-sm transition-all active:scale-95 cursor-pointer border-none ${
            isAvailable
              ? 'bg-[#5c0f1b] text-white hover:bg-[#7a1525]'
              : 'bg-stone-100 text-stone-400 cursor-not-allowed'
          }`}
          aria-label={`Ver detalles de ${nombre}`}
        >
          Ver más
        </button>
      </div>
    </motion.div>
  )
}
