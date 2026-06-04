/**
 * CatalogSidebar.tsx — Panel lateral de filtros del catálogo público.
 *
 * Diseño coherente con el sitio público Mitrufely:
 *   - Fondo blanco / crema cálido
 *   - Colores borgoña #5c0f1b y naranja #ff7a45
 *   - Botones de categoría rounded-full (estilo de tabs del CatalogSection)
 *   - Acordeones y radios con la paleta de la marca
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useCatalogStore,
  type CatalogCategoryFilter,
  type IngredientFilter,
  type OcasionFilter,
} from '@/stores/catalog.store'

// ─── Datos de filtro ───────────────────────────────────────────────────────────

const CATEGORIES: { key: CatalogCategoryFilter; label: string; emoji: string }[] = [
  { key: 'all',        label: 'Todas',       emoji: '🍫' },
  { key: 'clasicas',   label: 'Clásicas',    emoji: '⭐' },
  { key: 'sin_azucar', label: 'Sin Azúcar',  emoji: '🌿' },
  { key: 'especiales', label: 'Especiales',  emoji: '✨' },
  { key: 'ocasiones',  label: 'Ocasiones',   emoji: '🎁' },
]

const INGREDIENTS: { key: IngredientFilter; label: string }[] = [
  { key: 'all',              label: 'Todos'            },
  { key: 'chocolate_negro',  label: 'Chocolate Negro'  },
  { key: 'chocolate_blanco', label: 'Chocolate Blanco' },
  { key: 'frutas',           label: 'Frutas'           },
  { key: 'frutos_secos',     label: 'Frutos Secos'     },
]

const OCASIONES: { key: OcasionFilter; label: string }[] = [
  { key: 'all',          label: 'Todas'        },
  { key: 'cumpleanos',   label: 'Cumpleaños'   },
  { key: 'san_valentin', label: 'San Valentín' },
  { key: 'navidad',      label: 'Navidad'      },
  { key: 'graduacion',   label: 'Graduación'   },
]

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

// ─── Radio Option ──────────────────────────────────────────────────────────────

function RadioOption({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex items-center gap-3 py-1.5 cursor-pointer group">
      <span className={cn(
        'h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0',
        checked
          ? 'border-[#5c0f1b] bg-[#5c0f1b]'
          : 'border-stone-300 group-hover:border-[#5c0f1b]/50',
      )}>
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" />
      <span className={cn(
        'text-sm transition-colors',
        checked ? 'font-bold text-[#5c0f1b]' : 'font-medium text-stone-500 group-hover:text-[#2a1115]',
      )}>
        {label}
      </span>
    </label>
  )
}

// ─── Componente Principal ──────────────────────────────────────────────────────

export function CatalogSidebar({ resultCount }: { resultCount: number }) {
  const {
    filters,
    setCategoryFilter,
    setIngredientFilter,
    setOcasionFilter,
    setPriceRange,
    setSoloDisponibles,
    resetFilters,
  } = useCatalogStore()

  return (
    <aside className="w-full">

      {/* ── Header sidebar ── */}
      <div className="flex items-center justify-between mb-5">
        <h2
          className="text-lg font-black text-[#2a1115]"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Filtrar
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
      <div className="bg-gradient-to-br from-[#5c0f1b] to-[#7a1525] rounded-2xl px-5 py-4 mb-6 text-center shadow-md shadow-[#5c0f1b]/20">
        <span className="text-3xl font-black text-white block" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {resultCount}
        </span>
        <p className="text-xs font-semibold text-white/70 mt-0.5">
          {resultCount === 1 ? 'trufa encontrada' : 'trufas encontradas'}
        </p>
      </div>

      {/* ── Categorías (estilo tabs naranja) ── */}
      <div className="mb-6">
        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">
          Categoría
        </p>
        <div className="inline-flex flex-col w-full gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key)}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-black transition-all cursor-pointer border-none text-left',
                filters.category === cat.key
                  ? 'bg-[#5c0f1b] text-white shadow-md shadow-[#5c0f1b]/20'
                  : 'bg-[#faf8f5] text-[#2a1115]/60 hover:bg-[#5c0f1b]/8 hover:text-[#5c0f1b]',
              )}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Toggle Solo disponibles ── */}
      <div className="flex items-center justify-between py-3.5 border-b border-[#5c0f1b]/8">
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
      <div className="mt-2 bg-white rounded-2xl px-4 shadow-sm border border-[#5c0f1b]/6">

        <Accordion title="Ingrediente Principal">
          {INGREDIENTS.map((ing) => (
            <RadioOption
              key={ing.key}
              label={ing.label}
              checked={filters.ingredient === ing.key}
              onChange={() => setIngredientFilter(ing.key)}
            />
          ))}
        </Accordion>

        <Accordion title="Ocasión">
          {OCASIONES.map((oc) => (
            <RadioOption
              key={oc.key}
              label={oc.label}
              checked={filters.ocasion === oc.key}
              onChange={() => setOcasionFilter(oc.key)}
            />
          ))}
        </Accordion>

        <Accordion title="Rango de precio">
          <div className="space-y-4 py-2">
            <div className="flex justify-between text-sm font-black text-[#5c0f1b]">
              <span>S/. {filters.priceRange.min.toFixed(0)}</span>
              <span>S/. {filters.priceRange.max.toFixed(0)}</span>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-wider">Mínimo</label>
              <input
                type="range" min={0} max={15} step={0.5}
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
                type="range" min={0.5} max={20} step={0.5}
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
      </div>
    </aside>
  )
}
