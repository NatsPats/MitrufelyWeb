import api from '@/lib/axios'

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface CartItemResponse {
  id_producto: number
  nombre: string
  cantidad: number
  precio_unitario: number
  imagen_url?: string | null
  es_paquete: boolean
  id_paquete?: number | null
  stock_actual?: number | null
}

export interface CartResponse {
  items: CartItemResponse[]
  total_items: number
  subtotal: number
  updated_at?: string | null
}

export interface CartCheckoutResponse {
  id_venta: number
  total: number
  estado: string
  estado_pago: string
  mensaje: string
}

export interface AddCartItemRequest {
  id_producto: number
  cantidad: number
  es_paquete?: boolean
  id_paquete?: number | null
}

export interface UpdateCartItemRequest {
  cantidad: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapCartResponse(raw: CartResponse): CartResponse {
  return {
    ...raw,
    subtotal: Number(raw.subtotal),
    items: (raw.items || []).map((item) => ({
      ...item,
      precio_unitario: Number(item.precio_unitario),
    })),
  }
}

function mapCheckoutResponse(raw: CartCheckoutResponse): CartCheckoutResponse {
  return {
    ...raw,
    total: Number(raw.total),
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const cartApi = {
  getCart: async (): Promise<CartResponse> => {
    const { data } = await api.get<CartResponse>('/cart')
    return mapCartResponse(data)
  },

  addItem: async (item: AddCartItemRequest): Promise<CartResponse> => {
    const { data } = await api.post<CartResponse>('/cart/items', item)
    return mapCartResponse(data)
  },

  updateItem: async (id_producto: number, body: UpdateCartItemRequest): Promise<CartResponse> => {
    const { data } = await api.put<CartResponse>(`/cart/items/${id_producto}`, body)
    return mapCartResponse(data)
  },

  removeItem: async (id_producto: number): Promise<CartResponse> => {
    const { data } = await api.delete<CartResponse>(`/cart/items/${id_producto}`)
    return mapCartResponse(data)
  },

  clearCart: async (): Promise<void> => {
    await api.delete('/cart')
  },

  checkoutCart: async (id_cupon_cliente?: number): Promise<CartCheckoutResponse> => {
    const { data } = await api.post<CartCheckoutResponse>('/ventas/checkout/cart', null, {
      params: id_cupon_cliente ? { id_cupon_cliente } : undefined,
    })
    return mapCheckoutResponse(data)
  },
}
