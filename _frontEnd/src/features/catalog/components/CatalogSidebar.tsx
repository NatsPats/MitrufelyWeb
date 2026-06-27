/**
 * CatalogSidebar.tsx — Panel lateral de filtros del catálogo público.
 *
 * Filtros reales desde backend:
 *   - Categorías dinámicas desde /categorias/
 *   - Ingrediente principal (búsqueda libre en producto.ingredientes)
 *   - Alérgenos (texto libre + toggle excluir/solo-mostrar)
 *   - Rango de precio
 *   - Solo disponibles
 *   - Ordenamiento
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCatalogStore, type AllergenMode, type SortOption } from '@/stores/catalog.store'
import { useActiveCategories } from '@/features/products/hooks/useCategories'

// ─── Acordeón ─────────────────────────────────────────────────────────────────
function Accordion({ title, children, defaultOpen = false }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-[#5c0f1b]/8 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3.5 text-sm font-black text-[#2a1115] hover:text-[#5c0f1b] transition-colors cursor-pointer text-left"
      >
        {title}
        {open
          ? <ChevronUp className="h-4 w-4 text-[#5c0f1b] shrink-0" />
          : <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />
        }
      </button>
      {open && (
        <div className="pb-3 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'recent',     label: 'Más recientes' },
  { key: 'price_asc',  label: 'Menor precio' },
  { key: 'price_desc', label: 'Mayor precio' },
  { key: 'name_asc',   label: 'Nombre A-Z' },
  { key: 'name_desc',  label: 'Nombre Z-A' },
]

const ALLERGEN_MODES: { key: AllergenMode; label: string }[] = [
  { key: 'exclude', label: 'Excluir este alérgeno' },
  { key: 'only',    label: 'Solo con este alérgeno' },
]

// ─── Componente Principal ──────────────────────────────────────────────────────

export function CatalogSidebar({
  resultCount,
  maxPrice,
  isLoading = false,
}: {
  resultCount: number
  maxPrice: number
  isLoading?: boolean
}) {
  const {
    filters,
    sortBy,
    setCategoryFilter,
    setIngredientSearch,
    setAllergenFilter,
    setPriceRange,
    setSoloDisponibles,
    setSortBy,
    resetFilters,
  } = useCatalogStore()

  const { data: categoriesRes } = useActiveCategories({ size: 100 })
  const categories = categoriesRes?.items || []

  return (
    <aside className="w-full">

      {/* ── Header sidebar ── */}
      <div className="flex items-center justify-between mb-5">
        <h2
          className="text-lg font-black text-[#2a1115]"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Filtyyyyyrar
        </h2>
        <button
          onClick={resetFilters}
          className="inline-flex items-center gap-1 text-xs font-bold text-stone-400 hover:text-[#ff7a45] transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Limpiar
        </button>
      </div>

      {/* ── Contador ── */}
      <div className="bg-gradient-to-br from-[#5c0f1b] to-[#7a1525] rounded-2xl px-5 py-4 mb-6 text-center shadow-md shadow-[#5c0f1b]/20 flex flex-col items-center justify-center min-h-[84px]">
        {isLoading ? (
          <span className="inline-block h-9 w-16 bg-white/20 rounded animate-pulse my-0.5" />
        ) : (
          <span className="text-3xl font-black text-white block" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {resultCount}
          </span>
        )}
        <p className="text-xs font-semibold text-white/70 mt-0.5">
          {isLoading ? 'buscando delicias...' : resultCount === 1 ? 'trufa encontrada' : 'trufas encontradas'}
        </p>
      </div>

      {/* ── Categorías dinámicas ── */}
      <div className="mb-6">
        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">
          Categoría
        </p>
        <div className="inline-flex flex-col w-full gap-1.5">
          <button
            onClick={() => setCategoryFilter(null)}
            className={cn(
              'w-full flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-black transition-all cursor-pointer border-none text-left',
              filters.categoryId === null
                ? 'bg-[#5c0f1b] text-white shadow-md shadow-[#5c0f1b]/20'
                : 'bg-[#faf8f5] text-[#2a1115]/60 hover:bg-[#5c0f1b]/8 hover:text-[#5c0f1b]',
            )}
          >
            <span>🍫</span>
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id_categoria}
              onClick={() => setCategoryFilter(cat.id_categoria)}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-black transition-all cursor-pointer border-none text-left',
                filters.categoryId === cat.id_categoria
                  ? 'bg-[#5c0f1b] text-white shadow-md shadow-[#5c0f1b]/20'
                  : 'bg-[#faf8f5] text-[#2a1115]/60 hover:bg-[#5c0f1b]/8 hover:text-[#5c0f1b]',
              )}
            >
              <span>🍫</span>
              {cat.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* ── Toggle Solo disponibles ── */}
      <div className="flex items-center justify-between py-3.5 border-[#5c0f1b]/8">
        <span className="text-sm font-bold text-[#2a1115]">Solo disponibles</span>
        <button
          role="switch"
          aria-checked={filters.soloDisponibles}
          onClick={() => setSoloDisponibles(!filters.soloDisponibles)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer border-2',
            filters.soloDisponibles
              ? 'bg-[#5c0f1b] border-[#5c0f1b]'
              : 'bg-stone-200 border-stone-200',
          )}
        >
          <span className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
            filters.soloDisponibles ? 'translate-x-5' : 'translate-x-1',
          )} />
        </button>
      </div>

      {/* ── Acordeones ── */}
      <div className="mt-2 bg-white rounded-2xl px-4 shadow-sm border-[#5c0f1b]/6">

        {/* Ingrediente Principal — búsqueda libre */}
        <Accordion title="Ingrediente Principal" defaultOpen={!!filters.ingredientSearch}>
          <div className="relative mt-1 mb-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
            <input
              type="text"
              placeholder='Buscar ingrediente (ej. "Lotus", "Oreo")'
              value={filters.ingredientSearch}
              onChange={(e) => setIngredientSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-[#2a1115] placeholder:text-stone-300 outline-none focus:border-[#5c0f1b]/40 focus:ring-2 focus:ring-[#5c0f1b]/10 transition-all"
            />
          </div>
          <p className="text-[10px] text-stone-400 leading-relaxed pb-1">
            Busca coincidencias en los ingredientes del producto.
          </p>
        </Accordion>

        {/* Alérgenos — texto libre + toggle */}
        <Accordion title="Alérgenos" defaultOpen={!!filters.allergenText}>
          <div className="relative mt-1 mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
            <input
              type="text"
              placeholder='Ej. "Gluten", "Lácteos"'
              value={filters.allergenText}
              onChange={(e) => setAllergenFilter(e.target.value, filters.allergenMode)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-[#2a1115] placeholder:text-stone-300 outline-none focus:border-[#5c0f1b]/40 focus:ring-2 focus:ring-[#5c0f1b]/10 transition-all"
            />
          </div>
          <div className="space-y-1 pb-1">
            {ALLERGEN_MODES.map((mode) => (
              <label
                key={mode.key}
                className="flex items-center gap-2.5 py-1 cursor-pointer group"
              >
                <span className={cn(
                  'h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0',
                  filters.allergenMode === mode.key
                    ? 'border-[#5c0f1b] bg-[#5c0f1b]'
                    : 'border-stone-300 group-hover:border-[#5c0f1b]/50',
                )}>
                  {filters.allergenMode === mode.key && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
                <input
                  type="radio"
                  checked={filters.allergenMode === mode.key}
                  onChange={() => setAllergenFilter(filters.allergenText, mode.key)}
                  className="sr-only"
                />
                <span className={cn(
                  'text-xs transition-colors',
                  filters.allergenMode === mode.key
                    ? 'font-bold text-[#5c0f1b]'
                    : 'font-medium text-stone-500 group-hover:text-[#2a1115]',
                )}>
                  {mode.label}
                </span>
              </label>
            ))}
          </div>
        </Accordion>

        {/* Rango de precio */}
        <Accordion title="Rango de precio">
          <div className="space-y-4 py-2">
            <div className="flex justify-between text-sm font-black text-[#5c0f1b]">
              <span>S/. {Number(filters.priceRange.min || 0).toFixed(0)}</span>
              <span>S/. {Number(filters.priceRange.max || 0).toFixed(0)}</span>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-wider">Mínimo</label>
              <input
                type="range" min={0} max={maxPrice} step={0.5}
                value={filters.priceRange.min}
                onChange={(e) => setPriceRange({
                  min: Number(e.target.value),
                  max: Math.max(filters.priceRange.max, Number(e.target.value) + 0.5),
                })}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#5c0f1b]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-wider">Máximo</label>
              <input
                type="range" min={0.5} max={maxPrice} step={0.5}
                value={filters.priceRange.max}
                onChange={(e) => setPriceRange({
                  min: Math.min(filters.priceRange.min, Number(e.target.value) - 0.5),
                  max: Number(e.target.value),
                })}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#5c0f1b]"
              />
            </div>
          </div>
        </Accordion>

        {/* Ordenamiento */}
        <Accordion title="Ordenar por">
          <div className="space-y-0.5 pb-1">
            {SORT_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                className="flex items-center gap-2.5 py-1.5 cursor-pointer group"
              >
                <span className={cn(
                  'h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0',
                  sortBy === opt.key
                    ? 'border-[#5c0f1b] bg-[#5c0f1b]'
                    : 'border-stone-300 group-hover:border-[#5c0f1b]/50',
                )}>
                  {sortBy === opt.key && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
                <input
                  type="radio"
                  checked={sortBy === opt.key}
                  onChange={() => setSortBy(opt.key)}
                  className="sr-only"
                />
                <span className={cn(
                  'text-xs transition-colors',
                  sortBy === opt.key
                    ? 'font-bold text-[#5c0f1b]'
                    : 'font-medium text-stone-500 group-hover:text-[#2a1115]',
                )}>
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </Accordion>
      </div>
    </aside>
  )
}
