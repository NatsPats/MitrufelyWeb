import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, User, Search, Filter, Loader2, X, Package, CheckCircle2, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { useAdminIssuesQuery, useIssueMetricsQuery, useUpdateIssueMutation } from '../hooks/useAdminIssues'
import type { AdminIssueResponse, UpdateIssueRequest } from '../api/issues.api'

export default function AdminIssuesPage() {
  const { data: metrics, isLoading: loadingMetrics } = useIssueMetricsQuery()
  const { data: issues = [], isLoading: loadingIssues } = useAdminIssuesQuery(100, 0)
  const { mutateAsync: updateIssue, isPending: updating } = useUpdateIssueMutation()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [selectedIssue, setSelectedIssue] = useState<AdminIssueResponse | null>(null)

  // Resolution State
  const [newStatus, setNewStatus] = useState<string>('')
  const [resolutionText, setResolutionText] = useState('')
  const [resolutionType, setResolutionType] = useState<string>('SOLO_INFO')
  const [montoReembolso, setMontoReembolso] = useState<number>(0)

  const openIssueModal = (issue: AdminIssueResponse) => {
    setSelectedIssue(issue)
    setNewStatus(issue.status)
    setResolutionText(issue.resolution || '')
    setResolutionType('SOLO_INFO')
    setMontoReembolso(0)
  }

  const handleUpdate = async () => {
    if (!selectedIssue) return
    if ((newStatus === 'RESUELTA' || newStatus === 'CERRADA') && !resolutionText) {
      toast.error('Debes incluir una resolución para cerrar o resolver la incidencia.')
      return
    }

    try {
      const payload: UpdateIssueRequest = { status: newStatus }
      if (resolutionText) payload.resolution = resolutionText
      if (newStatus === 'RESUELTA') {
        payload.resolution_type = resolutionType
        if (resolutionType === 'REEMBOLSO') payload.monto_reembolso = montoReembolso
      }
      
      await updateIssue({ id_issue: selectedIssue.id_issue, payload })
      toast.success('Incidencia actualizada correctamente')
      setSelectedIssue(null)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Error al actualizar la incidencia')
    }
  }

  const filteredIssues = issues.filter((i) => {
    const matchesSearch =
      i.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.id_venta.toString().includes(searchTerm) ||
      i.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === 'ALL' || i.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ABIERTA': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-lg text-xs font-black">ABIERTA</span>
      case 'EN_REVISION': return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg text-xs font-black">EN REVISIÓN</span>
      case 'RESUELTA': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-black">RESUELTA</span>
      case 'CERRADA': return <span className="bg-stone-200 text-stone-700 px-2 py-1 rounded-lg text-xs font-black">CERRADA</span>
      default: return <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded-lg text-xs font-black">{status}</span>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'PEDIDO_DANADO': return <span className="text-red-600 font-bold text-xs">Daño en Producto</span>
      case 'PEDIDO_INCOMPLETO': return <span className="text-orange-600 font-bold text-xs">Incompleto</span>
      case 'ERROR_ENTREGA': return <span className="text-purple-600 font-bold text-xs">Error de Entrega</span>
      case 'PEDIDO_PERDIDO': return <span className="text-stone-600 font-bold text-xs">Pedido Perdido</span>
      default: return <span className="text-stone-600 font-bold text-xs">{type}</span>
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-[#5c0f1b] tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Gestión de Incidencias
        </h1>
        <p className="text-stone-500 font-medium mt-1">Administra y resuelve los problemas reportados por los clientes.</p>
      </div>

      {/* MÉTRICAS (FASE 8) */}
      {loadingMetrics ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#5c0f1b]" /></div>
      ) : metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl p-5 border border-red-500/20 shadow-sm shadow-red-500/5">
            <p className="text-xs text-red-600 font-bold uppercase tracking-wider">Abiertas</p>
            <span className="text-4xl font-black text-red-600">{metrics.abiertas}</span>
          </div>
          <div className="bg-white rounded-3xl p-5 border border-yellow-500/20 shadow-sm shadow-yellow-500/5">
            <p className="text-xs text-yellow-600 font-bold uppercase tracking-wider">En Revisión</p>
            <span className="text-4xl font-black text-yellow-600">{metrics.en_revision}</span>
          </div>
          <div className="bg-white rounded-3xl p-5 border border-green-500/20 shadow-sm shadow-green-500/5">
            <p className="text-xs text-green-600 font-bold uppercase tracking-wider">Resueltas</p>
            <span className="text-4xl font-black text-green-600">{metrics.resueltas}</span>
          </div>
          <div className="bg-stone-50 rounded-3xl p-5 border border-stone-200 shadow-sm">
            <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">Cerradas</p>
            <span className="text-4xl font-black text-stone-600">{metrics.cerradas}</span>
          </div>
        </div>
      ) : null}

      {/* FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-stone-100">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, ID o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border-none rounded-xl focus:ring-2 focus:ring-[#5c0f1b]/20 font-medium"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="h-5 w-5 text-stone-400" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-stone-50 border-none rounded-xl px-4 py-2.5 font-medium text-stone-700 focus:ring-2 focus:ring-[#5c0f1b]/20 outline-none w-full sm:w-auto"
          >
            <option value="ALL">Todos los estados</option>
            <option value="ABIERTA">Abierta</option>
            <option value="EN_REVISION">En Revisión</option>
            <option value="RESUELTA">Resuelta</option>
            <option value="CERRADA">Cerrada</option>
          </select>
        </div>
      </div>

      {/* TABLA DE INCIDENCIAS (FASE 5) */}
      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/50 border-b border-stone-200">
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Pedido</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loadingIssues ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-stone-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Cargando incidencias...
                  </td>
                </tr>
              ) : filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-stone-500 font-medium">
                    No se encontraron incidencias.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => (
                  <tr
                    key={issue.id_issue}
                    onClick={() => openIssueModal(issue)}
                    className="border-b border-stone-100 hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-black text-stone-400">#{issue.id_issue}</td>
                    <td className="px-6 py-4">
                      <span className="font-black text-[#5c0f1b]">#{issue.id_venta}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-stone-700">
                      {issue.cliente_nombre}
                    </td>
                    <td className="px-6 py-4">
                      {getTypeBadge(issue.issue_type)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(issue.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-500 font-medium">
                      {format(new Date(issue.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALLE Y RESOLUCIÓN (FASE 6 y 7) */}
      <AnimatePresence>
        {selectedIssue && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 bg-red-50/30">
                <h2 className="font-black text-[#5c0f1b] text-xl flex items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                  Incidencia #{selectedIssue.id_issue}
                </h2>
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="p-2 hover:bg-stone-200 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-stone-500" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                
                {/* Header Info */}
                <div className="flex gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-stone-500 font-bold uppercase flex items-center gap-1">
                      <User className="h-3 w-3" /> Cliente
                    </p>
                    <p className="font-bold text-stone-800">{selectedIssue.cliente_nombre}</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-stone-500 font-bold uppercase flex items-center gap-1">
                      <Package className="h-3 w-3" /> Pedido
                    </p>
                    <p className="font-bold text-[#5c0f1b]">#{selectedIssue.id_venta}</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-stone-500 font-bold uppercase flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Reportado
                    </p>
                    <p className="text-sm font-bold text-stone-700">
                      {format(new Date(selectedIssue.created_at), "dd MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>

                {/* Problem Description */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs text-stone-500 font-bold uppercase">Problema Reportado</p>
                    {getTypeBadge(selectedIssue.issue_type)}
                  </div>
                  <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100">
                    <p className="text-red-900 text-sm leading-relaxed whitespace-pre-wrap">
                      "{selectedIssue.description}"
                    </p>
                  </div>
                </div>

                <hr className="border-stone-100" />

                {/* Resolution Area */}
                <div className="space-y-4">
                  <h3 className="font-black text-[#5c0f1b] text-lg">Resolución Administrativa</h3>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-stone-500 uppercase">Cambiar Estado</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-[#5c0f1b]/20 outline-none"
                    >
                      <option value="ABIERTA">Abierta</option>
                      <option value="EN_REVISION">En Revisión (Investigando)</option>
                      <option value="RESUELTA">Resuelta (Solución Aplicada)</option>
                      <option value="CERRADA">Cerrada (Sin Acción)</option>
                    </select>
                  </div>

                  {newStatus === 'RESUELTA' && (
                    <div className="flex flex-col gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-200 mt-2 mb-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-yellow-800 uppercase">Acción Contable / Operativa</label>
                        <select
                          value={resolutionType}
                          onChange={(e) => setResolutionType(e.target.value)}
                          className="w-full bg-white border border-yellow-200 rounded-xl px-4 py-2 font-bold text-stone-700 focus:ring-2 focus:ring-yellow-400 outline-none"
                        >
                          <option value="SOLO_INFO">Solo Informativo (Sin Acción)</option>
                          <option value="DEVOLUCION">Devolución de Stock (Cancela Pedido)</option>
                          <option value="REEMBOLSO">Reembolso de Dinero</option>
                        </select>
                      </div>

                      {resolutionType === 'REEMBOLSO' && (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-bold text-yellow-800 uppercase">Monto a Reembolsar (S/)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={montoReembolso}
                            onChange={(e) => setMontoReembolso(parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-yellow-200 rounded-xl px-4 py-2 font-bold text-stone-700 focus:ring-2 focus:ring-yellow-400 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-stone-500 uppercase">Notas de Resolución / Acciones Tomadas</label>
                    <textarea
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="Escribe aquí las acciones que se tomaron para resolver este problema..."
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 focus:ring-2 focus:ring-[#5c0f1b]/20 outline-none min-h-[120px] resize-none"
                    />
                    <p className="text-xs text-stone-400 font-medium">Requerido si se marca como Resuelta o Cerrada.</p>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="px-6 py-2.5 rounded-full bg-stone-200 text-stone-700 font-bold hover:bg-stone-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={updating}
                  className="px-6 py-2.5 rounded-full bg-[#5c0f1b] text-white font-bold hover:bg-[#7a1827] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {updating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
