import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Sparkles, Loader2, Save, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { useSystemConfig, useUpdateSystemConfig } from '../hooks/useConfig'
import type { SystemConfigResponse } from '../api/config.api'

export default function AdminConfigPage() {
  const { data: config, isLoading, isError } = useSystemConfig()
  const updateConfigMut = useUpdateSystemConfig()

  const [formData, setFormData] = useState<Partial<SystemConfigResponse>>({})

  useEffect(() => {
    if (config) {
      setFormData(config)
    }
  }, [config])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateConfigMut.mutate(formData, {
      onSuccess: () => {
        toast.success('Configuración guardada correctamente.')
      },
      onError: () => {
        toast.error('Error al guardar la configuración.')
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased pb-12">
      <header className="bg-white border-b border-[#5c0f1b]/10 sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition-all shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black bg-[#ff7a45]/12 border border-[#ff7a45]/20 px-2.5 py-1 rounded-full text-[#ff7a45] uppercase tracking-wide">
                  Panel Administrativo
                </span>
                <Sparkles className="h-4 w-4 text-[#ff7a45] animate-pulse" />
              </div>
              <h1 className="text-2xl font-black text-[#5c0f1b] tracking-tight mt-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Configuración del Sistema
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-[#5c0f1b] animate-spin" />
            <p className="text-sm font-bold text-[#2a1115]/50">Cargando configuración...</p>
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 p-6 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-semibold">
            <span>Error al cargar la configuración. Revisa tu conexión.</span>
          </div>
        )}

        {!isLoading && !isError && config && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#5c0f1b]/10 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#5c0f1b]/10 bg-stone-50/50 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#5c0f1b]/10 flex items-center justify-center">
                <Settings className="h-5 w-5 text-[#5c0f1b]" />
              </div>
              <div>
                <h2 className="font-black text-[#2a1115] text-lg">Reglas de Envío y Descuentos</h2>
                <p className="text-sm text-stone-500">Ajusta las variables operativas del negocio</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#2a1115]/70">Costo Base de Envío (S/.)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="shipping_cost"
                    value={formData.shipping_cost ?? ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#ff7a45]/40 text-[#2a1115]"
                  />
                  <p className="text-xs text-stone-400">Costo por defecto si no aplica envío gratis.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#2a1115]/70">Umbral de Envío Gratis (S/.)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="free_shipping_threshold"
                    value={formData.free_shipping_threshold ?? ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#ff7a45]/40 text-[#2a1115]"
                  />
                  <p className="text-xs text-stone-400">Si el subtotal supera este monto, el envío es S/0.00.</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#5c0f1b]/10 bg-stone-50/50 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#5c0f1b]/10 flex items-center justify-center">
                <Settings className="h-5 w-5 text-[#5c0f1b]" />
              </div>
              <div>
                <h2 className="font-black text-[#2a1115] text-lg">Tiempos de Entrega y ETA</h2>
                <p className="text-sm text-stone-500">Parámetros para calcular el ETA de pedidos</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#2a1115]/70">Preparación Base (min)</label>
                  <input
                    type="number"
                    name="preparation_base_time_minutes"
                    value={formData.preparation_base_time_minutes ?? ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#ff7a45]/40 text-[#2a1115]"
                  />
                  <p className="text-xs text-stone-400">Tiempo base fijo de preparación.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#2a1115]/70">Entrega Base (min)</label>
                  <input
                    type="number"
                    name="delivery_base_time_minutes"
                    value={formData.delivery_base_time_minutes ?? ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#ff7a45]/40 text-[#2a1115]"
                  />
                  <p className="text-xs text-stone-400">Tiempo estimado en el trayecto de delivery.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#2a1115]/70">Factor ETA por Producto (min)</label>
                  <input
                    type="number"
                    name="eta_factor_per_product"
                    value={formData.eta_factor_per_product ?? ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#ff7a45]/40 text-[#2a1115]"
                  />
                  <p className="text-xs text-stone-400">Minutos adicionales por cada unidad.</p>
                </div>

              </div>
            </div>

            <div className="p-6 border-t border-[#5c0f1b]/10 bg-stone-50 flex justify-end">
              <button
                type="submit"
                disabled={updateConfigMut.isPending}
                className="flex items-center gap-2 bg-[#5c0f1b] hover:bg-[#7a1525] text-white px-6 py-3 rounded-full font-black text-sm transition-colors disabled:opacity-50"
              >
                {updateConfigMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {updateConfigMut.isPending ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
