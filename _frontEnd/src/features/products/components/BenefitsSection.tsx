/**
 * BenefitsSection.tsx — Sección de beneficios de la HomePage
 *
 * SRP: renderizar las 2 tarjetas de beneficios (CriptoTrufas + Personalización).
 * Puramente presentacional — sin estado propio.
 */
import { toast } from 'sonner'

// ─── Componente ───────────────────────────────────────────────────────────

export function BenefitsSection() {
  return (
    <section className="py-10 px-4 bg-[#faf8f5]">
      <div className="max-w-7xl mx-auto">

        {/* Encabezado */}
        <div className="text-center mb-12">
          <h3
            className="font-black text-[#2a1115]"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}
          >
            Más razones para elegir <span className="text-[#5c0f1b]">Mitrufely</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">

          {/* ── Tarjeta 1: CriptoTrufas ── */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#f8f8f8] via-[#e8e8e8] to-[#c8c8c8] shadow-md min-h-[260px] flex group transition-transform hover:-translate-y-1">
            <div className="relative z-10 flex flex-col justify-center p-8 w-[65%] sm:w-[60%]">
              <p className="text-[#2a1115] text-sm md:text-base font-medium mb-1">
                Beneficios
              </p>
              <h4
                className="font-black text-[#5c0f1b] text-4xl md:text-[2.75rem] mb-3 leading-tight tracking-tight"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                CriptoTrufas
              </h4>
              <p className="text-base text-[#2a1115]/80 font-medium mb-6 leading-snug pr-4">
                Gana Puntos y obtén<br />
                descuentos exclusivos
              </p>
              <button
                id="hp-criptotrufa-btn"
                onClick={() => toast.info('Club CriptoTrufas próximamente activo.')}
                className="bg-[#ff9f43] hover:bg-[#ff8c00] text-[#2a1115] font-bold py-2.5 px-8 rounded-xl w-max shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer border-none"
              >
                Obtener
              </button>
            </div>
            <div className="absolute right-[-10%] bottom-[-15%] w-[55%] h-[120%] pointer-events-none">
              <img
                src="/truffle_sweetcoins.png"
                alt="CriptoTrufas"
                className="w-full h-full object-contain object-bottom drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1549007994-cb92ca7a4b2a?auto=format&fit=crop&q=80&w=400'
                }}
              />
            </div>
          </div>

          {/* ── Tarjeta 2: Personalización ── */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#f8f8f8] via-[#e8e8e8] to-[#c8c8c8] shadow-md min-h-[260px] flex group transition-transform hover:-translate-y-1">
            <div className="relative z-10 flex flex-col justify-center p-8 w-[65%] sm:w-[60%]">
              <p className="text-[#2a1115] text-sm md:text-base font-medium mb-1">
                Personalización
              </p>
              <h4
                className="font-black text-[#5c0f1b] text-4xl md:text-[2.75rem] mb-3 leading-tight tracking-tight"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Tu trufa perfecta
              </h4>
              <p className="text-base text-[#2a1115]/80 font-medium mb-6 leading-snug pr-4">
                Personaliza para una<br />
                ocasión especial
              </p>
              <button
                id="hp-personalizacion-btn"
                onClick={() => toast.info('Formulario de personalización en desarrollo.')}
                className="bg-[#ff9f43] hover:bg-[#ff8c00] text-[#2a1115] font-bold py-2.5 px-8 rounded-xl w-max shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer border-none"
              >
                Contáctanos
              </button>
            </div>
            <div className="absolute right-[-10%] bottom-[-15%] w-[55%] h-[120%] pointer-events-none">
              <img
                src="/truffle_custom.png"
                alt="Personalización"
                className="w-full h-full object-contain object-bottom drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1544966951-009c02dfc585?auto=format&fit=crop&q=80&w=400'
                }}
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
