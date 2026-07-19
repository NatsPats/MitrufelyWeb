/**
 * DatosFiscalesSection.tsx — Sección "Datos Fiscales" para ProfileInfoPage.
 *
 * Flujo:
 *   - Vista lectura si el usuario ya tiene datos fiscales guardados
 *   - Botón "Editar" entra en modo edición
 *   - Botón "🔍 Consultar" llama a /consultas/documento y rellena el form
 *   - Botón "Guardar cambios" hace upsert + update_profile
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Save, ShieldCheck, Search, AlertCircle, CheckCircle2, Pencil, X } from 'lucide-react'
import { useDatosFiscales, useUpsertDatosFiscales, useUpdateProfile } from '@/features/auth/hooks/useProfile'
import { useConsultarDocumento } from '@/features/consultas/hooks/useConsultarDocumento'
import type { TipoDocumento } from '@/features/consultas/types'
import { toast } from 'sonner'

interface FormState {
  tipo_documento: TipoDocumento
  numero_documento: string
  razon_social: string
  direccion_fiscal: string
  nombres: string
  apellidos: string
}

export function DatosFiscalesSection() {
  const { data: fiscalData, isLoading: fiscalLoading } = useDatosFiscales()
  const upsertFiscal = useUpsertDatosFiscales()
  const updateProfile = useUpdateProfile()
  const consultar = useConsultarDocumento()

  const [editando, setEditando] = useState(true)
  const [consultadoOk, setConsultadoOk] = useState(false)
  const [form, setForm] = useState<FormState>({
    tipo_documento: 'DNI',
    numero_documento: '',
    razon_social: '',
    direccion_fiscal: '',
    nombres: '',
    apellidos: '',
  })

  // Sincronizar el estado del formulario cuando se cargan los datos fiscales
  useEffect(() => {
    if (fiscalData) {
      setForm({
        tipo_documento: fiscalData.tipo_documento,
        numero_documento: fiscalData.numero_documento,
        razon_social: fiscalData.razon_social ?? '',
        direccion_fiscal: fiscalData.direccion_fiscal ?? '',
        nombres: '',
        apellidos: '',
      })
      setEditando(false)
    } else {
      setEditando(true)
    }
  }, [fiscalData])

  const longitudOk =
    form.tipo_documento === 'DNI'
      ? form.numero_documento.length === 8
      : form.numero_documento.length === 11

  const handleConsultar = async () => {
    if (!longitudOk) {
      toast.error(
        form.tipo_documento === 'DNI'
          ? 'El DNI debe tener 8 dígitos.'
          : 'El RUC debe tener 11 dígitos.',
      )
      return
    }
    try {
      const result = await consultar.mutateAsync({
        tipo: form.tipo_documento,
        numero: form.numero_documento,
      })
      setForm((prev) => ({
        ...prev,
        razon_social: result.razon_social ?? prev.razon_social,
        direccion_fiscal: result.direccion_fiscal ?? prev.direccion_fiscal,
        nombres: result.nombres ?? prev.nombres,
        apellidos: result.apellidos ?? prev.apellidos,
      }))
      setConsultadoOk(true)
      toast.success('Datos cargados desde RENIEC/SUNAT.')
    } catch {
      // el hook ya muestra el toast de error
    }
  }

  const handleGuardar = async () => {
    // Validaciones mínimas
    if (!form.numero_documento || !longitudOk) {
      toast.error('Documento inválido.')
      return
    }
    if (form.tipo_documento === 'RUC' && !form.razon_social.trim()) {
      toast.error('La razón social es obligatoria para RUC.')
      return
    }
    if (!form.direccion_fiscal.trim()) {
      toast.error('La dirección fiscal es obligatoria.')
      return
    }

    // 1. Upsert fiscal
    await upsertFiscal.mutateAsync({
      tipo_documento: form.tipo_documento,
      numero_documento: form.numero_documento,
      razon_social: form.tipo_documento === 'RUC' ? form.razon_social : null,
      direccion_fiscal: form.direccion_fiscal,
    })

    // 2. Si la API dio nombres/apellidos (DNI o RUC persona natural), actualizar perfil
    if (form.nombres || form.apellidos) {
      await updateProfile.mutateAsync({
        nombres: form.nombres || null,
        apellidos: form.apellidos || null,
      })
    }

    setEditando(false)
    setConsultadoOk(false)
  }

  const handleCancelar = () => {
    // Restaurar valores desde fiscalData
    setForm({
      tipo_documento: fiscalData?.tipo_documento ?? 'DNI',
      numero_documento: fiscalData?.numero_documento ?? '',
      razon_social: fiscalData?.razon_social ?? '',
      direccion_fiscal: fiscalData?.direccion_fiscal ?? '',
      nombres: '',
      apellidos: '',
    })
    setEditando(false)
    setConsultadoOk(false)
  }

  // ── Loader de carga asíncrona ─────────────────────────────────────────────
  if (fiscalLoading) {
    return (
      <div className="bg-white rounded-2xl border border-[#5c0f1b]/8 p-5 md:p-8 flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#5c0f1b]" />
      </div>
    )
  }

  // ── Vista de lectura ──────────────────────────────────────────────────────
  if (fiscalData?.numero_documento && !editando) {
    return (
      <div className="bg-white rounded-2xl border border-[#5c0f1b]/8 p-5 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-[#2a1115] text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#5c0f1b]" />
            Datos Fiscales
          </h2>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#5c0f1b] hover:text-[#ff7a45] cursor-pointer"
          >
            <Pencil className="h-3 w-3" /> Editar
          </button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs font-black uppercase text-stone-500">Documento</dt>
            <dd className="font-bold text-[#2a1115]">
              {fiscalData.tipo_documento}: {fiscalData.numero_documento}
            </dd>
          </div>
          {fiscalData.razon_social && (
            <div>
              <dt className="text-xs font-black uppercase text-stone-500">Razón Social</dt>
              <dd className="font-bold text-[#2a1115]">{fiscalData.razon_social}</dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className="text-xs font-black uppercase text-stone-500">Dirección Fiscal</dt>
            <dd className="font-bold text-[#2a1115]">
              {fiscalData.direccion_fiscal || '—'}
            </dd>
          </div>
        </dl>
      </div>
    )
  }

  // ── Vista de edición ──────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-[#5c0f1b]/8 p-5 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-black text-[#2a1115] text-lg flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#5c0f1b]" />
          Datos Fiscales
        </h2>
      </div>

      <div className="space-y-4">
        {/* Tipo + Número + Consultar */}
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-stone-500">
              Tipo <span className="text-red-500">*</span>
            </label>
            <select
              value={form.tipo_documento}
              onChange={(e) => {
                setForm({ ...form, tipo_documento: e.target.value as TipoDocumento })
                setConsultadoOk(false)
              }}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] focus:border-[#5c0f1b] outline-none cursor-pointer"
            >
              <option value="DNI">DNI</option>
              <option value="RUC">RUC</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-stone-500">
              Número <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={form.numero_documento}
              onChange={(e) => {
                setForm({ ...form, numero_documento: e.target.value.replace(/\D/g, '') })
                setConsultadoOk(false)
              }}
              maxLength={form.tipo_documento === 'DNI' ? 8 : 11}
              placeholder={form.tipo_documento === 'DNI' ? '8 dígitos' : '11 dígitos'}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] focus:border-[#5c0f1b] outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleConsultar}
            disabled={!longitudOk || consultar.isPending}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#5c0f1b] text-white text-sm font-bold hover:bg-[#7a1525] transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {consultar.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Consultando...</>
            ) : consultadoOk ? (
              <><CheckCircle2 className="h-4 w-4" /> Consultado</>
            ) : (
              <><Search className="h-4 w-4" /> Consultar</>
            )}
          </button>
        </div>

        <p className="text-xs text-stone-500 font-medium bg-stone-50 p-3 rounded-lg border border-stone-100">
          <AlertCircle className="inline h-3 w-3 mr-1 text-stone-400" />
          Presiona "Consultar" para autocompletar desde RENIEC/SUNAT. Los campos que la API no traiga debes llenarlos manualmente.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-stone-500">
              Nombres
            </label>
            <input
              type="text"
              value={form.nombres}
              onChange={(e) => setForm({ ...form, nombres: e.target.value })}
              placeholder="Autocompleta con DNI"
              autoComplete="off"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] focus:border-[#5c0f1b] outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-stone-500">
              Apellidos
            </label>
            <input
              type="text"
              value={form.apellidos}
              onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
              placeholder="Autocompleta con DNI"
              autoComplete="off"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] focus:border-[#5c0f1b] outline-none"
            />
          </div>
        </div>

        {/* RUC */}
        <AnimatePresence>
          {form.tipo_documento === 'RUC' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1.5"
            >
              <label className="text-xs font-black uppercase tracking-wide text-stone-500">
                Razón Social <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.razon_social}
                onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                placeholder="Autocompleta con RUC"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] focus:border-[#5c0f1b] outline-none"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-wide text-stone-500">
            Dirección Fiscal <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.direccion_fiscal}
            onChange={(e) => setForm({ ...form, direccion_fiscal: e.target.value })}
            placeholder="Av. / Jr. / Calle"
            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] focus:border-[#5c0f1b] outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          {fiscalData?.numero_documento && (
            <button
              type="button"
              onClick={handleCancelar}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-[#5c0f1b]/20 text-[#5c0f1b] font-bold text-sm hover:border-[#5c0f1b]/40 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleGuardar}
            disabled={upsertFiscal.isPending || updateProfile.isPending}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#5c0f1b] hover:bg-[#7a1525] text-white text-sm font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {(upsertFiscal.isPending || updateProfile.isPending) ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="h-4 w-4" /> Guardar cambios</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
