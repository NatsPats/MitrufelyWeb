/**
 * PublicFooter.tsx — Footer de la página pública
 *
 * Componente de layout compartido. No tiene estado — es puramente presentacional.
 */
import { Instagram, Facebook, Mail } from 'lucide-react'
import { toast } from 'sonner'

// ─── Links de navegación ──────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Inicio', href: '#' },
  { label: 'Catálogo', href: '#catalogo' },
  { label: 'Nosotros', href: '#nosotros' },
  { label: 'Tus puntos', href: '#puntos' },
] as const

// ─── Componente ───────────────────────────────────────────────────────────

export function PublicFooter() {
  return (
    <footer className="bg-[#5c0f1b] text-white pt-14 pb-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10 border-b border-white/10">

          {/* Marca */}
          <div>
            <h2
              className="text-3xl font-black text-white mb-3 select-none"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Mitrufely
            </h2>
            <p className="text-sm text-white/60 font-medium leading-relaxed mb-4 max-w-xs">
              Repostería fina y confitería artesanal. Elaboramos trufas premium con cacao 100%
              peruano.
            </p>
            <div className="flex items-center gap-2 text-sm text-white/60 font-medium">
              <Mail className="h-4 w-4 text-[#ff7a45] shrink-0" />
              <span>mitrufely123@gmail.com</span>
            </div>
          </div>

          {/* Navegación */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white/40 mb-4">
              Navegar
            </p>
            <div className="flex flex-col gap-2.5">
              {NAV_LINKS.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="text-sm font-semibold text-white/65 hover:text-[#ff7a45] transition-colors w-fit"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Redes sociales */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white/40 mb-4">
              Síguenos
            </p>
            <div className="flex gap-3 mb-6">
              <a
                href="#"
                id="hp-footer-facebook"
                onClick={(e) => { e.preventDefault(); toast.success('¡Visita nuestro Facebook!') }}
                className="h-10 w-10 rounded-full bg-white/8 hover:bg-[#ff7a45] flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="#"
                id="hp-footer-instagram"
                onClick={(e) => { e.preventDefault(); toast.success('¡Visita nuestro Instagram!') }}
                className="h-10 w-10 rounded-full bg-white/8 hover:bg-[#ff7a45] flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
            </div>
            <p className="text-xs text-white/40 font-medium">
              Lunes a Sábado<br />
              9:00 am — 7:00 pm
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/35 font-medium">
          <p>© {new Date().getFullYear()} Mitrufely. Todos los derechos reservados.</p>
          <p>Repostería Fina Artesanal — Hecho con ❤️ en Perú</p>
        </div>
      </div>
    </footer>
  )
}
