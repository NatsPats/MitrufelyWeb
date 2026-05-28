/**
 * mockData.ts — Datos de demostración del catálogo Mitrufely
 *
 * Siguiendo el principio OCP: cuando la API real esté lista, este módulo
 * se reemplaza o convierte en un hook useProducts() sin tocar los componentes.
 */
import type { Pack, TabItem, Trufa } from '../types'

// ─── Trufas ───────────────────────────────────────────────────────────────

export const TRUFAS_MOCK: readonly Trufa[] = [
  {
    id: 1,
    nombre: 'Trufa de Oreo',
    categoria: 'best_sellers',
    precio: 2.5,
    imagenUrl:
      'https://images.unsplash.com/photo-1548907040-4d42b52125e0?auto=format&fit=crop&q=80&w=400',
    descripcion:
      'Delicioso relleno de galleta Oreo triturada mezclada con suave queso crema, cubierto de una crujiente capa de chocolate blanco artesanal.',
    badge: '🔥 Popular',
  },
  {
    id: 2,
    nombre: 'Trufa Coco & Almendra',
    categoria: 'new_flavors',
    precio: 2.8,
    imagenUrl:
      'https://images.unsplash.com/photo-1544966951-009c02dfc585?auto=format&fit=crop&q=80&w=400',
    descripcion:
      'Relleno cremoso de coco rallado de la selva y almendras tostadas crujientes, bañado en finas hebras de chocolate con leche.',
    badge: '✨ Nuevo',
  },
  {
    id: 3,
    nombre: 'Trufa Belga Clásica',
    categoria: 'best_sellers',
    precio: 3.0,
    imagenUrl:
      'https://images.unsplash.com/photo-1511381939415-e44015469834?auto=format&fit=crop&q=80&w=400',
    descripcion:
      'Elaborada con auténtico cacao belga al 70%, espolvoreada con cacao en polvo premium para una experiencia amarga e inolvidable.',
    badge: '⭐ Premium',
  },
  {
    id: 4,
    nombre: 'Trufa Fresa Silvestre',
    categoria: 'promos',
    precio: 2.2,
    imagenUrl:
      'https://images.unsplash.com/photo-1604514281729-0ecbd2b75a13?auto=format&fit=crop&q=80&w=400',
    descripcion:
      'Una explosión de sabor a fresa natural infusionada en ganache de chocolate blanco y un toque de licor dulce artesanal.',
    badge: '🏷️ Oferta',
  },
  {
    id: 5,
    nombre: 'Trufa Avellana Crujiente',
    categoria: 'best_sellers',
    precio: 2.9,
    imagenUrl:
      'https://images.unsplash.com/photo-1575549594211-18c1e626e2e0?auto=format&fit=crop&q=80&w=400',
    descripcion:
      'Centro entero de avellana tostada cubierto de praliné de chocolate con leche y trozos de barquillo crujiente.',
  },
  {
    id: 6,
    nombre: 'Trufa Maracuyá & Jengibre',
    categoria: 'new_flavors',
    precio: 3.2,
    imagenUrl:
      'https://images.unsplash.com/photo-1549007994-cb92ca7a4b2a?auto=format&fit=crop&q=80&w=400',
    descripcion:
      'Exótica combinación tropical de maracuyá peruano con un toque cálido de jengibre fresco, envuelta en chocolate oscuro artesanal.',
    badge: '✨ Nuevo',
  },
  {
    id: 7,
    nombre: 'Trufa de Oreo',
    categoria: 'best_sellers',
    precio: 2.5,
    imagenUrl:
      'https://images.unsplash.com/photo-1548907040-4d42b52125e0?auto=format&fit=crop&q=80&w=400',
    descripcion:
      'Delicioso relleno de galleta Oreo triturada mezclada con suave queso crema, cubierto de una crujiente capa de chocolate blanco artesanal.',
    badge: '🔥 Popular',
  },
  {
    id: 8,
    nombre: 'Trufa Coco & Almendra',
    categoria: 'new_flavors',
    precio: 2.8,
    imagenUrl:
      'https://images.unsplash.com/photo-1544966951-009c02dfc585?auto=format&fit=crop&q=80&w=400',
    descripcion:
      'Relleno cremoso de coco rallado de la selva y almendras tostadas crujientes, bañado en finas hebras de chocolate con leche.',
    badge: '✨ Nuevo',
  },
  {
    id: 9,
    nombre: 'Trufa Belga Clásica',
    categoria: 'best_sellers',
    precio: 3.0,
    imagenUrl:
      'https://images.unsplash.com/photo-1511381939415-e44015469834?auto=format&fit=crop&q=80&w=400',
    descripcion:
      'Elaborada con auténtico cacao belga al 70%, espolvoreada con cacao en polvo premium para una experiencia amarga e inolvidable.',
    badge: '⭐ Premium',
  },
  {
    id: 10,
    nombre: 'Trufa Fresa Silvestre',
    categoria: 'promos',
    precio: 2.2,
    imagenUrl:
      'https://images.unsplash.com/photo-1604514281729-0ecbd2b75a13?auto=format&fit=crop&q=80&w=400',
    descripcion:
      'Una explosión de sabor a fresa natural infusionada en ganache de chocolate blanco y un toque de licor dulce artesanal.',
    badge: '🏷️ Oferta',
  },
  {
    id: 11,
    nombre: 'Trufa Avellana Crujiente',
    categoria: 'best_sellers',
    precio: 2.9,
    imagenUrl:
      'https://images.unsplash.com/photo-1575549594211-18c1e626e2e0?auto=format&fit=crop&q=80&w=400',
    descripcion:
      'Centro entero de avellana tostada cubierto de praliné de chocolate con leche y trozos de barquillo crujiente.',
  },
  {
    id: 12,
    nombre: 'Trufa Maracuyá & Jengibre',
    categoria: 'new_flavors',
    precio: 3.2,
    imagenUrl:
      'https://images.unsplash.com/photo-1549007994-cb92ca7a4b2a?auto=format&fit=crop&q=80&w=400',
    descripcion:
      'Exótica combinación tropical de maracuyá peruano con un toque cálido de jengibre fresco, envuelta en chocolate oscuro artesanal.',
    badge: '✨ Nuevo',
  },
] as const

// ─── Packs ────────────────────────────────────────────────────────────────

export const PACKS_MOCK: readonly Pack[] = [
  {
    id: 1,
    nombre: 'Detalle Especial',
    precio: 15.0,
    puntos: 1500,
    piezas: 6,
    descripcion:
      'Un gesto perfecto para cualquier celebración o para obsequiar a esa persona ideal. Seis trufas artesanales seleccionadas a mano con amor.',
    imagenUrl: '/pack_detalle.png',
  },
  {
    id: 2,
    nombre: 'Break de Estudio',
    precio: 25.0,
    puntos: 2500,
    piezas: 12,
    descripcion:
      'La dosis de energía extra que necesitas para tus jornadas de repaso. Doce trufas surtidas perfectas para compartir o consentirte tú solo.',
    imagenUrl: '/pack_estudio.png',
  },
  {
    id: 3,
    nombre: 'Colección Premium',
    precio: 35.0,
    puntos: 3500,
    piezas: 16,
    descripcion:
      'Nuestra obra maestra. 16 trufas premium elaboradas con ingredientes exóticos de lujo, cacao orgánico selecto y finos detalles decorativos.',
    imagenUrl: '/pack_premium.png',
  },
] as const

// ─── Tabs ─────────────────────────────────────────────────────────────────

export const CATALOG_TABS: readonly TabItem[] = [
  { key: 'best_sellers', label: 'Más vendidos' },
  { key: 'new_flavors', label: 'Nuevos sabores' },
  { key: 'promos', label: 'Promociones' },
] as const
