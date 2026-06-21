/**
 * cart.store.ts — Estado local del Carrito (cupón/descuento).
 *
 * Los items del carrito se gestionan vía React Query (useCart) contra Redis.
 * Este store solo maneja el cupón de descuento (lógica 100% cliente).
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type CouponCode = 'TRUFA20'

const VALID_COUPONS: Record<CouponCode, number> = {
  TRUFA20: 5.0,
}

// ─── State / Actions ─────────────────────────────────────────────────────────

interface CartState {
  coupon: string | null
  discount: number
}

interface CartActions {
  applyCoupon: (code: string, subtotal: number) => { success: boolean; message: string }
  removeCoupon: () => void
  clearDiscount: () => void
}

export type CartStore = CartState & CartActions

// ─── Store ──────────────────────────────────────────────────────────────────

export const useCartStore = create<CartStore>()(
  immer((set) => ({
    coupon: null,
    discount: 0,

    applyCoupon: (code, subtotal) => {
      const normalized = code.trim().toUpperCase() as CouponCode
      const discountAmount = VALID_COUPONS[normalized]

      if (!discountAmount) {
        return { success: false, message: 'Cupón inválido o no existe.' }
      }

      if (discountAmount > subtotal) {
        return {
          success: false,
          message: 'El cupón supera el monto de la compra.',
        }
      }

      set((state) => {
        state.coupon = normalized
        state.discount = discountAmount
      })

      return {
        success: true,
        message: `Cupón "${normalized}" aplicado. Descuento: S/ ${Number(discountAmount || 0).toFixed(2)}`,
      }
    },

    removeCoupon: () => {
      set((state) => {
        state.coupon = null
        state.discount = 0
      })
    },

    clearDiscount: () => {
      set((state) => {
        state.coupon = null
        state.discount = 0
      })
    },
  })),
)
