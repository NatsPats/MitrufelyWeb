import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina clases CSS con soporte completo de Tailwind.
 * Usa clsx para condicionales y tailwind-merge para resolver conflictos.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un número como moneda peruana (PEN).
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Formatea una fecha ISO a formato legible en español.
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(new Date(date))
}

/**
 * Formatea una fecha ISO a formato largo con hora.
 */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Calcula días restantes hasta una fecha (útil para FEFO).
 */
export function daysUntil(date: string | Date): number {
  const now = new Date()
  const target = new Date(date)
  const diffMs = target.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Genera iniciales de un nombre para avatares.
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
}

/**
 * Trunca un string si supera maxLength caracteres.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return `${str.slice(0, maxLength)}…`
}
