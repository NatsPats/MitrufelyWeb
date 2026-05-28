/**
 * Button.tsx — Componente UI genérico reutilizable
 *
 * Shared primitive que reemplaza las antiguas clases hp-btn-*.
 * Variantes: primary | secondary | accent
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

// ─── Tipos ────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'accent'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
  fullWidth?: boolean
}

// ─── Estilos por variante ─────────────────────────────────────────────────

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: [
    'bg-[#5c0f1b] text-white',
    'hover:bg-[#7a1525] hover:-translate-y-px',
    'shadow-[0_4px_16px_rgba(92,15,27,0.25)] hover:shadow-[0_6px_20px_rgba(92,15,27,0.35)]',
  ].join(' '),

  secondary: [
    'bg-[#5c0f1b] text-white',
    'hover:bg-[#7a1525] hover:-translate-y-px',
  ].join(' '),

  accent: [
    'bg-[#ff7a45] text-white',
    'hover:bg-[#e86a35] hover:-translate-y-px',
    'shadow-[0_4px_14px_rgba(255,122,69,0.35)]',
  ].join(' '),
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-black rounded-full px-8 py-3.5 text-sm tracking-wide transition-all duration-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer border-none'

// ─── Componente ───────────────────────────────────────────────────────────

export function Button({
  variant = 'primary',
  fullWidth = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(BASE, VARIANT_CLASSES[variant], fullWidth && 'w-full', className)}
      {...rest}
    >
      {children}
    </button>
  )
}
