/**
 * criptotrufa.store.ts — Store global de CriptoTrufa (Sistema de Fidelización).
 * Conexión real con el Backend de FastAPI e implementaciones de Optimistic UI.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import api from '@/lib/axios'
import { toast } from 'sonner'

// ─── Enums ────────────────────────────────────────────────────────────────────

export type EstadoCuponEnum = 'DISPONIBLE' | 'USADO' | 'EXPIRADO'
export type OrigenCuponEnum = 'COMPRA_PUNTOS' | 'REGALO_ADMIN' | 'PREMIO_JUEGO' | 'REGISTRO_NUEVO'
export type TipoMovimientoPuntosEnum =
  | 'ACUMULACION_VENTA'
  | 'COMPRA_CUPON'
  | 'AJUSTE_ADMIN'
  | 'EXPIRACION'
  | 'PAGO_JUEGO'
  | 'PREMIO_JUEGO'

// ─── Interfaces TypeScript (basadas en Schemas Pydantic del Backend) ─────────

export interface CuponMaestro {
  id_cupon: number
  id_categoria: number | null
  nombre: string
  descripcion: string | null
  porcentaje_descuento: number
  costo_puntos: number | null
  dias_vigencia: number
  estado: boolean
}

export interface CuponCliente {
  id_cupon_cliente: number
  id_cliente: number
  id_cupon: number
  codigo_unico: string
  estado: EstadoCuponEnum
  origen: OrigenCuponEnum
  fecha_adquisicion: string
  fecha_expiracion: string
  fecha_uso: string | null
  cupon_maestro: CuponMaestro
}

export interface MovimientoPuntos {
  id_movimiento_punto: number
  id_cliente: number
  tipo_movimiento: TipoMovimientoPuntosEnum
  cantidad: number
  saldo_puntos_resultante: number
  fecha_movimiento: string
  justificacion: string | null
}

export type RuletaResultadoTipo = 'mala_suerte' | 'puntos_extra' | 'cupon_sorpresa' | null

export interface RuletaResultado {
  tipo: RuletaResultadoTipo
  mensaje: string
  puntosGanados: number
}

// ─── Estado del store ─────────────────────────────────────────────────────────

interface CriptoTrufaState {
  // Datos
  saldoActual: number
  cuponesCliente: CuponCliente[]
  cuponesMaestro: CuponMaestro[]
  historialMovimientos: MovimientoPuntos[]
  loading: boolean
  publicConfig: { tasa_conversion: number } | null

  // UI
  ruletaGirando: boolean
  ruletaResultado: RuletaResultado | null

  // Acciones
  hydrateSweetCoins: () => Promise<void>
  fetchAvailableCoupons: () => Promise<void>
  canjearCupon: (id_cupon: number) => Promise<{ success: boolean; message: string }>
  jugarRuleta: () => void
  dismissRuletaResultado: () => void
}



function normalizarCuponCliente(c: any): CuponCliente {
  if (!c) return c
  return {
    ...c,
    cupon_maestro: c.cupon_maestro || c.cupon,
  }
}

export const useCriptoTrufaStore = create<CriptoTrufaState>()(
  persist(
    immer((set, get) => ({
      // Estado inicial
      saldoActual: 0,
      cuponesCliente: [],
      cuponesMaestro: [],
      historialMovimientos: [],
      loading: false,
      publicConfig: null,
      ruletaGirando: false,
      ruletaResultado: null,

      // ── Carga de datos unificada (Dashboard) ─────────────────────────────────
      hydrateSweetCoins: async () => {
        set((s) => { s.loading = true })
        try {
          // Carga paralela de dashboard, cupones maestros y configuración
          const [dashboardRes, maestrosRes, configRes] = await Promise.all([
            api.get<{ balance: number, cupones_activos: CuponCliente[], historial_reciente: MovimientoPuntos[] }>('/cripto-trufa/dashboard'),
            api.get<CuponMaestro[]>('/cripto-trufa/coupons/available'),
            api.get<{ tasa_conversion: number }>('/cripto-trufa/public-config').catch(() => ({ data: { tasa_conversion: 0.10 } }))
          ])

          set((s) => {
            s.saldoActual = dashboardRes.data.balance
            s.cuponesCliente = (dashboardRes.data.cupones_activos || []).map(normalizarCuponCliente)
            s.historialMovimientos = dashboardRes.data.historial_reciente
            s.cuponesMaestro = maestrosRes.data
            s.publicConfig = configRes.data
            s.loading = false
          })
        } catch (error) {
          console.error("Error al hidratar CriptoTrufas", error)
          set((s) => { s.loading = false })
        }
      },

      // ── Cargar cupones maestros ──────────────────────────────────────────────
      fetchAvailableCoupons: async () => {
        try {
          const { data } = await api.get<CuponMaestro[]>('/cripto-trufa/coupons/available')
          set((s) => { s.cuponesMaestro = data })
        } catch (error) {
          console.error("Error al obtener cupones disponibles", error)
        }
      },

      // ── Canjear cupón con Optimistic UI ──────────────────────────────────────
      canjearCupon: async (id_cupon: number) => {
        const state = get()
        const maestro = state.cuponesMaestro.find((c) => c.id_cupon === id_cupon)

        if (!maestro) return { success: false, message: 'Cupón no encontrado.' }
        if (!maestro.costo_puntos) return { success: false, message: 'Cupón no canjeable con puntos.' }
        
        if (state.saldoActual < maestro.costo_puntos) {
          return {
            success: false,
            message: `Saldo insuficiente. Necesitas ${maestro.costo_puntos} CriptoTrufas, tienes ${state.saldoActual}.`,
          }
        }

        // 1. Guardar snapshot por si ocurre algún error (Rollback)
        const snapshotSaldo = state.saldoActual
        const snapshotCupones = [...state.cuponesCliente]
        const snapshotHistorial = [...state.historialMovimientos]

        // 2. Actualización optimista inmediata en la UI
        const nuevoSaldo = state.saldoActual - maestro.costo_puntos
        const codigoOptimista = `MTR-TEMP`
        
        const cuponOptimista: CuponCliente = {
          id_cupon_cliente: Date.now(), // ID temporal
          id_cliente: 0,
          id_cupon: id_cupon,
          codigo_unico: codigoOptimista,
          estado: 'DISPONIBLE',
          origen: 'COMPRA_PUNTOS',
          fecha_adquisicion: new Date().toISOString(),
          fecha_expiracion: new Date(Date.now() + maestro.dias_vigencia * 24 * 60 * 60 * 1000).toISOString(),
          fecha_uso: null,
          cupon_maestro: maestro
        }

        const movimientoOptimista: MovimientoPuntos = {
          id_movimiento_punto: Date.now() + 1,
          id_cliente: 0,
          tipo_movimiento: 'COMPRA_CUPON',
          cantidad: -maestro.costo_puntos,
          saldo_puntos_resultante: nuevoSaldo,
          fecha_movimiento: new Date().toISOString(),
          justificacion: `Canje de cupón: ${maestro.nombre} (Procesando...)`
        }

        set((s) => {
          s.saldoActual = nuevoSaldo
          s.cuponesCliente.unshift(cuponOptimista)
          s.historialMovimientos.unshift(movimientoOptimista)
        })

        try {
          // Generar una clave de idempotencia aleatoria única para esta transacción de canje
          const idempotencyKey = `redeem-${id_cupon}-${Date.now()}`
          
          // Petición real al backend
          const { data } = await api.post<CuponCliente>(
            '/cripto-trufa/coupons/redeem', 
            { id_cupon },
            { headers: { 'Idempotency-Key': idempotencyKey } }
          )

          // Reemplazar el cupón temporal optimista con el real devuelto por el backend
          set((s) => {
            // Eliminar los optimistas e insertar los reales
            s.cuponesCliente = s.cuponesCliente.filter(c => c.codigo_unico !== codigoOptimista)
            s.cuponesCliente.unshift(normalizarCuponCliente(data))
            
            // Re-hidratar historial y saldo con datos fidedignos del backend
            s.saldoActual = nuevoSaldo // Mantenemos el saldo descontado
          })
          
          // Refrescar en background el dashboard para que los IDs de movimientos e historiales queden 100% correctos
          get().hydrateSweetCoins()

          return { success: true, message: `¡Cupón ${data.codigo_unico} canjeado exitosamente!` }
        } catch (error: any) {
          // 3. Rollback en caso de error
          set((s) => {
            s.saldoActual = snapshotSaldo
            s.cuponesCliente = snapshotCupones
            s.historialMovimientos = snapshotHistorial
          })
          
          const errorMsg = error.response?.data?.detail || 'Error de conexión con el servidor al realizar el canje.'
          return { success: false, message: errorMsg }
        }
      },

      // ── Ruleta Dulce (Persistencia en base de datos) ──
      jugarRuleta: () => {
        const COSTO_JUEGO = 50
        const state = get()

        if (state.ruletaGirando) return
        if (state.saldoActual < COSTO_JUEGO) {
          toast.error("Saldo de CriptoTrufas insuficiente para jugar.")
          return
        }

        set((s) => {
          s.ruletaGirando = true
          s.ruletaResultado = null
        })

        // Simular latencia de backend (mínimo 2 segundos de giro)
        const spinPromise = new Promise((resolve) => setTimeout(resolve, 2000))
        const apiPromise = api.post<{
          resultado: 'mala_suerte' | 'puntos_extra' | 'cupon_sorpresa'
          mensaje: string
          puntos_ganados: number
          cupon_ganado: any
        }>('/cripto-trufa/play-ruleta')

        Promise.all([apiPromise, spinPromise])
          .then(([response]) => {
            const { data } = response
            set((s) => {
              s.ruletaResultado = {
                tipo: data.resultado,
                mensaje: data.mensaje,
                puntosGanados: data.puntos_ganados
              }
              s.ruletaGirando = false
            })
            // Re-hidratar saldo, cupones e historial del backend de forma real y persistente
            get().hydrateSweetCoins()
          })
          .catch((err) => {
            set((s) => {
              s.ruletaGirando = false
            })
            const errorMsg = err.response?.data?.detail || 'Error al conectar con la ruleta.'
            toast.error(errorMsg)
          })
      },

      // ── Dismiss resultado de ruleta ───────────────────────────────────────────
      dismissRuletaResultado: () => {
        set((s) => { s.ruletaResultado = null })
      },
    })),
    {
      name: 'mitrufely-criptotrufa',
      partialize: (state) => ({
        saldoActual: state.saldoActual,
        cuponesCliente: state.cuponesCliente,
        historialMovimientos: state.historialMovimientos,
      }),
    },
  ),
)
