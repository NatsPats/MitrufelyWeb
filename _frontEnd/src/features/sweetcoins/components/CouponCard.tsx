/**
 * CouponCard.tsx — Tarjeta de cupón propio del cliente (cuponesCliente).
 *
 * Hover (solo tarjetas activas):
 *   - Elevación: translateY(-8px) via framer-motion whileHover
 *   - Sombra: CSS transition de shadow suave → profunda
 *   - Franja: gradient más intenso via CSS group-hover
 *   - Bloque código: fondo más oscuro via CSS hover
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Tag, Clock, CheckCircle, XCircle } from 'lucide-react'
import type { CuponCliente } from '@/stores/criptotrufa.store'

interface CouponCardProps {
  coupon: CuponCliente
  index?: number
}

const ORIGEN_LABELS: Record<CuponCliente['origen'], string> = {
  COMPRA_PUNTOS: 'Canjeado',
  REGALO_ADMIN:  'Regalo',
  PREMIO_JUEGO:  '🏆 Premio',
  REGISTRO_NUEVO:'Bienvenida',
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(iso))
}

function isExpired(iso: string) {
  return new Date(iso) < new Date()
}

export function CouponCard({ coupon, index = 0 }: CouponCardProps) {
  const expired = isExpired(coupon.fecha_expiracion) || coupon.estado === 'EXPIRADO'
  const used    = coupon.estado === 'USADO'
  const active  = !expired && !used

  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: 'spring', damping: 22, stiffness: 90 }}
      whileHover={active ? { y: -10, scale: 1.03 } : {}}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={()   => setHovered(false)}
      style={{
        willChange: 'transform',
        boxShadow: hovered && active
          ? '0 24px 56px rgba(92,15,27,0.22), 0 10px 24px rgba(92,15,27,0.15)'
          : '0 4px 20px rgba(92,15,27,0.10)',
        transition: 'box-shadow 0.3s ease',
      }}
      className={`relative overflow-hidden rounded-[22px] flex flex-col min-w-[220px] ${
        active ? 'bg-white cursor-pointer' : 'bg-stone-50 opacity-60'
      }`}
    >
      {/* ── Franja superior — cambia de color en hover ── */}
      <div
        style={{
          background: hovered && active
            ? 'linear-gradient(to right, #7a1525, #c0292e)'
            : active
              ? 'linear-gradient(to right, #5c0f1b, #8a1a2e)'
              : '#d6d3d1',
          transition: 'background 0.35s ease',
          padding: '16px 20px',
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-white font-black"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2rem', lineHeight: 1 }}
          >
            {coupon.cupon_maestro.porcentaje_descuento}%
          </span>
          <span
            style={{
              color: hovered && active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)',
              transition: 'color 0.3s ease',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            OFF
          </span>
        </div>
        <p className="text-white/80 text-xs font-semibold mt-1 line-clamp-1">
          {coupon.cupon_maestro.nombre}
        </p>
      </div>

      {/* ── Separador perforado ── */}
      <div className="flex items-center px-4 py-2 gap-2">
        <div className="h-3 w-3 rounded-full bg-[#faf8f5] -ml-6 shrink-0" />
        <div className="flex-1 border-t-2 border-dashed border-stone-100" />
        <div className="h-3 w-3 rounded-full bg-[#faf8f5] -mr-6 shrink-0" />
      </div>

      {/* ── Código + meta ── */}
      <div className="px-5 pb-5 flex flex-col gap-2.5">
        {/* Bloque código: cambia fondo en hover */}
        <div
          style={{
            backgroundColor: hovered && active ? '#ede8e4' : '#faf8f5',
            transition: 'background-color 0.25s ease',
            borderRadius: '0.75rem',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Tag className="h-3.5 w-3.5 text-[#5c0f1b]/50 shrink-0" />
          <span
            className="font-black text-[#5c0f1b] tracking-wider text-sm"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            {coupon.codigo_unico}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#2a1115]/45">
            {ORIGEN_LABELS[coupon.origen]}
          </span>
          <div
            className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded-full ${
              active
                ? 'text-emerald-700 bg-emerald-50'
                : used
                  ? 'text-stone-500 bg-stone-100'
                  : 'text-red-600 bg-red-50'
            }`}
          >
            {active
              ? <CheckCircle className="h-3 w-3" />
              : <XCircle className="h-3 w-3" />}
            {active ? 'Disponible' : used ? 'Usado' : 'Expirado'}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[#2a1115]/40 font-semibold">
          <Clock className="h-3 w-3" />
          <span>Vence: {formatDate(coupon.fecha_expiracion)}</span>
        </div>
      </div>

      {/* ── Brillo naranja esquina superior derecha (solo activos en hover) ── */}
      <div
        className="absolute top-0 right-0 w-20 h-20 pointer-events-none rounded-tr-[22px]"
        style={{
          background: 'radial-gradient(circle at top right, rgba(255,122,69,0.2) 0%, transparent 70%)',
          opacity: hovered && active ? 1 : 0,
          transition: 'opacity 0.35s ease',
        }}
      />
    </motion.div>
  )
}
