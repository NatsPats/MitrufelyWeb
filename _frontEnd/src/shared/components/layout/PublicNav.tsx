/**
 * PublicNav.tsx — Menú de navegación secundario (subheader)
 *
 * Barra de links bajo el header principal. Puramente presentacional.
 */
import { Users, BookOpen, Home, Award } from 'lucide-react'

// ─── Links ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Inicio',     href: '#',         icon: Users    },
  { label: 'Catálogo',   href: '#catalogo',  icon: BookOpen },
  { label: 'Nosotros',   href: '#nosotros',  icon: Home     },
  { label: 'Tus puntos', href: '#puntos',    icon: Award    },
] as const

// ─── Componente ───────────────────────────────────────────────────────────

export function PublicNav() {
  return (
    <nav className="bg-[#faf8f5] py-2.5 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-8 md:gap-12">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
          <a
            key={label}
            href={href}
            className="flex items-center gap-2 text-lg font-bold text-[#5c0f1b] hover:text-[#ff7a45] transition-colors py-0.5 border-b-2 border-transparent hover:border-[#ff7a45]"
          >
            <Icon className="h-5 w-5" strokeWidth={2.5} />
            <span>{label}</span>
          </a>
        ))}
      </div>
    </nav>
  )
}
