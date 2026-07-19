/**
 * PaymentModal.tsx — Modal de checkout multi-step.
 *
 * Pasos:
 *   0. Resumen del carrito
 *   1. Datos fiscales (consulta/crea DNI o RUC)
 *   2. Datos de envío (dirección, referencia, teléfono)
 *   3. Pasarela de pago simulada (tarjeta obligatoria)
 *   4. Procesando → Éxito
 *
 * Datos fiscales y envío se persisten en BD para compras futuras.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, CheckCircle, Loader2, ArrowRight, ArrowLeft,
  CreditCard, MapPin, ShieldCheck, Search, CheckCircle2,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { useNavigate } from 'react-router'
import { useCartStore } from '@/stores/cart.store'
import { useCheckoutCart } from '../hooks/useCart'
import { useCriptoTrufaStore } from '@/stores/criptotrufa.store'
import { useDatosFiscales, useUpsertDatosFiscales, useUpdateProfile, useProfileData } from '@/features/auth/hooks/useProfile'
import {
  fiscalSchema, type FiscalFormData,
  tarjetaSchema, type TarjetaFormData,
} from '../schemas/checkout.schema'
import { useConsultarDocumento } from '@/features/consultas/hooks/useConsultarDocumento'
import type { DocumentoLookupResult } from '@/features/consultas/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  subtotalBase: number   // precio base sin IGV
  igv: number            // monto IGV (18%)
  costoEnvio: number     // costo de envío
  envioGratis: boolean   // si el envío es gratuito
  total: number          // total final
}

type Step = 0 | 1 | 2 | 3 | 4 | 5

const STEP_LABELS = ['Resumen', 'Fiscales', 'Envío', 'Pago', '', '']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCardInput(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 16)
  return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function detectCardBrand(number: string): { name: string; color: string } | null {
  const cleaned = number.replace(/\s/g, '')
  if (/^4/.test(cleaned)) return { name: 'VISA', color: '#1a1f71' }
  if (/^5[1-5]/.test(cleaned)) return { name: 'Mastercard', color: '#eb001b' }
  if (/^3[47]/.test(cleaned)) return { name: 'Amex', color: '#2e77bb' }
  if (cleaned.length >= 4) return { name: '••••', color: '#5c0f1b' }
  return null
}

// ─── Sub-componentes de formulario ────────────────────────────────────────────

function Field({ label, error, required = false, children }: {
  label: string; error?: string | undefined; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">
        {label}{required && <span className="text-[#5c0f1b] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[10px] font-bold text-red-500">{error}</p>}
    </div>
  )
}

function Input({ id, error, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; error?: boolean }) {
  return (
    <input
      id={id}
      {...rest}
      className={`w-full rounded-xl border px-3 py-2.5 text-sm font-semibold text-[#2a1115] placeholder:text-[#2a1115]/30 focus:outline-none focus:ring-2 focus:ring-[#ff7a45]/40 transition-all ${
        error ? 'border-red-400 bg-red-50' : 'border-[#5c0f1b]/20 bg-white hover:border-[#5c0f1b]/40'
      }`}
    />
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function PaymentModal({ isOpen, onClose, subtotalBase, igv, costoEnvio, envioGratis, total }: PaymentModalProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(0)
  const [ventaId, setVentaId] = useState<number | null>(null)
  const [editFiscal, setEditFiscal] = useState(false)
  const [editEnvio, setEditEnvio] = useState(false)
  const [showCardFront, setShowCardFront] = useState(true)

  const { discount, coupon, fidelizacionCoupon, clearDiscount } = useCartStore()
  const checkout = useCheckoutCart()
  const { data: fiscalData, isLoading: fiscalLoading } = useDatosFiscales()
  const upsertFiscal = useUpsertDatosFiscales()
  const { data: profileData } = useProfileData()
  const updateProfile = useUpdateProfile()

  const { hydrateSweetCoins } = useCriptoTrufaStore()

  const consultarDocumento = useConsultarDocumento()
  const [lookupResult, setLookupResult] = useState<DocumentoLookupResult | null>(null)
  const [consultadoOk, setConsultadoOk] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const confettiRef = useRef<confetti.CreateTypes | null>(null)

  // ── Forms ──────────────────────────────────────────────────────────────────
  const fiscalForm = useForm<FiscalFormData>({
    resolver: zodResolver(fiscalSchema),
    defaultValues: { tipo_documento: 'DNI', numero_documento: '', razon_social: '', direccion_fiscal: '' },
  })

  const tarjetaForm = useForm<TarjetaFormData>({
    resolver: zodResolver(tarjetaSchema),
    defaultValues: { numero_tarjeta: '', expiracion: '', cvv: '', titular: '' },
  })

  // ── Envío (sin Zod, campos simples) ────────────────────────────────────────
  const [direccion, setDireccion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [telefono, setTelefono] = useState('')
  const [envioInitialized, setEnvioInitialized] = useState(false)

  // ── Reset al abrir ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setStep(0)
      setVentaId(null)
      setEditFiscal(false)
      setEditEnvio(false)
      fiscalForm.reset()
      tarjetaForm.reset()
      setDireccion('')
      setReferencia('')
      setTelefono('')
      setEnvioInitialized(false)
      hydrateSweetCoins()
      setLookupResult(null)
      setConsultadoOk(false)
    }
  }, [isOpen])

  // ── Pre-llenar fiscal si ya existe ─────────────────────────────────────────
  useEffect(() => {
    if (fiscalData && step === 1 && !editFiscal) {
      fiscalForm.reset({
        tipo_documento: fiscalData.tipo_documento,
        numero_documento: fiscalData.numero_documento,
        razon_social: fiscalData.razon_social || '',
        direccion_fiscal: fiscalData.direccion_fiscal || '',
      })
    }
  }, [fiscalData, step, editFiscal])

  // ── Pre-llenar envio si ya existe ─────────────────────────────────────────
  useEffect(() => {
    if (profileData && step === 2 && !envioInitialized) {
      setDireccion(profileData.cliente?.direccion || '')
      setReferencia(profileData.cliente?.referencia || '')
      setTelefono(profileData.telefono || '')
      setEnvioInitialized(true)
    }
  }, [profileData, step, envioInitialized])

  // ── Escape / scroll lock ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 4) onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, step, onClose])

  // ── Confetti ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    confettiRef.current = confetti.create(canvas, { resize: true, useWorker: false })
    return () => { confettiRef.current?.reset() }
  }, [isOpen])

  const fireConfetti = () => {
    const shoot = confettiRef.current ?? confetti
    shoot({ origin: { y: 0.6 }, spread: 26, startVelocity: 55, particleCount: 50, colors: ['#5c0f1b', '#ff7a45', '#fff'] })
    shoot({ origin: { y: 0.6 }, spread: 60, particleCount: 40, colors: ['#ff7a45', '#5c0f1b'] })
    shoot({ origin: { y: 0.6 }, spread: 100, particleCount: 70, decay: 0.91, scalar: 0.8, colors: ['#fff', '#5c0f1b'] })
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleFiscalSubmit = fiscalForm.handleSubmit(async (data) => {
    const isModified = !fiscalData ||
      fiscalData.tipo_documento !== data.tipo_documento ||
      fiscalData.numero_documento !== data.numero_documento ||
      (fiscalData.razon_social || '') !== (data.razon_social || '') ||
      (fiscalData.direccion_fiscal || '') !== (data.direccion_fiscal || '');

    if (isModified) {
      await upsertFiscal.mutateAsync({
        tipo_documento: data.tipo_documento,
        numero_documento: data.numero_documento,
        razon_social: data.razon_social || null,
        direccion_fiscal: data.direccion_fiscal || null,
      })
    }
    setEditFiscal(false)
    setStep(2)
  })

  const handleEnvioSubmit = async () => {
    const isModified = !profileData ||
      (profileData.cliente?.direccion || '') !== (direccion || '') ||
      (profileData.cliente?.referencia || '') !== (referencia || '') ||
      (profileData.telefono || '') !== (telefono || '');

    if (isModified) {
      await updateProfile.mutateAsync({
        telefono: telefono || null,
        direccion: direccion || null,
        referencia: referencia || null,
      })
    }
    setEditEnvio(false)
    setStep(3)
  }

  const handleConsultarDocumento = async () => {
    const tipo = fiscalForm.getValues('tipo_documento')
    const numero = fiscalForm.getValues('numero_documento')
    const esperado = tipo === 'DNI' ? 8 : 11
    if (numero.length !== esperado) return
    try {
      const result = await consultarDocumento.mutateAsync({ tipo, numero })
      setLookupResult(result)
      setConsultadoOk(true)
      // Rellena los campos del form
      if (result.razon_social) {
        fiscalForm.setValue('razon_social', result.razon_social)
      }
      if (result.direccion_fiscal) {
        fiscalForm.setValue('direccion_fiscal', result.direccion_fiscal)
      }
    } catch {
      setConsultadoOk(false)
    }
  }

  const handlePagoSubmit = tarjetaForm.handleSubmit(async () => {
    setStep(4)
    try {
      const result = await checkout.mutateAsync(fidelizacionCoupon?.id_cupon_cliente)
      setVentaId(result.id_venta)
      clearDiscount()
      setStep(5)
      setTimeout(() => fireConfetti(), 100)
    } catch {
      setStep(3)
    }
  })

  const handleGoToOrder = () => {
    onClose()
    if (ventaId) navigate(`/mi-cuenta/pedidos/${ventaId}`)
  }

  const cardBrand = detectCardBrand(tarjetaForm.watch('numero_tarjeta'))

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1.5 px-6 pt-5 pb-4 border-b border-[#5c0f1b]/8">
      {([0, 1, 2, 3] as Step[]).map((s) => (
        <div key={s} className="flex items-center gap-1.5">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
            step === s ? 'bg-[#5c0f1b] text-white shadow-md' :
            step > s ? 'bg-emerald-500 text-white' :
            'bg-stone-100 text-stone-400'
          }`}>
            {step > s ? '✓' : s + 1}
          </div>
          <span className={`text-[10px] font-bold hidden sm:inline ${step === s ? 'text-[#5c0f1b]' : 'text-stone-400'}`}>
            {STEP_LABELS[s]}
          </span>
          {s < 3 && <div className={`w-6 h-0.5 ${step > s ? 'bg-emerald-400' : 'bg-stone-200'}`} />}
        </div>
      ))}
    </div>
  )

  return (
    <>
    {typeof document !== 'undefined' && createPortal(
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 99999 }} />,
      document.body,
    )}
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => step !== 4 && onClose()}
        >
          <motion.div
            initial={{ scale: 0.92, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            className="bg-white w-full max-w-lg rounded-[28px] overflow-hidden shadow-2xl relative border border-[#5c0f1b]/10 max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#5c0f1b]/8 shrink-0">
              <h2 className="font-black text-[#2a1115] text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {step === 5 ? '¡Pedido confirmado!' : 'Finalizar compra'}
              </h2>
              {step !== 4 && (
                <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-full border border-[#5c0f1b]/10 text-[#5c0f1b] hover:text-[#ff7a45] hover:scale-110 active:scale-90 transition-all cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Step indicator */}
            {step <= 3 && renderStepIndicator()}

            {/* ═══════════════ STEP 0: Resumen ═══════════════ */}
            {step === 0 && (
              <div className="px-6 py-5 space-y-5 flex-1 overflow-y-auto">
                <div className="bg-[#faf8f5] rounded-2xl p-5 border border-[#5c0f1b]/8 space-y-2.5">
                  {/* Subtotal base */}
                  <div className="flex justify-between text-sm font-semibold text-[#2a1115]/70">
                    <span>Subtotal (sin IGV)</span>
                    <span>S/ {subtotalBase.toFixed(2)}</span>
                  </div>
                  {/* Descuento */}
                  {discount > 0 && (
                    <div className="flex justify-between text-sm font-semibold text-[#ff7a45]">
                      <span>Descuento {coupon && `(${coupon})`}</span>
                      <span>− S/ {discount.toFixed(2)}</span>
                    </div>
                  )}
                  {/* IGV */}
                  <div className="flex justify-between text-xs font-semibold text-[#2a1115]/50 pt-1 border-t border-[#5c0f1b]/5">
                    <span>IGV (18%)</span>
                    <span>S/ {igv.toFixed(2)}</span>
                  </div>
                  {/* Envío */}
                  <div className="flex justify-between text-sm font-semibold text-[#2a1115]/70">
                    <span className="flex items-center gap-1">
                      Envío
                      {envioGratis && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-sm font-black ml-1">
                          GRATIS
                        </span>
                      )}
                    </span>
                    <span className={envioGratis ? 'text-emerald-600 font-bold' : ''}>
                      S/ {costoEnvio.toFixed(2)}
                    </span>
                  </div>
                  {/* Total */}
                  <div className="flex justify-between text-lg font-black text-[#5c0f1b] border-t border-[#5c0f1b]/10 pt-2 mt-1">
                    <span>Total</span>
                    <span>S/ {total.toFixed(2)}</span>
                  </div>
                </div>

                <p className="text-xs text-[#2a1115]/50 font-medium text-center leading-relaxed">
                  Necesitaremos tus datos fiscales y de envío para procesar el pedido.
                  Toda la información se guarda para tus próximas compras.
                </p>

                <button
                  onClick={() => setStep(1)}
                  className="w-full py-4 rounded-full bg-[#5c0f1b] text-white font-black text-base hover:bg-[#7a1525] transition-all active:scale-95 shadow-lg cursor-pointer border-none flex items-center justify-center gap-2"
                >
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* ═══════════════ STEP 1: Datos Fiscales ═══════════════ */}
            {step === 1 && (
              <form onSubmit={handleFiscalSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                <div className="flex items-center gap-2 text-sm font-black text-[#5c0f1b]">
                  <ShieldCheck className="h-4 w-4" />
                  Datos Fiscales
                </div>

                {fiscalLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-[#5c0f1b]" />
                  </div>
                ) : fiscalData && !editFiscal ? (
                  <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-200 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-xs font-bold text-stone-500 uppercase">Documento</span>
                      <span className="text-sm font-black text-[#2a1115]">{fiscalData.tipo_documento}: {fiscalData.numero_documento}</span>
                    </div>
                    {fiscalData.razon_social && (
                      <div className="flex justify-between">
                        <span className="text-xs font-bold text-stone-500 uppercase">Razón Social</span>
                        <span className="text-sm font-black text-[#2a1115]">{fiscalData.razon_social}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-xs font-bold text-stone-500 uppercase">Dirección Fiscal</span>
                      <span className="text-sm font-black text-[#2a1115]">{fiscalData.direccion_fiscal || '—'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditFiscal(true)}
                      className="text-xs font-bold text-[#5c0f1b] underline hover:text-[#ff7a45] transition-colors cursor-pointer"
                    >
                      Editar datos fiscales
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Field label="Tipo de Documento" error={fiscalForm.formState.errors.tipo_documento?.message} required>
                      <select
                        {...fiscalForm.register('tipo_documento')}
                        className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115] focus:outline-none focus:ring-2 focus:ring-[#ff7a45]/40 transition-all cursor-pointer bg-white"
                      >
                        <option value="DNI">DNI</option>
                        <option value="RUC">RUC</option>
                      </select>
                    </Field>
                    <Field label="Número de Documento" error={fiscalForm.formState.errors.numero_documento?.message} required>
                      <div className="flex gap-2">
                        <Input
                          id="fiscal-numero"
                          placeholder={fiscalForm.watch('tipo_documento') === 'RUC' ? '11 dígitos' : '8 dígitos'}
                          error={!!fiscalForm.formState.errors.numero_documento}
                          {...fiscalForm.register('numero_documento')}
                          onChange={(e) => {
                            fiscalForm.setValue('numero_documento', e.target.value.replace(/\D/g, ''), { shouldValidate: true })
                            setConsultadoOk(false)
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleConsultarDocumento}
                          disabled={
                            consultarDocumento.isPending ||
                            (fiscalForm.watch('tipo_documento') === 'DNI'
                              ? fiscalForm.watch('numero_documento').length !== 8
                              : fiscalForm.watch('numero_documento').length !== 11)
                          }
                          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#5c0f1b] text-white text-xs font-black hover:bg-[#7a1525] transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Consultar DNI/RUC en RENIEC/SUNAT"
                        >
                          {consultarDocumento.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : consultadoOk ? (
                            <><CheckCircle2 className="h-3.5 w-3.5" /> OK</>
                          ) : (
                            <><Search className="h-3.5 w-3.5" /> Consultar</>
                          )}
                        </button>
                      </div>
                    </Field>
                    {fiscalForm.watch('tipo_documento') === 'RUC' && (
                      <Field label="Razón Social" error={fiscalForm.formState.errors.razon_social?.message} required>
                        <Input id="fiscal-razon" placeholder="Razón Social" error={!!fiscalForm.formState.errors.razon_social} {...fiscalForm.register('razon_social')} />
                      </Field>
                    )}
                    <Field label="Dirección Fiscal" error={fiscalForm.formState.errors.direccion_fiscal?.message} required>
                      <Input id="fiscal-direccion" placeholder="Av. / Jr. / Calle" error={!!fiscalForm.formState.errors.direccion_fiscal} {...fiscalForm.register('direccion_fiscal')} />
                    </Field>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep(0)} className="flex-1 py-3 rounded-full border-2 border-[#5c0f1b]/20 text-[#5c0f1b] font-black text-sm hover:border-[#5c0f1b]/40 transition-all cursor-pointer flex items-center justify-center gap-2">
                    <ArrowLeft className="h-4 w-4" /> Volver
                  </button>
                  <button
                    type="submit"
                    disabled={upsertFiscal.isPending}
                    className="flex-1 py-3 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all active:scale-95 shadow-lg cursor-pointer border-none flex items-center justify-center gap-2"
                  >
                    {upsertFiscal.isPending ? 'Guardando...' : 'Guardar y continuar'} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}

            {/* ═══════════════ STEP 2: Envío ═══════════════ */}
            {step === 2 && (
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                <div className="flex items-center gap-2 text-sm font-black text-[#5c0f1b]">
                  <MapPin className="h-4 w-4" />
                  Datos de Envío
                </div>

                {/* Banner: usar dirección fiscal como envío */}
                {lookupResult?.direccion_fiscal && !editEnvio && (
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-2">
                    <p className="text-xs font-bold text-amber-900 mb-1">
                      💡 Detectamos la dirección fiscal de tu RUC:
                    </p>
                    <p className="text-xs text-amber-800 font-semibold mb-2">
                      {lookupResult.direccion_fiscal}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setDireccion(lookupResult.direccion_fiscal || '')
                        setEditEnvio(true)
                      }}
                      className="text-xs font-black text-[#5c0f1b] underline hover:text-[#ff7a45] cursor-pointer block text-left"
                    >
                      Usar esta dirección para envío
                    </button>
                  </div>
                )}

                {profileData && (profileData.cliente?.direccion || profileData.telefono) && !editEnvio ? (
                  <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-200 space-y-3">
                    {profileData.cliente?.direccion && (
                      <div className="flex justify-between">
                        <span className="text-xs font-bold text-stone-500 uppercase">Dirección</span>
                        <span className="text-sm font-black text-[#2a1115] text-right">{profileData.cliente.direccion}</span>
                      </div>
                    )}
                    {profileData.cliente?.referencia && (
                      <div className="flex justify-between">
                        <span className="text-xs font-bold text-stone-500 uppercase">Referencia</span>
                        <span className="text-sm font-black text-[#2a1115] text-right">{profileData.cliente.referencia}</span>
                      </div>
                    )}
                    {profileData.telefono && (
                      <div className="flex justify-between">
                        <span className="text-xs font-bold text-stone-500 uppercase">Teléfono</span>
                        <span className="text-sm font-black text-[#2a1115] text-right">{profileData.telefono}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditEnvio(true)}
                      className="text-xs font-bold text-[#5c0f1b] underline hover:text-[#ff7a45] transition-colors cursor-pointer"
                    >
                      Editar datos de envío
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Field label="Dirección" required>
                      <Input id="envio-direccion" placeholder="Av. / Jr. / Calle" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                    </Field>
                    <Field label="Referencia" required>
                      <Input id="envio-ref" placeholder="Ej. Al costado del parque" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
                    </Field>
                    <Field label="Teléfono" required>
                      <Input id="envio-tel" type="tel" placeholder="+51 999 999 999" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                    </Field>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 rounded-full border-2 border-[#5c0f1b]/20 text-[#5c0f1b] font-black text-sm hover:border-[#5c0f1b]/40 transition-all cursor-pointer flex items-center justify-center gap-2">
                    <ArrowLeft className="h-4 w-4" /> Volver
                  </button>
                  <button
                    onClick={handleEnvioSubmit}
                    disabled={updateProfile.isPending}
                    className="flex-1 py-3 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all active:scale-95 shadow-lg cursor-pointer border-none flex items-center justify-center gap-2"
                  >
                    {updateProfile.isPending ? 'Guardando...' : 'Guardar y continuar'} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════ STEP 3: Tarjeta ═══════════════ */}
            {step === 3 && (
              <form onSubmit={handlePagoSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                <div className="flex items-center gap-2 text-sm font-black text-[#5c0f1b]">
                  <CreditCard className="h-4 w-4" />
                  Información de Pago
                </div>

                {/* Tarjeta visual */}
                <div
                  className="rounded-2xl p-5 text-white min-h-[180px] flex flex-col justify-between shadow-lg transition-all duration-300"
                  style={{ background: `linear-gradient(135deg, ${cardBrand?.color || '#5c0f1b'}, ${cardBrand ? '#000' : '#3d0911'})` }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold uppercase opacity-70">Mitrufely Bank</p>
                      <p className="text-lg font-mono font-black tracking-widest mt-1">
                        {showCardFront ? (tarjetaForm.watch('numero_tarjeta') || '•••• •••• •••• ••••') : '•••• •••• •••• ••••'}
                      </p>
                    </div>
                    <span className="text-sm font-black">{cardBrand?.name || ''}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] uppercase opacity-60 mb-0.5">Titular</p>
                      <p className="text-sm font-bold">{tarjetaForm.watch('titular') || 'NOMBRE DEL TITULAR'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase opacity-60 mb-0.5">Expira</p>
                      <p className="text-xs font-mono font-bold">{tarjetaForm.watch('expiracion') || 'MM/AA'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Field label="Número de Tarjeta" error={tarjetaForm.formState.errors.numero_tarjeta?.message} required>
                    <div className="relative">
                      <Input
                        id="card-number"
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                        error={!!tarjetaForm.formState.errors.numero_tarjeta}
                        value={formatCardInput(tarjetaForm.watch('numero_tarjeta'))}
                        onChange={(e) => tarjetaForm.setValue('numero_tarjeta', e.target.value.replace(/\s/g, ''), { shouldValidate: true })}
                      />
                    </div>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Expiración" error={tarjetaForm.formState.errors.expiracion?.message} required>
                      <Input id="card-exp" placeholder="MM/AA" maxLength={5} error={!!tarjetaForm.formState.errors.expiracion}
                        value={tarjetaForm.watch('expiracion')}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '').slice(0, 4)
                          if (val.length >= 3) val = val.slice(0, 2) + '/' + val.slice(2)
                          tarjetaForm.setValue('expiracion', val, { shouldValidate: true })
                        }}
                      />
                    </Field>
                    <Field label="CVV" error={tarjetaForm.formState.errors.cvv?.message} required>
                      <Input id="card-cvv" type="password" placeholder="•••" maxLength={3}
                        error={!!tarjetaForm.formState.errors.cvv}
                        {...tarjetaForm.register('cvv')}
                        onFocus={() => setShowCardFront(false)}
                        onBlur={() => setShowCardFront(true)}
                      />
                    </Field>
                  </div>

                  <Field label="Titular de la Tarjeta" error={tarjetaForm.formState.errors.titular?.message} required>
                    <Input id="card-holder" placeholder="Como aparece en la tarjeta" error={!!tarjetaForm.formState.errors.titular} {...tarjetaForm.register('titular')} />
                  </Field>
                </div>

                <div className="bg-[#faf8f5] rounded-2xl p-4 border border-[#5c0f1b]/8">
                  <div className="flex justify-between text-base font-black text-[#5c0f1b]">
                    <span>Total a pagar</span>
                    <span>S/ {Number(total || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep(2)} className="flex-1 py-3 rounded-full border-2 border-[#5c0f1b]/20 text-[#5c0f1b] font-black text-sm hover:border-[#5c0f1b]/40 transition-all cursor-pointer flex items-center justify-center gap-2">
                    <ArrowLeft className="h-4 w-4" /> Volver
                  </button>
                  <button
                    type="submit"
                    disabled={checkout.isPending}
                    className="flex-1 py-3 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all active:scale-95 shadow-lg cursor-pointer border-none flex items-center justify-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    {checkout.isPending ? '...' : `Pagar S/ ${Number(total || 0).toFixed(2)}`}
                  </button>
                </div>
              </form>
            )}

            {/* ═══════════════ STEP 4: Loading ═══════════════ */}
            {step === 4 && (
              <div className="flex flex-col items-center justify-center py-16 gap-6">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full border-4 border-[#5c0f1b]/10" />
                  <Loader2 className="h-20 w-20 text-[#5c0f1b] animate-spin absolute inset-0" />
                </div>
                <div className="text-center">
                  <p className="font-black text-[#2a1115] text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Procesando tu pedido…
                  </p>
                  <p className="text-sm text-[#2a1115]/50 font-medium mt-1">
                    Por favor no cierres esta ventana
                  </p>
                </div>
              </div>
            )}

            {/* ═══════════════ STEP 5: Success ═══════════════ */}
            {step === 5 && (
              <div className="flex flex-col items-center justify-center py-14 gap-6 px-8 text-center">
                <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}>
                  <CheckCircle className="h-24 w-24 text-emerald-500" strokeWidth={1.5} />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <h3 className="font-black text-[#2a1115] text-2xl mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    ¡Pedido registrado! 🎉
                  </h3>
                  <p className="text-sm text-[#2a1115]/60 font-medium max-w-xs mx-auto">
                    Tu pedido <strong>#{ventaId}</strong> está en estado PENDIENTE. Te contactaremos para coordinar el pago y envío.
                  </p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="flex gap-3 mt-2 w-full">
                  <button onClick={() => { onClose(); navigate('/') }} className="flex-1 py-3 rounded-full border-2 border-[#5c0f1b]/20 text-[#5c0f1b] font-black text-sm hover:border-[#5c0f1b]/40 transition-all cursor-pointer">
                    Ir al inicio
                  </button>
                  <button onClick={handleGoToOrder} className="flex-1 py-3 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] transition-all active:scale-95 cursor-pointer border-none flex items-center justify-center gap-2">
                    Ver pedido <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}
