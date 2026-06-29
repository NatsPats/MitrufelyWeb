import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Ticket,
  Search,
  History,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Coins,
  ArrowUpDown,
  Loader2,
  Settings
} from 'lucide-react'
import api from '@/lib/axios'
import { toast } from 'sonner'

// Interfaces locales basadas en el backend
interface ClienteSaldo {
  id_cliente: number
  id_usuario: number
  nombres: string
  apellidos: string
  email: string
  saldo: number
}

interface MovimientoPuntos {
  id_movimiento_punto: number
  id_cliente: number
  tipo_movimiento: string
  cantidad: number
  saldo_puntos_resultante: number
  fecha_movimiento: string
  justificacion: string | null
}

interface CuponMaestro {
  id_cupon: number
  id_categoria: number | null
  nombre: string
  descripcion: string | null
  porcentaje_descuento: number
  costo_puntos: number | null
  dias_vigencia: number
  estado: boolean
}

export default function AdminSweetCoinsPage() {
  const [activeTab, setActiveTab] = useState<'clientes' | 'cupones' | 'configuracion'>('clientes')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Listados principales
  const [clientes, setClientes] = useState<ClienteSaldo[]>([])
  const [cupones, setCupones] = useState<CuponMaestro[]>([])

  // Estados para la configuración de recompensas
  const [configTasa, setConfigTasa] = useState('0.10')
  const [configLimit, setConfigLimit] = useState('5000')
  const [configExpiracion, setConfigExpiracion] = useState('365')
  const [configEstado, setConfigEstado] = useState(true)
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)

  // Modales y estados de edición
  const [selectedCliente, setSelectedCliente] = useState<ClienteSaldo | null>(null)
  const [clienteHistory, setClienteHistory] = useState<MovimientoPuntos[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustJustificacion, setAdjustJustificacion] = useState('')
  const [adjustSubmitting, setAdjustSubmitting] = useState(false)

  const [showCouponModal, setShowCouponModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<CuponMaestro | null>(null)
  const [couponName, setCouponName] = useState('')
  const [couponDesc, setCouponDesc] = useState('')
  const [couponPct, setCouponPct] = useState('')
  const [couponCost, setCouponCost] = useState('')
  const [couponVigencia, setCouponVigencia] = useState('')
  const [couponEstado, setCouponEstado] = useState(true)
  const [couponCategoriaId, setCouponCategoriaId] = useState<string>('')
  const [couponSubmitting, setCouponSubmitting] = useState(false)

  const [categorias, setCategorias] = useState<any[]>([])

  // Cargar datos
  const fetchClientes = async () => {
    setLoading(true)
    try {
      const { data } = await api.get<ClienteSaldo[]>('/cripto-trufa/admin/clientes')
      setClientes(data)
    } catch (err) {
      toast.error('Error al cargar la lista de clientes.')
    } finally {
      setLoading(false)
    }
  }

  const fetchCupones = async () => {
    setLoading(true)
    try {
      const { data } = await api.get<CuponMaestro[]>('/cripto-trufa/admin/coupons')
      setCupones(data)
    } catch (err) {
      toast.error('Error al cargar el catálogo de cupones.')
    } finally {
      setLoading(false)
    }
  }

  const fetchConfig = async () => {
    setConfigLoading(true)
    try {
      const { data } = await api.get('/cripto-trufa/config')
      if (data) {
        setConfigTasa(data.tasa_conversion.toString())
        setConfigLimit(data.limite_puntos_billetera.toString())
        setConfigExpiracion(data.dias_expiracion.toString())
        setConfigEstado(data.estado)
      }
    } catch (err) {
      console.error('Error al cargar configuración de recompensas:', err)
      toast.error('Error al cargar configuración de recompensas.')
    } finally {
      setConfigLoading(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    const tasa = parseFloat(configTasa)
    const limit = parseInt(configLimit)
    const exp = parseInt(configExpiracion)

    if (isNaN(tasa) || tasa < 0 || tasa > 1) {
      toast.warning('La tasa de conversión debe estar entre 0 y 1 (Ej: 0.10).')
      return
    }
    if (isNaN(limit) || limit <= 0) {
      toast.warning('El límite de puntos debe ser mayor a cero.')
      return
    }
    if (isNaN(exp) || exp <= 0) {
      toast.warning('La expiración en días debe ser mayor a cero.')
      return
    }

    setConfigSaving(true)
    try {
      const payload = {
        tasa_conversion: tasa,
        limite_puntos_billetera: limit,
        dias_expiracion: exp,
        estado: configEstado
      }
      await api.put('/cripto-trufa/config', payload)
      toast.success('Configuración de recompensas actualizada con éxito.')
      fetchConfig()
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Error al actualizar configuración.'
      toast.error(msg)
    } finally {
      setConfigSaving(false)
    }
  }

  const fetchCategorias = async () => {
    try {
      const { data } = await api.get<any>('/categorias')
      setCategorias(data.items || [])
    } catch (err) {
      console.error('Error al cargar categorías', err)
    }
  }

  useEffect(() => {
    fetchCategorias()
  }, [])

  useEffect(() => {
    if (activeTab === 'clientes') {
      fetchClientes()
    } else if (activeTab === 'cupones') {
      fetchCupones()
    } else if (activeTab === 'configuracion') {
      fetchConfig()
    }
  }, [activeTab])

  // Ver historial de puntos
  const handleOpenHistory = async (cliente: ClienteSaldo) => {
    setSelectedCliente(cliente)
    setShowHistoryModal(true)
    setHistoryLoading(true)
    try {
      const { data } = await api.get<MovimientoPuntos[]>(`/cripto-trufa/admin/history/${cliente.id_cliente}`)
      setClienteHistory(data)
    } catch (err) {
      toast.error('Error al cargar el historial del cliente.')
      setShowHistoryModal(false)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Ajustar puntos
  const handleOpenAdjust = (cliente: ClienteSaldo) => {
    setSelectedCliente(cliente)
    setAdjustAmount('')
    setAdjustJustificacion('')
    setShowAdjustModal(true)
  }

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCliente) return
    const amt = parseInt(adjustAmount)
    if (isNaN(amt) || amt === 0) {
      toast.warning('Por favor introduce una cantidad válida distinta de cero.')
      return
    }
    if (adjustJustificacion.trim().length < 5) {
      toast.warning('Justificación obligatoria (mínimo 5 caracteres).')
      return
    }

    setAdjustSubmitting(true)
    try {
      await api.post('/cripto-trufa/adjust', {
        id_cliente: selectedCliente.id_cliente,
        cantidad: amt,
        justificacion: adjustJustificacion
      })
      toast.success(`Ajuste de ${amt > 0 ? '+' : ''}${amt} CriptoTrufas realizado con éxito.`)
      setShowAdjustModal(false)
      fetchClientes()
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Error al procesar el ajuste de puntos.'
      toast.error(msg)
    } finally {
      setAdjustSubmitting(false)
    }
  }

  // Crear/Editar Cupón
  const handleOpenCouponModal = (coupon: CuponMaestro | null = null) => {
    setEditingCoupon(coupon)
    if (coupon) {
      setCouponName(coupon.nombre)
      setCouponDesc(coupon.descripcion || '')
      setCouponPct(coupon.porcentaje_descuento.toString())
      setCouponCost(coupon.costo_puntos ? coupon.costo_puntos.toString() : '')
      setCouponVigencia(coupon.dias_vigencia.toString())
      setCouponEstado(coupon.estado)
      setCouponCategoriaId(coupon.id_categoria ? coupon.id_categoria.toString() : '')
    } else {
      setCouponName('')
      setCouponDesc('')
      setCouponPct('10')
      setCouponCost('500')
      setCouponVigencia('30')
      setCouponEstado(true)
      setCouponCategoriaId('')
    }
    setShowCouponModal(true)
  }

  const handleCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const pct = parseFloat(couponPct)
    const cost = couponCost ? parseInt(couponCost) : null
    const vig = parseInt(couponVigencia)

    if (!couponName.trim()) {
      toast.warning('El nombre del cupón es obligatorio.')
      return
    }
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast.warning('El porcentaje de descuento debe estar entre 1 y 100.')
      return
    }
    if (cost !== null && (isNaN(cost) || cost < 0)) {
      toast.warning('El costo en puntos no puede ser menor a cero.')
      return
    }
    if (isNaN(vig) || vig <= 0) {
      toast.warning('La vigencia debe ser mayor a 0 días.')
      return
    }

    const payload = {
      nombre: couponName,
      descripcion: couponDesc || null,
      porcentaje_descuento: pct,
      costo_puntos: cost,
      dias_vigencia: vig,
      estado: couponEstado,
      id_categoria: couponCategoriaId ? parseInt(couponCategoriaId) : null
    }

    setCouponSubmitting(true)
    try {
      if (editingCoupon) {
        await api.put(`/cripto-trufa/admin/coupons/${editingCoupon.id_cupon}`, payload)
        toast.success('Cupón maestro actualizado con éxito.')
      } else {
        await api.post('/cripto-trufa/admin/coupons', payload)
        toast.success('Cupón maestro creado con éxito.')
      }
      setShowCouponModal(false)
      fetchCupones()
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Error al guardar el cupón.'
      toast.error(msg)
    } finally {
      setCouponSubmitting(false)
    }
  }

  // Desactivar Cupón (Borrado lógico)
  const handleToggleCouponState = async (coupon: CuponMaestro) => {
    try {
      if (coupon.estado) {
        await api.delete(`/cripto-trufa/admin/coupons/${coupon.id_cupon}`)
        toast.success(`Cupón '${coupon.nombre}' desactivado.`)
      } else {
        // Para activar, simplemente llamamos al PUT con estado=true
        await api.put(`/cripto-trufa/admin/coupons/${coupon.id_cupon}`, {
          nombre: coupon.nombre,
          descripcion: coupon.descripcion,
          porcentaje_descuento: coupon.porcentaje_descuento,
          costo_puntos: coupon.costo_puntos,
          dias_vigencia: coupon.dias_vigencia,
          estado: true
        })
        toast.success(`Cupón '${coupon.nombre}' activado.`)
      }
      fetchCupones()
    } catch (err) {
      toast.error('Error al cambiar el estado del cupón.')
    }
  }

  // Filtrado de clientes
  const filteredClientes = clientes.filter(c =>
    `${c.nombres} ${c.apellidos}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#5c0f1b] flex items-center gap-2">
            <Coins className="h-8 w-8 text-[#ff7a45]" />
            Gestión de CriptoTrufas
          </h1>
          <p className="text-sm text-stone-500 font-semibold">
            Monitorea el programa de fidelización, audita movimientos de clientes y administra el catálogo de recompensas.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#5c0f1b]/10 gap-2">
        <button
          onClick={() => setActiveTab('clientes')}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-black tracking-wide uppercase transition-all border-b-2 cursor-pointer ${
            activeTab === 'clientes'
              ? 'border-[#5c0f1b] text-[#5c0f1b]'
              : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          <Users className="h-4 w-4" />
          Clientes y Saldos
        </button>
        <button
          onClick={() => setActiveTab('cupones')}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-black tracking-wide uppercase transition-all border-b-2 cursor-pointer ${
            activeTab === 'cupones'
              ? 'border-[#5c0f1b] text-[#5c0f1b]'
              : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          <Ticket className="h-4 w-4" />
          Catálogo de Cupones
        </button>
        <button
          onClick={() => setActiveTab('configuracion')}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-black tracking-wide uppercase transition-all border-b-2 cursor-pointer ${
            activeTab === 'configuracion'
              ? 'border-[#5c0f1b] text-[#5c0f1b]'
              : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          <Settings className="h-4 w-4" />
          Configuración Global
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl p-6 border border-[#5c0f1b]/8 shadow-sm">
        {activeTab === 'clientes' ? (
          /* PESTAÑA CLIENTES */
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-[#faf8f5] px-4 py-3 rounded-2xl border border-[#5c0f1b]/10 max-w-md">
              <Search className="h-4 w-4 text-[#5c0f1b]/40" />
              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none w-full text-sm font-semibold text-[#2a1115] placeholder:text-[#2a1115]/30"
              />
            </div>

            {loading ? (
              <div className="flex flex-col items-center py-12 gap-3 text-[#5c0f1b]">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm font-bold">Cargando clientes...</span>
              </div>
            ) : filteredClientes.length === 0 ? (
              <div className="text-center py-12 font-bold text-stone-400">
                No se encontraron clientes registrados.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-stone-100">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider text-[11px] border-b border-stone-100">
                      <th className="py-4 px-5">Cliente</th>
                      <th className="py-4 px-5">Correo</th>
                      <th className="py-4 px-5">Saldo CriptoTrufas</th>
                      <th className="py-4 px-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-[#2a1115] font-semibold">
                    {filteredClientes.map(cliente => (
                      <tr key={cliente.id_cliente} className="hover:bg-[#faf8f5]/50 transition-colors">
                        <td className="py-4 px-5 font-black">{cliente.nombres} {cliente.apellidos}</td>
                        <td className="py-4 px-5 text-stone-500">{cliente.email}</td>
                        <td className="py-4 px-5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff7a45]/10 text-[#5c0f1b] font-black">
                            <Coins className="h-3.5 w-3.5 text-[#ff7a45]" />
                            {cliente.saldo}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenHistory(cliente)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-stone-600 bg-stone-100 hover:bg-stone-200 active:scale-95 transition-all cursor-pointer font-bold border-none"
                          >
                            <History className="h-3.5 w-3.5" />
                            Historial
                          </button>
                          <button
                            onClick={() => handleOpenAdjust(cliente)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white bg-[#5c0f1b] hover:bg-[#7a1525] active:scale-95 transition-all cursor-pointer font-bold border-none"
                          >
                            <ArrowUpDown className="h-3.5 w-3.5" />
                            Ajustar Saldo
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'cupones' ? (
          /* PESTAÑA CATALOGO DE CUPONES (CRUD) */
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-[#5c0f1b]">Catálogo General de Cupones</h3>
              <button
                onClick={() => handleOpenCouponModal(null)}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#5c0f1b] text-white font-black hover:bg-[#7a1525] active:scale-95 transition-all border-none cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Nuevo Cupón Maestro
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center py-12 gap-3 text-[#5c0f1b]">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm font-bold">Cargando catálogo...</span>
              </div>
            ) : cupones.length === 0 ? (
              <div className="text-center py-12 font-bold text-stone-400">
                No hay cupones creados en el catálogo. ¡Crea el primero!
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-stone-100">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider text-[11px] border-b border-stone-100">
                      <th className="py-4 px-5">Cupón</th>
                      <th className="py-4 px-5">Descuento</th>
                      <th className="py-4 px-5">Costo Puntos</th>
                      <th className="py-4 px-5">Vigencia</th>
                      <th className="py-4 px-5">Estado</th>
                      <th className="py-4 px-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-[#2a1115] font-semibold">
                    {cupones.map(cupon => (
                      <tr key={cupon.id_cupon} className="hover:bg-[#faf8f5]/50 transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-black text-sm">{cupon.nombre}</div>
                          {cupon.descripcion && <div className="text-xs text-stone-400 font-medium">{cupon.descripcion}</div>}
                          {cupon.id_categoria && (
                            <div className="mt-1">
                              <span className="inline-block text-[10px] bg-[#ff7a45]/10 text-[#5c0f1b] px-2 py-0.5 rounded-full font-black">
                                Categoría: {categorias.find(cat => cat.id_categoria === cupon.id_categoria)?.nombre || `ID: ${cupon.id_categoria}`}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-5 text-emerald-600 font-black">{Number(cupon.porcentaje_descuento)}% OFF</td>
                        <td className="py-4 px-5">
                          {cupon.costo_puntos ? (
                            <span className="inline-flex items-center gap-1 text-[#5c0f1b] font-bold">
                              <Coins className="h-3.5 w-3.5 text-[#ff7a45]" />
                              {cupon.costo_puntos} pts
                            </span>
                          ) : (
                            <span className="text-stone-400 font-medium">— Gratuito —</span>
                          )}
                        </td>
                        <td className="py-4 px-5">{cupon.dias_vigencia} días</td>
                        <td className="py-4 px-5">
                          {cupon.estado ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                              <CheckCircle className="h-3 w-3" /> Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-bold">
                              <XCircle className="h-3 w-3" /> Inactivo
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenCouponModal(cupon)}
                            className="p-2 rounded-xl text-stone-600 hover:bg-stone-100 active:scale-90 transition-all cursor-pointer border-none"
                            title="Editar cupón"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleCouponState(cupon)}
                            className={`p-2 rounded-xl active:scale-90 transition-all cursor-pointer border-none ${
                              cupon.estado ? 'text-red-500 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'
                            }`}
                            title={cupon.estado ? 'Desactivar cupón' : 'Activar cupón'}
                          >
                            {cupon.estado ? <Trash2 className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* PESTAÑA CONFIGURACIÓN GLOBAL */
          <div className="space-y-6 max-w-2xl">
            <div>
              <h3 className="text-lg font-black text-[#5c0f1b]">Configuración del Programa de Recompensas</h3>
              <p className="text-sm text-stone-500 font-semibold mt-0.5">
                Ajusta las reglas globales de acumulación de puntos, límites de billetera y vigencia de las CriptoTrufas.
              </p>
            </div>

            {configLoading ? (
              <div className="flex flex-col items-center py-12 gap-3 text-[#5c0f1b]">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm font-bold">Cargando configuración actual...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveConfig} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">
                      Tasa de Conversión (Retorno)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max="1"
                        value={configTasa}
                        onChange={e => setConfigTasa(e.target.value)}
                        required
                        className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115]"
                        placeholder="Ej: 0.10"
                      />
                      <span className="absolute right-3 text-xs text-stone-400 font-bold">
                        ({(parseFloat(configTasa) * 100 || 0).toFixed(0)}% de la compra)
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 font-semibold">
                      Porcentaje de retorno de puntos sobre el total gastado en cada compra. Ej: 0.10 otorga 10 CriptoTrufas por cada S/. 100 gastados.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">
                      Límite de Billetera por Cliente
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={configLimit}
                      onChange={e => setConfigLimit(e.target.value)}
                      required
                      className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115]"
                      placeholder="Ej: 5000"
                    />
                    <p className="text-[11px] text-stone-400 font-semibold">
                      Cantidad máxima de puntos que un cliente puede tener acumulados en su saldo.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">
                      Días de Validez de los Puntos
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={configExpiracion}
                      onChange={e => setConfigExpiracion(e.target.value)}
                      required
                      className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115]"
                      placeholder="Ej: 365"
                    />
                    <p className="text-[11px] text-stone-400 font-semibold">
                      Días de vigencia de los puntos acumulados antes de que expiren automáticamente si no se canjean.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 justify-center pt-2">
                    <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">Estado del Programa</label>
                    <div className="flex items-center gap-4 py-2">
                      <label className="flex items-center gap-2.5 text-sm font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={configEstado}
                          onChange={e => setConfigEstado(e.target.checked)}
                          className="h-4.5 w-4.5 accent-[#5c0f1b]"
                        />
                        Programa de fidelización activo
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={configSaving}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] active:scale-95 transition-all disabled:opacity-50 border-none cursor-pointer"
                  >
                    {configSaving ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : 'Guardar Configuración'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ─── MODAL HISTORIAL DE PUNTOS ────────────────────────────────────────── */}
      <AnimatePresence>
        {showHistoryModal && selectedCliente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-stone-200 shadow-2xl"
            >
              <div className="flex justify-between items-center px-6 py-4 border-b border-stone-100">
                <div>
                  <h3 className="text-lg font-black text-[#5c0f1b] flex items-center gap-1.5">
                    <History className="h-5 w-5" />
                    Historial de CriptoTrufas
                  </h3>
                  <p className="text-xs text-stone-400 font-bold">{selectedCliente.nombres} {selectedCliente.apellidos} ({selectedCliente.email})</p>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors border-none cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {historyLoading ? (
                  <div className="flex flex-col items-center py-12 gap-2 text-[#5c0f1b]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-sm font-bold">Cargando movimientos...</span>
                  </div>
                ) : clienteHistory.length === 0 ? (
                  <div className="text-center py-12 text-stone-400 font-bold">
                    El cliente no registra movimientos de puntos en su cuenta.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clienteHistory.map(m => (
                      <div key={m.id_movimiento_punto} className="flex items-start justify-between p-4 bg-[#faf8f5] rounded-2xl border border-[#5c0f1b]/5 hover:border-[#ff7a45]/20 transition-all">
                        <div className="space-y-1">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            m.tipo_movimiento === 'ACUMULACION_VENTA' ? 'bg-emerald-50 text-emerald-700' :
                            m.tipo_movimiento === 'COMPRA_CUPON' ? 'bg-[#5c0f1b]/5 text-[#5c0f1b]' :
                            m.tipo_movimiento === 'AJUSTE_ADMIN' ? 'bg-amber-50 text-amber-700' :
                            'bg-stone-100 text-stone-700'
                          }`}>
                            {m.tipo_movimiento.replace('_', ' ')}
                          </span>
                          <p className="text-sm font-bold text-[#2a1115]">{m.justificacion || 'Sin descripción'}</p>
                          <p className="text-[10px] text-stone-400 font-semibold">
                            {new Date(m.fecha_movimiento).toLocaleString('es-PE')}
                          </p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <span className={`text-sm font-black ${m.cantidad > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad} pts
                          </span>
                          <p className="text-[10px] text-stone-400 font-semibold">Saldo: {m.saldo_puntos_resultante} pts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL AJUSTAR PUNTOS ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdjustModal && selectedCliente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full border border-stone-200 shadow-2xl p-6 space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-[#5c0f1b] flex items-center gap-1.5">
                  <ArrowUpDown className="h-5 w-5 text-[#ff7a45]" />
                  Ajustar Saldo de Puntos
                </h3>
                <button
                  onClick={() => setShowAdjustModal(false)}
                  className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 border-none cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold text-stone-500">
                  Estás modificando el saldo del cliente: <strong className="text-[#2a1115]">{selectedCliente.nombres} {selectedCliente.apellidos}</strong>.
                  Saldo actual: <strong className="text-[#5c0f1b]">{selectedCliente.saldo} CriptoTrufas</strong>.
                </p>
              </div>

              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">Cantidad</label>
                  <input
                    type="number"
                    placeholder="Ej: 500 para sumar, -200 para restar"
                    value={adjustAmount}
                    onChange={e => setAdjustAmount(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115]"
                  />
                  <span className="text-[10px] text-stone-400 font-semibold">Introduce un valor positivo para sumar saldo y negativo para debitar.</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">Justificación / Motivo</label>
                  <textarea
                    placeholder="Escribe la razón detallada del ajuste..."
                    value={adjustJustificacion}
                    onChange={e => setAdjustJustificacion(e.target.value)}
                    required
                    rows={3}
                    minLength={5}
                    maxLength={255}
                    className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="w-full py-3.5 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border-none"
                >
                  {adjustSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Ajuste'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL CREAR / EDITAR CUPÓN ────────────────────────────────────────── */}
      <AnimatePresence>
        {showCouponModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full border border-stone-200 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-[#5c0f1b] flex items-center gap-1.5">
                  <Ticket className="h-5 w-5 text-[#ff7a45]" />
                  {editingCoupon ? 'Editar Cupón Maestro' : 'Nuevo Cupón Maestro'}
                </h3>
                <button
                  onClick={() => setShowCouponModal(false)}
                  className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 border-none cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCouponSubmit} className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">Nombre del Cupón</label>
                  <input
                    type="text"
                    placeholder="Ej: Super Oreo VIP"
                    value={couponName}
                    onChange={e => setCouponName(e.target.value)}
                    required
                    maxLength={100}
                    className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">Descripción</label>
                  <input
                    type="text"
                    placeholder="Ej: 20% de descuento en el total de tu pedido."
                    value={couponDesc}
                    onChange={e => setCouponDesc(e.target.value)}
                    maxLength={255}
                    className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">
                    Categoría Restringida (Opcional)
                  </label>
                  <select
                    value={couponCategoriaId}
                    onChange={e => setCouponCategoriaId(e.target.value)}
                    className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115] bg-white cursor-pointer"
                  >
                    <option value="">-- Todo el Carrito (Sin Restricción) --</option>
                    {categorias.map(cat => (
                      <option key={cat.id_categoria} value={cat.id_categoria}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">Porcentaje Descuento</label>
                    <input
                      type="number"
                      placeholder="Ej: 15"
                      value={couponPct}
                      onChange={e => setCouponPct(e.target.value)}
                      required
                      min={1}
                      max={100}
                      className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">Costo Puntos (Canje)</label>
                    <input
                      type="number"
                      placeholder="Ej: 800 (Dejar vacío si es gratis)"
                      value={couponCost}
                      onChange={e => setCouponCost(e.target.value)}
                      min={0}
                      className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 items-center">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">Días de Vigencia</label>
                    <input
                      type="number"
                      placeholder="Ej: 30"
                      value={couponVigencia}
                      onChange={e => setCouponVigencia(e.target.value)}
                      required
                      min={1}
                      className="w-full rounded-xl border border-[#5c0f1b]/20 px-3 py-2.5 text-sm font-semibold text-[#2a1115]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-black text-[#2a1115]/70 uppercase tracking-wide">Estado Inicial</label>
                    <div className="flex items-center gap-4 py-2">
                      <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={couponEstado}
                          onChange={e => setCouponEstado(e.target.checked)}
                          className="h-4 w-4 accent-[#5c0f1b]"
                        />
                        Activo para canje
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={couponSubmitting}
                  className="w-full py-3.5 rounded-full bg-[#5c0f1b] text-white font-black text-sm hover:bg-[#7a1525] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border-none"
                >
                  {couponSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCoupon ? 'Actualizar Cupón' : 'Registrar Cupón'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
