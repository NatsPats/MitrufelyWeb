/**
 * CatalogSection.tsx — Sección del catálogo de trufas
 *
 * SRP: gestionar el filtrado por tab y renderizar el grid de TrufaCards.
 * Recibe el estado de tabs/búsqueda desde la página padre para mantener
 * la búsqueda del header sincronizada con el filtrado.
 */
import { forwardRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router'
import { TrufaCard } from './TrufaCard'
import { TRUFAS_MOCK, CATALOG_TABS } from '../api/mockData'
import type { TabKey, Trufa } from '../types'


// ─── Props ────────────────────────────────────────────────────────────────

interface CatalogSectionProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  searchQuery: string
  onSelectTrufa: (trufa: Trufa) => void
}

// ─── Componente ───────────────────────────────────────────────────────────

export const CatalogSection = forwardRef<HTMLElement, CatalogSectionProps>(
  ({ activeTab, onTabChange, searchQuery, onSelectTrufa }, ref) => {
    const trufasFiltradas = TRUFAS_MOCK.filter(
      (t) =>
        t.categoria === activeTab &&
        t.nombre.toLowerCase().includes(searchQuery.toLowerCase()),
    )

    return (
      <section
        id="catalogo"
        ref={ref}
        className="px-4 py-16 scroll-mt-20 bg-[#faf8f5]"
      >
        <div className="max-w-7xl mx-auto">

          {/* Encabezado */}
          <div className="text-center mb-12">
            {/* Tabs */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-[#ff7a45] p-1.5 rounded-full shadow-lg gap-1">
                {CATALOG_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    id={`hp-tab-${key}`}
                    onClick={() => onTabChange(key)}
                    className={`px-5 py-2.5 rounded-full text-sm font-black tracking-wide transition-all cursor-pointer border-none ${
                      activeTab === key
                        ? 'bg-white text-[#5c0f1b] shadow-md'
                        : 'text-white hover:bg-white/15'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <h3
              className="font-black text-[#2a1115] mb-3"
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}
            >
              Nuestro Catálogo Especial
            </h3>
            <p className="text-[#2a1115]/55 max-w-md mx-auto text-sm font-medium">
              Trufas artesanales elaboradas a mano con el cacao más fino y rellenos irresistibles.
            </p>
          </div>

          {/* Grid de productos */}
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {trufasFiltradas.length > 0 ? (
                trufasFiltradas.map((trufa) => (
                  <TrufaCard
                    key={trufa.id}
                    trufa={trufa}
                    onSelect={onSelectTrufa}
                  />
                ))
              ) : (
                <div className="col-span-full py-20 text-center">
                  <p className="text-4xl mb-4">🍫</p>
                  <p className="text-[#2a1115]/50 font-semibold text-base">
                    No hay trufas en esta sección aún.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* CTA ver todo — navega al Catálogo Público (/catalogo) */}
          <div className="text-center mt-12">
            <Link
              id="hp-view-all-btn"
              to="/catalogo"
              className="inline-flex items-center justify-center px-10 py-3.5 rounded-full bg-[#5c0f1b] text-white text-sm font-black shadow-lg hover:bg-[#7a1525] transition-all hover:scale-105 active:scale-95"
            >
              Ver todo el catálogo
            </Link>
          </div>
        </div>
      </section>
    )
  },
)

CatalogSection.displayName = 'CatalogSection'
