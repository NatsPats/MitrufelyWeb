/**
 * PublicNav.tsx — Menú de navegación secundario (subheader)
 *
 * Barra de links bajo el header principal. Puramente presentacional.
 */
import { Users, BookOpen, Home, Award } from 'lucide-react'
import { Link, useLocation } from 'react-router'

// ─── Componente ───────────────────────────────────────────────────────────

export function PublicNav() {
  const location = useLocation()
  const isCatalog = location.pathname === '/catalogo'
  const isHome    = location.pathname === '/'

  return (
    <nav className="bg-[#faf8f5] py-2.5 px-4 border-b border-[#5c0f1b]/8">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-8 md:gap-12">

        {/* Inicio */}
        <Link
          to="/"
          className={`flex items-center gap-2 text-lg font-bold transition-colors py-0.5 border-b-2 ${
            isHome
              ? 'text-[#5c0f1b] border-[#5c0f1b]'
              : 'text-[#5c0f1b]/70 border-transparent hover:text-[#ff7a45] hover:border-[#ff7a45]'
          }`}
        >
          <Home className="h-5 w-5" strokeWidth={2.5} />
          <span>Inicio</span>
        </Link>

        {/* Catálogo — ruta real */}
        <Link
          to="/catalogo"
          className={`flex items-center gap-2 text-lg font-bold transition-colors py-0.5 border-b-2 ${
            isCatalog
              ? 'text-[#5c0f1b] border-[#5c0f1b]'
              : 'text-[#5c0f1b]/70 border-transparent hover:text-[#ff7a45] hover:border-[#ff7a45]'
          }`}
        >
          <BookOpen className="h-5 w-5" strokeWidth={2.5} />
          <span>Catálogo</span>
        </Link>

        {/* Nosotros */}
        <a
          href="#nosotros"
          className="flex items-center gap-2 text-lg font-bold text-[#5c0f1b]/70 hover:text-[#ff7a45] transition-colors py-0.5 border-b-2 border-transparent hover:border-[#ff7a45]"
        >
          <Users className="h-5 w-5" strokeWidth={2.5} />
          <span>Nosotros</span>
        </a>

        {/* Tus puntos */}
        <a
          href="#puntos"
          className="flex items-center gap-2 text-lg font-bold text-[#5c0f1b]/70 hover:text-[#ff7a45] transition-colors py-0.5 border-b-2 border-transparent hover:border-[#ff7a45]"
        >
          <Award className="h-5 w-5" strokeWidth={2.5} />
          <span>Tus puntos</span>
        </a>
      </div>
    </nav>
  )
}
