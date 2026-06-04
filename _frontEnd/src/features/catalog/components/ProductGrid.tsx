/**
 * ProductGrid.tsx — Cuadrícula de productos del catálogo.
 *
 * - Desktop: 4 columnas
 * - Tablet: 2-3 columnas
 * - Mobile: 1-2 columnas
 * - Muestra skeleton loaders durante la carga.
 * - Maneja el estado vacío cuando no hay resultados con los filtros actuales.
 */

import { PackageSearch } from 'lucide-react'
import type { Producto } from '@/features/products/types'
import { ProductCard } from './ProductCard'
import { useCatalogStore } from '@/stores/catalog.store'

// ─── Skeleton de carga ─────────────────────────────────────────────────────────

function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-[28px] p-4 flex flex-col shadow-[0_2px_12px_rgba(42,17,21,0.1)] animate-pulse">
      {/* Imagen skeleton — aspect-square igual que TrufaCard */}
      <div className="rounded-[20px] aspect-square bg-stone-200 mb-4" />
      {/* Contenido skeleton */}
      <div className="px-2 pb-2 space-y-3">
        <div className="flex justify-between items-center gap-2">
          <div className="h-5 bg-stone-200 rounded-lg flex-1" />
          <div className="h-5 bg-stone-200 rounded-lg w-12 shrink-0" />
        </div>
        <div className="h-9 bg-stone-200 rounded-full w-full" />
      </div>
    </div>
  )
}

// ─── Estado vacío ──────────────────────────────────────────────────────────────

function EmptyState() {
  const resetFilters = useCatalogStore((s) => s.resetFilters)

  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 gap-6 text-center">
      <div className="h-20 w-20 rounded-3xl bg-[#5c0f1b]/5 border border-[#5c0f1b]/10 flex items-center justify-center">
        <PackageSearch className="h-10 w-10 text-[#5c0f1b]/30" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-black text-[#2a1115]">
          Sin resultados
        </h3>
        <p className="text-sm text-stone-400 max-w-xs">
          No encontramos trufas que coincidan con los filtros seleccionados.
          Prueba cambiando las opciones.
        </p>
      </div>
      <button
        onClick={resetFilters}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5c0f1b] text-white text-sm font-extrabold rounded-xl hover:bg-[#4a0a14] transition-all shadow-md shadow-[#5c0f1b]/20 hover:scale-105 active:scale-95 cursor-pointer border-none"
      >
        Limpiar filtros
      </button>
    </div>
  )
}

// ─── Paginación ────────────────────────────────────────────────────────────────

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <div className="col-span-full flex items-center justify-center gap-2 pt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 rounded-xl text-sm font-bold border border-stone-200 bg-white hover:border-[#5c0f1b]/30 hover:text-[#5c0f1b] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        ←
      </button>

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={
            page === currentPage
              ? 'px-3.5 py-2 rounded-xl text-sm font-extrabold bg-[#5c0f1b] text-white shadow-md shadow-[#5c0f1b]/20 cursor-pointer border-none'
              : 'px-3.5 py-2 rounded-xl text-sm font-bold border border-stone-200 bg-white hover:border-[#5c0f1b]/30 hover:text-[#5c0f1b] transition-all cursor-pointer'
          }
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 rounded-xl text-sm font-bold border border-stone-200 bg-white hover:border-[#5c0f1b]/30 hover:text-[#5c0f1b] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        →
      </button>
    </div>
  )
}

// ─── Componente Principal ──────────────────────────────────────────────────────

interface ProductGridProps {
  products: Producto[]
  isLoading?: boolean
  totalPages?: number
}

export function ProductGrid({ products, isLoading = false, totalPages = 1 }: ProductGridProps) {
  const { pagination, setPage } = useCatalogStore()

  return (
    <div className="space-y-6">
      {/* Grid — 4 columnas fijas en desktop, igual que el home */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : products.length === 0
          ? <EmptyState />
          : products.map((product) => (
              <ProductCard key={product.id_producto} product={product} />
            ))}
      </div>

      {/* Paginación */}
      {!isLoading && products.length > 0 && (
        <div className="grid grid-cols-1">
          <Pagination
            currentPage={pagination.page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
