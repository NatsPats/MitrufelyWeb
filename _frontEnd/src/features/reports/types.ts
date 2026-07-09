/**
 * Tipos del módulo de Reportes (Fase 7).
 * Espejo de los schemas Pydantic del backend `app/modules/reports/schemas.py`.
 */

export type ReporteTipo =
  | 'ventas'
  | 'pedidos'
  | 'catalogo'
  | 'inventario'
  | 'usuarios'
  | 'fidelizacion'

export interface ReporteFiltros {
  fecha_desde?: string | undefined
  fecha_hasta?: string | undefined
  estado?: string | undefined
  estado_pago?: string | undefined
  search?: string | undefined
}

// ── Ventas ────────────────────────────────────────────────────────────────────

export interface ReporteVentasItem {
  id_venta: number
  fecha_venta: string
  cliente: string
  estado: string
  estado_pago: string
  subtotal_productos: string
  base_imponible: string
  igv: string
  total: string
  metodo_pago: string | null
  monto_descuento_cupon?: string | null
  id_cupon_cliente?: number | null
  cupon_codigo?: string | null
}

export interface ReporteVentasResponse {
  items: ReporteVentasItem[]
  total_ventas: string
  cantidad_pedidos: number
  ticket_promedio: string
}

// ── Pedidos ───────────────────────────────────────────────────────────────────

export interface ReportePedidosItem {
  id_venta: number
  cliente: string
  estado: string
  estado_pago: string
  fecha_venta: string
  delivery_completed_at: string | null
  total_final: string
}

export interface ReportePedidosResponse {
  items: ReportePedidosItem[]
  por_estado: Record<string, number>
  total_pedidos: number
}

// ── Catálogo ──────────────────────────────────────────────────────────────────

export interface ReporteCatalogoItem {
  id_producto: number
  nombre: string
  categoria: string | null
  precio: string
  stock_actual: number
  stock_minimo: number
  estado: boolean
}

export interface ReporteCatalogoResponse {
  items: ReporteCatalogoItem[]
  total_productos: number
  productos_activos: number
  productos_inactivos: number
}

// ── Inventario ────────────────────────────────────────────────────────────────

export type EstadoStock = 'DISPONIBLE' | 'BAJO' | 'AGOTADO'

export interface ReporteInventarioItem {
  id_producto: number
  nombre: string
  categoria: string | null
  stock_actual: number
  stock_minimo: number
  estado_stock: EstadoStock
  valorizacion: string
}

export interface ReporteInventarioResponse {
  items: ReporteInventarioItem[]
  total_productos: number
  productos_bajo_stock: number
  productos_agotados: number
  valor_inventario: string
}

// ── Usuarios ──────────────────────────────────────────────────────────────────

export interface ReporteUsuariosItem {
  id_usuario: number
  nombres: string
  apellidos: string
  email: string
  rol: string
  estado: boolean
  auth_provider: string
  total_ventas?: number
  ultima_actividad?: string | null
}

export interface ReporteUsuariosResponse {
  items: ReporteUsuariosItem[]
  total_usuarios: number
  activos: number
  inactivos: number
}

// ── Fidelización ──────────────────────────────────────────────────────────────

export interface ReporteFidelizacionItem {
  id_cliente: number
  cliente: string
  email: string
  saldo_puntos: number
  puntos_usados: number
  cupones_disponibles: number
  cupones_usados: number
}

export interface ReporteFidelizacionResponse {
  items: ReporteFidelizacionItem[]
  total_clientes: number
  puntos_circulacion: number
  cupones_disponibles_total: number
}

// Unión conveniente para genéricos
export type ReporteResponseMap = {
  ventas: ReporteVentasResponse
  pedidos: ReportePedidosResponse
  catalogo: ReporteCatalogoResponse
  inventario: ReporteInventarioResponse
  usuarios: ReporteUsuariosResponse
  fidelizacion: ReporteFidelizacionResponse
}
