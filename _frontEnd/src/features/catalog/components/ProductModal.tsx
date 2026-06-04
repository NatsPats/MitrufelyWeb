/**
 * ProductModal.tsx — Modal de detalle de producto del Catálogo Público.
 *
 * Diseño consistente con el modal de la HomePage:
 *   - Overlay bg-black/50 backdrop-blur-sm
 *   - Panel rounded-[36px], grid de 2 columnas (imagen + info)
 *   - Framer-motion (spring) para entrada/salida
 *   - Selector de cantidad + botón "Agregar al carrito"
 *   - Cierre por click en overlay, botón X o tecla Escape
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Minus, ShoppingCart, AlertTriangle, Package, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCatalogStore } from '@/stores/catalog.store'

export function ProductModal() {
  const { modal, closeModal } = useCatalogStore()
  const { isOpen, selectedProduct } = modal
  const [quantity, setQuantity] = useState(1)

  // Resetear cantidad al abrir un nuevo producto
  useEffect(() => {
    if (isOpen) setQuantity(1)
  }, [isOpen, selectedProduct?.id_producto])

  // Cierre con Escape + bloqueo del scroll del body
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, closeModal])

  const handleAddToCart = () => {
    if (!selectedProduct) return
    toast.success(`${quantity}× ${selectedProduct.nombre} agregado al carrito 🛍️`)
    closeModal()
    setQuantity(1)
  }

  return (
    <AnimatePresence>
      {isOpen && selectedProduct && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <motion.div
            initial={{ scale: 0.92, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            className="bg-white w-full max-w-2xl rounded-[36px] overflow-hidden shadow-2xl relative grid grid-cols-1 md:grid-cols-2 border border-[#5c0f1b]/10"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Detalles de ${selectedProduct.nombre}`}
          >
            {/* ── Botón Cerrar ── */}
            <button
              id="catalogo-modal-close"
              onClick={() => { closeModal(); setQuantity(1) }}
              aria-label="Cerrar modal"
              className="absolute top-4 right-4 z-20 p-2 bg-white rounded-full border border-[#5c0f1b]/10 text-[#5c0f1b] hover:text-[#ff7a45] shadow-sm transition-all hover:scale-110 active:scale-90 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* ── Columna Imagen ── */}
            <div className="relative h-[220px] md:h-full bg-[#f0ede8]">
              {selectedProduct.imagen_url ? (
                <img
                  src={selectedProduct.imagen_url}
                  alt={selectedProduct.nombre}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <ShoppingBag className="h-16 w-16 text-[#5c0f1b]/15" />
                </div>
              )}

              {/* Badge de agotado sobre imagen */}
              {!selectedProduct.disponible && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="bg-stone-800/90 text-white px-5 py-2 rounded-full shadow-lg">
                    <span className="text-sm font-extrabold uppercase tracking-widest">Agotado</span>
                  </div>
                </div>
              )}

              {/* Badge "🍫 Artesanal" */}
              <div className="absolute top-4 left-4 bg-[#5c0f1b] text-white text-xs font-black px-3 py-1.5 rounded-full shadow-md">
                🍫 Artesanal
              </div>
            </div>

            {/* ── Columna Info ── */}
            <div className="p-6 md:p-8 flex flex-col justify-between max-h-[80vh] overflow-y-auto">
              <div>
                {/* Badge naranja */}
                <div className="inline-flex items-center gap-1.5 bg-[#ff7a45]/12 border border-[#ff7a45]/20 px-3 py-1 rounded-full mb-4 text-xs font-black text-[#ff7a45] uppercase tracking-wide">
                  ✨ Trufa Gourmet
                </div>

                {/* Nombre */}
                <h3
                  className="font-black text-[#2a1115] text-2xl mb-3"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {selectedProduct.nombre}
                </h3>

                {/* Descripción */}
                {selectedProduct.descripcion && (
                  <p className="text-sm text-[#2a1115]/70 font-medium leading-relaxed mb-4">
                    {selectedProduct.descripcion}
                  </p>
                )}

                {/* Detalles: stock + peso */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold border',
                    selectedProduct.disponible
                      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                      : 'text-red-600 bg-red-50 border-red-200'
                  )}>
                    <Package className="h-3.5 w-3.5" />
                    {selectedProduct.disponible
                      ? `${selectedProduct.stock_actual} en stock`
                      : 'Agotado'}
                  </span>

                  {selectedProduct.peso_gramos && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold border border-stone-200 bg-stone-50 text-stone-600">
                      {selectedProduct.peso_gramos}g
                    </span>
                  )}
                </div>

                {/* Ingredientes */}
                {selectedProduct.ingredientes && (
                  <p className="text-xs text-stone-500 leading-relaxed mb-3">
                    <strong className="text-[#2a1115]/60 font-black uppercase tracking-wider text-[9px]">
                      Ingredientes:{' '}
                    </strong>
                    {selectedProduct.ingredientes}
                  </p>
                )}

                {/* Alérgenos */}
                {selectedProduct.alergenos && (
                  <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 font-medium leading-relaxed">
                      <strong>Alérgenos:</strong> {selectedProduct.alergenos}
                    </p>
                  </div>
                )}
              </div>

              {/* ── Precio + Cantidad + CTA ── */}
              <div className="mt-4">
                <div className="flex items-center justify-between gap-4 mb-5 pt-4 border-t border-[#5c0f1b]/8">
                  {/* Precio total */}
                  <span
                    className="text-2xl font-black text-[#5c0f1b]"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    S/. {(selectedProduct.precio * quantity).toFixed(2)}
                  </span>

                  {/* Selector de cantidad */}
                  {selectedProduct.disponible && (
                    <div className="flex items-center gap-3 bg-[#f4f3f0] border border-[#5c0f1b]/12 rounded-full px-3 py-1.5">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="text-[#5c0f1b] hover:text-[#ff7a45] transition-colors font-bold cursor-pointer"
                        aria-label="Restar cantidad"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-base font-black text-[#5c0f1b] w-6 text-center select-none">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity((q) => q + 1)}
                        className="text-[#5c0f1b] hover:text-[#ff7a45] transition-colors font-bold cursor-pointer"
                        aria-label="Sumar cantidad"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <button
                  id="catalogo-modal-add"
                  onClick={handleAddToCart}
                  disabled={!selectedProduct.disponible}
                  className={cn(
                    'w-full inline-flex items-center justify-center gap-2 font-black rounded-full py-4 text-sm shadow-lg transition-all active:scale-95 cursor-pointer border-none',
                    selectedProduct.disponible
                      ? 'bg-[#5c0f1b] text-white hover:bg-[#7a1525]'
                      : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                  )}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {selectedProduct.disponible ? 'Agregar al carrito' : 'No disponible'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
