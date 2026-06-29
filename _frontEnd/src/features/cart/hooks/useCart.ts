import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cartApi } from '../api/cartApi'
import type { AddCartItemRequest, CartCheckoutResponse } from '../api/cartApi'

export const CART_QUERY_KEY = ['cart'] as const

// ─── Query ───────────────────────────────────────────────────────────────────

export function useCartQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: () => cartApi.getCart(),
    staleTime: 30_000,
    ...options,
  })
}

// ─── Selector helpers ────────────────────────────────────────────────────────

export function useCartItemCount(): number {
  const { data } = useCartQuery()
  return data?.total_items ?? 0
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useAddCartItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (item: AddCartItemRequest) => cartApi.addItem(item),
    onSuccess: (data) => {
      queryClient.setQueryData(CART_QUERY_KEY, data)
      toast.success('Producto agregado al carrito 🛍️', { duration: 2000 })
    },
    onError: () => {
      toast.error('No se pudo agregar al carrito.')
    },
  })
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id_producto, cantidad }: { id_producto: number; cantidad: number }) =>
      cartApi.updateItem(id_producto, { cantidad }),
    onSuccess: (data) => {
      queryClient.setQueryData(CART_QUERY_KEY, data)
    },
    onError: () => {
      toast.error('No se pudo actualizar la cantidad.')
    },
  })
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id_producto: number) => cartApi.removeItem(id_producto),
    onSuccess: (data) => {
      queryClient.setQueryData(CART_QUERY_KEY, data)
      toast.info('Producto eliminado del carrito.')
    },
    onError: () => {
      toast.error('No se pudo eliminar del carrito.')
    },
  })
}

export function useClearCart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => cartApi.clearCart(),
    onSuccess: () => {
      queryClient.setQueryData(CART_QUERY_KEY, { items: [], total_items: 0, subtotal: 0 })
      toast.info('Carrito vaciado.')
    },
    onError: () => {
      toast.error('No se pudo vaciar el carrito.')
    },
  })
}

export function useCheckoutCart() {
  const queryClient = useQueryClient()

  return useMutation<CartCheckoutResponse, Error, number | undefined>({
    mutationFn: (id_cupon_cliente?: number) => cartApi.checkoutCart(id_cupon_cliente),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
