/**
 * cart.store.ts — Estado local del Carrito (cupón/descuento).
 *
 * Los items del carrito se gestionan vía React Query (useCart) contra Redis.
 * Este store solo maneja el cupón de descuento (lógica 100% cliente).
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { CuponCliente } from '@/stores/criptotrufa.store'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type CouponCode = 'TRUFA20'

const VALID_COUPONS: Record<CouponCode, number> = {
  TRUFA20: 5.0,
}

// ─── State / Actions ─────────────────────────────────────────────────────────

interface CartState {
  coupon: string | null
  discount: number
  fidelizacionCoupon: CuponCliente | null
}

interface CartActions {
  applyCoupon: (code: string, subtotal: number) => { success: boolean; message: string }
  applyFidelizacionCoupon: (coupon: CuponCliente | null, items: any[]) => void
  removeCoupon: () => void
  clearDiscount: () => void
}

export type CartStore = CartState & CartActions

// ─── Store ──────────────────────────────────────────────────────────────────

export const useCartStore = create<CartStore>()(
  immer((set) => ({
    coupon: null,
    discount: 0,
    fidelizacionCoupon: null,

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
        state.fidelizacionCoupon = null // Resetea cupón de fidelización si se aplica uno manual
      })

      return {
        success: true,
        message: `Cupón "${normalized}" aplicado. Descuento: S/ ${Number(discountAmount || 0).toFixed(2)}`,
      }
    },

    applyFidelizacionCoupon: (coupon, items) => {
      if (!coupon) {
        set((state) => {
          state.fidelizacionCoupon = null
          state.discount = 0
          state.coupon = null
        })
        return
      }

      const porcentaje = Number(coupon.cupon_maestro.porcentaje_descuento)
      const idCatRestr = coupon.cupon_maestro.id_categoria

      let subtotalElegible = 0
      if (idCatRestr !== null && idCatRestr !== undefined) {
        // 1. Productos individuales que coinciden con la categoría
        const subtotalIndividuales = items
          .filter((item: any) => !item.es_paquete && item.id_categoria === idCatRestr)
          .reduce((sum: number, item: any) => sum + Number(item.precio_unitario) * item.cantidad, 0)

        // 2. Componentes de paquetes que coinciden con la categoría
        const subtotalPaquetes = items
          .filter((item: any) => item.es_paquete)
          .reduce((sum: number, item: any) => {
            const sumComponentes = (item.productos || [])
              .filter((comp: any) => comp.id_categoria === idCatRestr)
              .reduce((compSum: number, comp: any) => compSum + Number(comp.precio_unitario) * comp.cantidad, 0)
            return sum + sumComponentes * item.cantidad
          }, 0)

        subtotalElegible = subtotalIndividuales + subtotalPaquetes
      } else {
        subtotalElegible = items.reduce(
          (sum: number, item: any) => sum + Number(item.precio_unitario) * item.cantidad,
          0
        )
      }

      const discountAmount = Math.round(subtotalElegible * (porcentaje / 100) * 100) / 100

      set((state) => {
        state.fidelizacionCoupon = coupon
        state.coupon = coupon.codigo_unico
        state.discount = discountAmount
      })
    },

    removeCoupon: () => {
      set((state) => {
        state.coupon = null
        state.discount = 0
        state.fidelizacionCoupon = null
      })
    },

    clearDiscount: () => {
      set((state) => {
        state.coupon = null
        state.discount = 0
        state.fidelizacionCoupon = null
      })
    },
  })),
)
