/**
 * catalog.store.ts — Estado global del Catálogo de Productos (SIAM)
 *
 * Gestiona:
 *   - Filtros seleccionados (categoría, ingredientes, ocasión, precio)
 *   - Paginación actual
 *   - Estado del Modal (abierto/cerrado + producto seleccionado)
 *
 * Patrones: Zustand + immer (consistente con auth.store.ts y ui.store.ts)
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Producto } from '@/features/products/types'

// ─── Tipos de filtros ───────────────────────────────────────────────────────────

/** Categorías principales del catálogo */
export type CatalogCategoryFilter =
  | 'all'
  | 'clasicas'      // id_categoria: 1
  | 'sin_azucar'    // id_categoria: 2
  | 'especiales'    // id_categoria: 3
  | 'ocasiones'     // id_categoria: 4

/** Mapeo de filtro de categoría a id_categoria del backend */
export const CATEGORY_FILTER_MAP: Record<CatalogCategoryFilter, number | null> = {
  all: null,
  clasicas: 1,
  sin_azucar: 2,
  especiales: 3,
  ocasiones: 4,
}

/** Filtros de ingrediente principal */
export type IngredientFilter =
  | 'all'
  | 'chocolate_negro'
  | 'chocolate_blanco'
  | 'frutas'
  | 'frutos_secos'

/** Filtros de ocasión */
export type OcasionFilter =
  | 'all'
  | 'cumpleanos'
  | 'san_valentin'
  | 'navidad'
  | 'graduacion'

/** Rango de precio */
export interface PriceRange {
  min: number
  max: number
}

/** Estado completo de los filtros */
export interface CatalogFilters {
  category: CatalogCategoryFilter
  ingredient: IngredientFilter
  ocasion: OcasionFilter
  priceRange: PriceRange
  /** Mostrar solo productos disponibles */
  soloDisponibles: boolean
}

/** Estado de paginación */
export interface CatalogPagination {
  page: number
  size: number
}

/** Estado del modal de detalle */
export interface CatalogModal {
  isOpen: boolean
  selectedProduct: Producto | null
}

// ─── Valores por defecto ────────────────────────────────────────────────────────

const DEFAULT_FILTERS: CatalogFilters = {
  category: 'all',
  ingredient: 'all',
  ocasion: 'all',
  priceRange: { min: 0, max: 20 },
  soloDisponibles: false,
}

const DEFAULT_PAGINATION: CatalogPagination = {
  page: 1,
  size: 8,
}

const DEFAULT_MODAL: CatalogModal = {
  isOpen: false,
  selectedProduct: null,
}

// ─── Interfaces del store ───────────────────────────────────────────────────────

interface CatalogState {
  filters: CatalogFilters
  pagination: CatalogPagination
  modal: CatalogModal
}

interface CatalogActions {
  // ── Filtros ──
  setCategoryFilter: (category: CatalogCategoryFilter) => void
  setIngredientFilter: (ingredient: IngredientFilter) => void
  setOcasionFilter: (ocasion: OcasionFilter) => void
  setPriceRange: (range: PriceRange) => void
  setSoloDisponibles: (value: boolean) => void
  resetFilters: () => void

  // ── Paginación ──
  setPage: (page: number) => void
  setPageSize: (size: number) => void

  // ── Modal ──
  openModal: (product: Producto) => void
  closeModal: () => void
}

type CatalogStore = CatalogState & CatalogActions

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useCatalogStore = create<CatalogStore>()(
  immer((set) => ({
    // ─── Estado inicial ─────────────────────────────────────────────────────────
    filters: DEFAULT_FILTERS,
    pagination: DEFAULT_PAGINATION,
    modal: DEFAULT_MODAL,

    // ─── Acciones de Filtros ────────────────────────────────────────────────────
    setCategoryFilter: (category) => {
      set((state) => {
        state.filters.category = category
        // Resetear página al cambiar categoría
        state.pagination.page = 1
      })
    },

    setIngredientFilter: (ingredient) => {
      set((state) => {
        state.filters.ingredient = ingredient
        state.pagination.page = 1
      })
    },

    setOcasionFilter: (ocasion) => {
      set((state) => {
        state.filters.ocasion = ocasion
        state.pagination.page = 1
      })
    },

    setPriceRange: (range) => {
      set((state) => {
        state.filters.priceRange = range
        state.pagination.page = 1
      })
    },

    setSoloDisponibles: (value) => {
      set((state) => {
        state.filters.soloDisponibles = value
        state.pagination.page = 1
      })
    },

    resetFilters: () => {
      set((state) => {
        state.filters = DEFAULT_FILTERS
        state.pagination = DEFAULT_PAGINATION
      })
    },

    // ─── Acciones de Paginación ─────────────────────────────────────────────────
    setPage: (page) => {
      set((state) => {
        state.pagination.page = page
      })
    },

    setPageSize: (size) => {
      set((state) => {
        state.pagination.size = size
        state.pagination.page = 1
      })
    },

    // ─── Acciones del Modal ─────────────────────────────────────────────────────
    openModal: (product) => {
      set((state) => {
        state.modal.isOpen = true
        state.modal.selectedProduct = product
      })
    },

    closeModal: () => {
      set((state) => {
        state.modal.isOpen = false
        state.modal.selectedProduct = null
      })
    },
  })),
)
