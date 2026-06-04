/**
 * mockProducts.ts — Datos estáticos de prueba para el Catálogo.
 *
 * Regla de negocio crítica (SK-13):
 *   disponible = true  SOLO SI  estado === true  AND  stock_actual > 0
 *
 * Respeta la interfaz PaginatedResponse<Producto> definida en features/products/types.ts
 */

import type { Producto, PaginatedResponse } from '@/features/products/types'

// ─── Helper para calcular disponible según la regla de negocio ─────────────────
const calcDisponible = (estado: boolean, stock_actual: number): boolean =>
  estado === true && stock_actual > 0

// ─── Catálogo de 20 trufas ─────────────────────────────────────────────────────
const rawProducts: Omit<Producto, 'disponible'>[] = [
  {
    id_producto: 1,
    id_categoria: 1,
    nombre: 'Trufa de Oreo',
    descripcion:
      'Irresistible trufa de chocolate negro con relleno de galleta Oreo triturada y crema. Cubierta con cobertura de chocolate blanco.',
    ingredientes: 'Chocolate negro 70%, galleta Oreo, crema de leche, mantequilla',
    alergenos: 'Gluten, lácteos, soya',
    peso_gramos: 25,
    precio: 5.5,
    stock_minimo: 10,
    stock_actual: 48,
    imagen_url:
      'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-oreo',
    estado: true,
    slug: 'trufa-de-oreo',
    fecha_creacion: '2025-01-15T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 2,
    id_categoria: 1,
    nombre: 'Trufa de Maracuyá',
    descripcion:
      'Trufa tropical de maracuyá con cobertura de chocolate blanco. El contraste ácido-dulce la hace única.',
    ingredientes: 'Chocolate blanco, pulpa de maracuyá, crema de leche, mantequilla',
    alergenos: 'Lácteos, soya',
    peso_gramos: 25,
    precio: 6.0,
    stock_minimo: 8,
    stock_actual: 32,
    imagen_url:
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-maracuya',
    estado: true,
    slug: 'trufa-de-maracuya',
    fecha_creacion: '2025-01-16T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 3,
    id_categoria: 1,
    nombre: 'Trufa de Café',
    descripcion:
      'Para los amantes del café. Ganache de café espresso con cobertura de chocolate amargo y acabado en polvo de cacao.',
    ingredientes: 'Chocolate amargo 85%, espresso, crema de leche, mantequilla',
    alergenos: 'Lácteos, soya',
    peso_gramos: 25,
    precio: 5.5,
    stock_minimo: 10,
    stock_actual: 0,
    imagen_url:
      'https://images.unsplash.com/photo-1511381939415-e44015466834?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-cafe',
    estado: true,
    slug: 'trufa-de-cafe',
    fecha_creacion: '2025-01-17T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 4,
    id_categoria: 1,
    nombre: 'Trufa de Frambuesa',
    descripcion:
      'Delicada trufa con ganache de frambuesa fresca y cobertura de chocolate rosé. Perfecta para regalar.',
    ingredientes: 'Chocolate ruby, frambuesa, crema de leche, azúcar',
    alergenos: 'Lácteos, soya',
    peso_gramos: 25,
    precio: 6.5,
    stock_minimo: 8,
    stock_actual: 20,
    imagen_url:
      'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-frambuesa',
    estado: true,
    slug: 'trufa-de-frambuesa',
    fecha_creacion: '2025-02-01T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 5,
    id_categoria: 2,
    nombre: 'Trufa Sin Azúcar de Almendra',
    descripcion:
      'Versión sin azúcar endulzada con eritritol. Relleno de pasta de almendra natural con cobertura de cacao 100%.',
    ingredientes: 'Cacao 100%, pasta de almendra, eritritol, crema sin lactosa',
    alergenos: 'Frutos secos (almendra)',
    peso_gramos: 25,
    precio: 7.0,
    stock_minimo: 5,
    stock_actual: 15,
    imagen_url:
      'https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-sa-almendra',
    estado: true,
    slug: 'trufa-sin-azucar-de-almendra',
    fecha_creacion: '2025-02-10T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 6,
    id_categoria: 2,
    nombre: 'Trufa Sin Azúcar de Coco',
    descripcion:
      'Trufa keto amigable con leche de coco, cacao puro y endulzada con stevia. Opción saludable sin sacrificar sabor.',
    ingredientes: 'Cacao 85%, leche de coco, stevia, aceite de coco',
    alergenos: 'Ninguno declarado',
    peso_gramos: 25,
    precio: 7.0,
    stock_minimo: 5,
    stock_actual: 12,
    imagen_url:
      'https://images.unsplash.com/photo-1599599810694-b5b37304c041?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-sa-coco',
    estado: true,
    slug: 'trufa-sin-azucar-de-coco',
    fecha_creacion: '2025-02-15T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 7,
    id_categoria: 3,
    nombre: 'Trufa de Pistacho',
    descripcion:
      'Exclusiva trufa de pistacho iraní de primera calidad. Ganache verde con cobertura de chocolate blanco.',
    ingredientes: 'Chocolate blanco, pasta de pistacho, crema de leche',
    alergenos: 'Frutos secos (pistacho), lácteos',
    peso_gramos: 30,
    precio: 8.5,
    stock_minimo: 5,
    stock_actual: 8,
    imagen_url:
      'https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-pistacho',
    estado: true,
    slug: 'trufa-de-pistacho',
    fecha_creacion: '2025-03-01T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 8,
    id_categoria: 1,
    nombre: 'Trufa de Menta',
    descripcion:
      'Clásica trufa de chocolate negro con esencia de menta fresca. Acabado en polvo de cacao y virutas de menta cristalizada.',
    ingredientes: 'Chocolate negro 70%, extracto de menta, crema de leche',
    alergenos: 'Lácteos, soya',
    peso_gramos: 25,
    precio: 5.5,
    stock_minimo: 10,
    stock_actual: 25,
    imagen_url:
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-menta',
    estado: true,
    slug: 'trufa-de-menta',
    fecha_creacion: '2025-01-20T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 9,
    id_categoria: 1,
    nombre: 'Trufa de Caramelo Salado',
    descripcion:
      'Tendencia gourmet: ganache de caramelo salado con fleur de sel. Cobertura de chocolate con leche.',
    ingredientes: 'Chocolate con leche, azúcar, crema de leche, mantequilla, fleur de sel',
    alergenos: 'Lácteos, soya',
    peso_gramos: 25,
    precio: 6.0,
    stock_minimo: 8,
    stock_actual: 30,
    imagen_url:
      'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-caramelo-salado',
    estado: true,
    slug: 'trufa-de-caramelo-salado',
    fecha_creacion: '2025-01-25T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 10,
    id_categoria: 4,
    nombre: 'Trufa San Valentín Edición Especial',
    descripcion:
      'Trufa edición limitada de San Valentín. Relleno de frambuesa y rosas, decorada a mano con corazones comestibles dorados.',
    ingredientes: 'Chocolate ruby, frambuesa, agua de rosas, crema de leche',
    alergenos: 'Lácteos, soya',
    peso_gramos: 30,
    precio: 9.0,
    stock_minimo: 3,
    stock_actual: 5,
    imagen_url:
      'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-san-valentin',
    estado: true,
    slug: 'trufa-san-valentin-edicion-especial',
    fecha_creacion: '2025-01-28T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 11,
    id_categoria: 1,
    nombre: 'Trufa de Avellana',
    descripcion:
      'Inspirada en el sabor Ferrero. Ganache de praliné de avellana con cobertura de chocolate con leche y trozos de avellana.',
    ingredientes: 'Chocolate con leche, pasta de avellana, azúcar, avellanas tostadas',
    alergenos: 'Frutos secos (avellana), lácteos, soya',
    peso_gramos: 28,
    precio: 6.5,
    stock_minimo: 8,
    stock_actual: 22,
    imagen_url:
      'https://images.unsplash.com/photo-1511381939415-e44015466834?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-avellana',
    estado: true,
    slug: 'trufa-de-avellana',
    fecha_creacion: '2025-02-05T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 12,
    id_categoria: 2,
    nombre: 'Trufa Sin Azúcar de Maní',
    descripcion:
      'Opción saludable con mantequilla de maní natural, sin azúcar añadida. Apta para dietas bajas en carbohidratos.',
    ingredientes: 'Cacao 90%, mantequilla de maní, eritritol, stevia',
    alergenos: 'Cacahuetes (maní)',
    peso_gramos: 25,
    precio: 6.5,
    stock_minimo: 5,
    stock_actual: 18,
    imagen_url:
      'https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-sa-mani',
    estado: true,
    slug: 'trufa-sin-azucar-de-mani',
    fecha_creacion: '2025-02-20T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 13,
    id_categoria: 1,
    nombre: 'Trufa de Limón',
    descripcion:
      'Refrescante trufa de limón de Sorrento. Ganache ácido con cobertura de chocolate blanco y zest de limón.',
    ingredientes: 'Chocolate blanco, jugo de limón, zest de limón, crema de leche',
    alergenos: 'Lácteos, soya',
    peso_gramos: 25,
    precio: 5.5,
    stock_minimo: 8,
    stock_actual: 0,
    imagen_url:
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-limon',
    estado: false, // Soft deleted
    slug: 'trufa-de-limon',
    fecha_creacion: '2025-01-10T10:00:00Z',
    fecha_actualizacion: '2025-05-20T08:30:00Z',
  },
  {
    id_producto: 14,
    id_categoria: 3,
    nombre: 'Trufa de Champán',
    descripcion:
      'Sofisticada trufa de champán Moët con cobertura de chocolate blanco y polvo de oro comestible. Ideal para celebraciones.',
    ingredientes: 'Chocolate blanco, champán, crema de leche, mantequilla',
    alergenos: 'Lácteos, soya, sulfitos',
    peso_gramos: 30,
    precio: 10.0,
    stock_minimo: 3,
    stock_actual: 7,
    imagen_url:
      'https://images.unsplash.com/photo-1599599810694-b5b37304c041?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-champan',
    estado: true,
    slug: 'trufa-de-champan',
    fecha_creacion: '2025-03-10T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 15,
    id_categoria: 4,
    nombre: 'Trufa Navideña de Jengibre',
    descripcion:
      'Edición navideña con ganache de jengibre y canela. Decorada con detalles festivos en chocolate blanco y rojo.',
    ingredientes: 'Chocolate negro, jengibre, canela, crema de leche, clavo',
    alergenos: 'Lácteos',
    peso_gramos: 28,
    precio: 7.5,
    stock_minimo: 5,
    stock_actual: 14,
    imagen_url:
      'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-navidad-jengibre',
    estado: true,
    slug: 'trufa-navidena-de-jengibre',
    fecha_creacion: '2025-11-01T10:00:00Z',
    fecha_actualizacion: '2025-12-01T08:30:00Z',
  },
  {
    id_producto: 16,
    id_categoria: 2,
    nombre: 'Trufa Sin Azúcar de Vainilla',
    descripcion:
      'Pura vainilla de Madagascar en ganache suave sin azúcar. Cobertura de chocolate 85% sin lactosa.',
    ingredientes: 'Cacao 85%, vainilla bourbon, eritritol, leche de almendra',
    alergenos: 'Frutos secos (almendra)',
    peso_gramos: 25,
    precio: 7.0,
    stock_minimo: 5,
    stock_actual: 10,
    imagen_url:
      'https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-sa-vainilla',
    estado: true,
    slug: 'trufa-sin-azucar-de-vainilla',
    fecha_creacion: '2025-03-05T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 17,
    id_categoria: 1,
    nombre: 'Trufa de Brownie',
    descripcion:
      'Doble impacto de chocolate: trufa de ganache oscuro con pedacitos de brownie crocante en su interior.',
    ingredientes: 'Chocolate negro 75%, brownie casero, crema de leche, mantequilla',
    alergenos: 'Gluten, lácteos, huevo, soya',
    peso_gramos: 30,
    precio: 6.5,
    stock_minimo: 10,
    stock_actual: 35,
    imagen_url:
      'https://images.unsplash.com/photo-1511381939415-e44015466834?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-brownie',
    estado: true,
    slug: 'trufa-de-brownie',
    fecha_creacion: '2025-01-18T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 18,
    id_categoria: 3,
    nombre: 'Trufa de Matcha Premium',
    descripcion:
      'Trufa con polvo de matcha ceremonial japonés Grado A. Ganache equilibrado amargo-dulce con cobertura blanca.',
    ingredientes: 'Chocolate blanco, matcha ceremonial, crema de leche, azúcar de caña',
    alergenos: 'Lácteos',
    peso_gramos: 28,
    precio: 9.0,
    stock_minimo: 5,
    stock_actual: 9,
    imagen_url:
      'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-matcha',
    estado: true,
    slug: 'trufa-de-matcha-premium',
    fecha_creacion: '2025-03-15T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 19,
    id_categoria: 4,
    nombre: 'Trufa Graduación Personalizada',
    descripcion:
      'Trufa especial de graduación decorada con el nombre del graduado y colores a elegir. Pedido mínimo 12 unidades.',
    ingredientes: 'Chocolate belga, crema de leche, mantequilla, colorante alimentario',
    alergenos: 'Lácteos, soya',
    peso_gramos: 30,
    precio: 12.0,
    stock_minimo: 0,
    stock_actual: 50,
    imagen_url:
      'https://images.unsplash.com/photo-1599599810694-b5b37304c041?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-graduacion',
    estado: true,
    slug: 'trufa-graduacion-personalizada',
    fecha_creacion: '2025-04-01T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
  {
    id_producto: 20,
    id_categoria: 1,
    nombre: 'Trufa de Whisky',
    descripcion:
      'Para adultos: ganache de whisky escocés single malt con cobertura de chocolate negro. Sabor intenso y ahumado.',
    ingredientes: 'Chocolate negro 80%, whisky Glenfiddich, crema de leche',
    alergenos: 'Lácteos, alcohol',
    peso_gramos: 25,
    precio: 8.0,
    stock_minimo: 5,
    stock_actual: 11,
    imagen_url:
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80',
    cloudinary_public_id: 'mitrufely/products/trufa-whisky',
    estado: true,
    slug: 'trufa-de-whisky',
    fecha_creacion: '2025-04-10T10:00:00Z',
    fecha_actualizacion: '2025-06-01T08:30:00Z',
  },
]

// ─── Inyectar el campo `disponible` calculado según regla de negocio ────────────
export const MOCK_PRODUCTS: Producto[] = rawProducts.map((p) => ({
  ...p,
  disponible: calcDisponible(p.estado, p.stock_actual),
}))

// ─── Respuesta paginada completa ────────────────────────────────────────────────
export const MOCK_PAGINATED_RESPONSE: PaginatedResponse<Producto> = {
  items: MOCK_PRODUCTS,
  page: 1,
  size: 20,
  total: MOCK_PRODUCTS.length,
  pages: 1,
}

/**
 * Simula un filtro por categoría (id_categoria) sobre los mocks.
 * Devuelve siempre un PaginatedResponse<Producto> paginado.
 */
export function getMockProductsByCategory(
  categoryId: number | null,
  page = 1,
  size = 8,
): PaginatedResponse<Producto> {
  const filtered =
    categoryId === null
      ? MOCK_PRODUCTS
      : MOCK_PRODUCTS.filter((p) => p.id_categoria === categoryId)

  const total = filtered.length
  const pages = Math.ceil(total / size)
  const start = (page - 1) * size
  const items = filtered.slice(start, start + size)

  return { items, page, size, total, pages }
}
