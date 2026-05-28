/**
 * types.ts — Dominio: Productos / Trufas
 *
 * Interfaces públicas del catálogo de Mitrufely.
 * Siguiendo SRP: este módulo sólo describe la forma de los datos del dominio.
 */

// ─── Literales de categoría ────────────────────────────────────────────────

export type TrufaCategoria = 'best_sellers' | 'new_flavors' | 'promos'

// Alias semántico reutilizable en el estado de la página
export type TabKey = TrufaCategoria

// ─── Entidades del dominio ─────────────────────────────────────────────────

export interface Trufa {
  id: number
  nombre: string
  categoria: TrufaCategoria
  precio: number
  imagenUrl: string
  descripcion: string
  /** Etiqueta decorativa opcional (ej. "🔥 Popular") */
  badge?: string
}

export interface Pack {
  id: number
  nombre: string
  precio: number
  /** CriptoTrufas (puntos) que se ganan al comprar el pack */
  puntos: number
  descripcion: string
  imagenUrl: string
  /** Número de piezas artesanales incluidas */
  piezas: number
}

// ─── UI — Tabs del catálogo ────────────────────────────────────────────────

export interface TabItem {
  readonly key: TrufaCategoria
  readonly label: string
}
