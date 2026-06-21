export interface DetalleVentaResponse {
  id_detalle: number
  id_venta: number
  id_producto: number
  cantidad: number
  precio_unitario: number
  subtotal: number
  nombre?: string | null
  imagen_url?: string | null
  nombre_producto?: string | null
  imagen_url_producto?: string | null
}

export interface DocumentoResponse {
  id_documento: number
  id_venta: number
  tipo_documento: 'BOLETA' | 'FACTURA' | 'REPORTE'
  numero_serie: string | null
  numero_correlativo: string | null
  url_archivo: string | null
  fecha_generacion: string
}

export interface MetodoPagoResponse {
  id_pago: number
  id_venta: number
  tipo_pago: 'TARJETA'
  monto: number
  codigo_transaccion: string | null
  proveedor: string | null
  estado_transaccion: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO'
  fecha_pago: string
}

export interface VentaPaqueteResponse {
  id_venta_paquete: number
  id_venta: number
  id_paquete: number
  cantidad: number
  nombre_paquete_snapshot: string
  composicion_snapshot_json: Record<string, any>
  fecha_registro: string
}

export type EstadoVenta = 
  | 'PENDIENTE' 
  | 'PAGADO' 
  | 'PREPARANDO' 
  | 'EN_CAMINO' 
  | 'ENTREGADO' 
  | 'CANCELADO' 
  | 'DEVUELTO' 
  | 'REEMBOLSADO' 
  | 'ANULADO'

export interface EventoTrackingItem {
  fecha: string
  evento: string
  descripcion: string
}

export interface TrackingResponse {
  id_venta: number
  estado: EstadoVenta
  progreso_pct: number
  eta: string | null
  delivery_completed_at: string | null
  eventos: EventoTrackingItem[]
}

export interface OrderEventResponse {
  id_event: number
  event_type: string
  description: string
  detail_json: Record<string, any> | null
  created_at: string
  created_by: number | null
}

export interface OrderRefundResponse {
  id_refund: number
  id_venta: number
  reason: string
  amount: number
  includes_shipping: boolean
  approved_by: number | null
  requested_by: number | null
  observations: string | null
  created_at: string
  approved_at: string | null
}

export interface VentaResponse {
  id_venta: number
  id_cliente: number
  estado: EstadoVenta
  estado_pago: 'PENDIENTE' | 'PAGADO'
  total: number
  puntos_ganados: number
  fecha_venta: string
  
  // Campos de desglose
  subtotal_productos?: number | null
  costo_envio?: number | null
  monto_descuento_cupon?: number | null
  base_imponible?: number | null
  igv?: number | null
  
  // M14: Envío y totales
  total_final?: number | null
  shipping_cost_applied?: number | null
  free_shipping_applied?: boolean | null

  // M14: Tracking
  delivery_eta?: string | null
  delivery_completed_at?: string | null

  // M14: Reseñas
  has_review?: boolean

  // M14: Cancelación y reembolso
  cancelled_at?: string | null
  cancellation_reason?: string | null
  refund_amount?: number | null
  refund_date?: string | null
  
  // Relaciones
  detalles?: DetalleVentaResponse[] | null
  paquetes_vendidos?: VentaPaqueteResponse[] | null
  metodos_pago?: MetodoPagoResponse[] | null
  documentos?: DocumentoResponse[] | null
}

export interface VentaDetalladaResponse extends VentaResponse {
  order_events?: OrderEventResponse[] | null
  order_refund?: OrderRefundResponse | null
  progreso_pct?: number | null
}

// ── Peticiones de Transición (M14) ──

export interface TransicionEstadoRequest {
  motivo: string
  observaciones?: string | null
}

export interface ReembolsoRequest {
  monto: number
  motivo: string
  observaciones?: string | null
  id_solicitante?: number | null
}
