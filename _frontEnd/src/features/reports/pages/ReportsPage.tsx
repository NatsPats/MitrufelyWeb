/**
 * ReportsPage — Módulo de Reportes (Fase 7).
 *
 * Siete reportes funcionales, cada uno como una pestaña dedicada con su
 * tabla, KPIs, filtros y descarga PDF/Excel desde el backend:
 *   1. Rendimiento de Ventas
 *   2. Seguimiento de Pedidos
 *   3. Catálogo Comercial
 *   4. Control de Inventario
 *   5. Gestión de Usuarios
 *   6. Comprobantes Electrónicos
 *   7. Fidelización CriptoTrufas
 */

import { useMemo, useState } from 'react'
import {
  TrendingUp,
  PackageSearch,
  Boxes,
  Users as UsersIcon,
  Receipt,
  Coins,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  Sparkles,
  ClipboardList,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { reportsApi, descargarBlob } from '@/features/reports/api/reports.api'
import type { ReporteFiltros, ReporteTipo } from '@/features/reports/types'
import { useReporteQuery } from '@/features/reports/hooks/useReportes'

type TabId = ReporteTipo | 'comprobantes'

interface TabDef {
  id: TabId
  nombre: string
  descripcion: string
  icon: typeof TrendingUp
}

const TABS: TabDef[] = [
  {
    id: 'ventas',
    nombre: 'Rendimiento de Ventas',
    descripcion:
      'Comportamiento económico del negocio: ventas por periodo, productos más vendidos y métodos de pago.',
    icon: TrendingUp,
  },
  {
    id: 'pedidos',
    nombre: 'Seguimiento de Pedidos',
    descripcion:
      'Control del estado de los pedidos: pendientes, completados y entregados.',
    icon: ClipboardList,
  },
  {
    id: 'catalogo',
    nombre: 'Catálogo Comercial',
    descripcion:
      'Productos registrados: nombre, categoría, precio y estado. Detección de productos inactivos.',
    icon: PackageSearch,
  },
  {
    id: 'inventario',
    nombre: 'Control de Inventario',
    descripcion:
      'Stock disponible, productos agotados o con bajo stock y planificación de reposición.',
    icon: Boxes,
  },
  {
    id: 'usuarios',
    nombre: 'Gestión de Usuarios',
    descripcion: 'Personas registradas: roles, estado de cuentas y actividad.',
    icon: UsersIcon,
  },
  {
    id: 'comprobantes',
    nombre: 'Comprobantes Electrónicos',
    descripcion:
      'Comprobantes digitales en PDF por compra: datos del cliente, productos y total.',
    icon: Receipt,
  },
  {
    id: 'fidelizacion',
    nombre: 'Fidelización CriptoTrufas',
    descripcion:
      'Puntos acumulados, utilizados y próximos a vencer; recompensas del programa.',
    icon: Coins,
  },
]

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('ventas')
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased pb-12">
      {/* Header */}
      <header className="bg-white border-b border-[#5c0f1b]/10 sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black bg-[#ff7a45]/12 border border-[#ff7a45]/20 px-2.5 py-1 rounded-full text-[#ff7a45] uppercase tracking-wide">
              Módulo de Inteligencia
            </span>
            <Sparkles className="h-4 w-4 text-[#ff7a45] animate-pulse" />
          </div>
          <h1
            className="text-2xl font-black text-[#5c0f1b] tracking-tight mt-1"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Reportes y Exportación Corporativa
          </h1>
          <p className="text-sm text-stone-500 font-semibold mt-0.5">
            Siete reportes funcionales para supervisar, controlar y tomar decisiones sobre el negocio.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Selector de Reporte (ComboBox / Dropdown) */}
        <div className="relative z-30 max-w-md">
          <label className="block text-xs font-black uppercase tracking-wider text-stone-400 mb-2">
            Seleccionar Reporte
          </label>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between gap-3 bg-white hover:bg-stone-50 border border-stone-200 px-4 py-3 rounded-2xl shadow-sm transition-all text-[#2a1115] font-black text-sm text-left cursor-pointer outline-none focus:ring-2 focus:ring-[#5c0f1b]/20 focus:border-[#5c0f1b]"
          >
            {(() => {
              const active = TABS.find((t) => t.id === activeTab)!
              const Icon = active.icon
              return (
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-[#ff7a45]" />
                  <span>{active.nombre}</span>
                </span>
              )
            })()}
            <ChevronDown className={cn("h-4 w-4 text-stone-400 transition-transform duration-200", isOpen && "transform rotate-180")} />
          </button>

          {isOpen && (
            <>
              {/* Overlay para cerrar al hacer clic fuera */}
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setIsOpen(false)}
              />
              
              {/* Contenido del Dropdown */}
              <div className="absolute left-0 right-0 mt-2 bg-white border border-stone-200/80 rounded-2xl shadow-xl z-40 max-h-96 overflow-y-auto divide-y divide-stone-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  const activo = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id)
                        setIsOpen(false)
                      }}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer",
                        activo 
                          ? "bg-[#5c0f1b]/5 text-[#5c0f1b]" 
                          : "text-stone-600 hover:bg-stone-50 hover:text-[#2a1115]"
                      )}
                    >
                      <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", activo ? "text-[#ff7a45]" : "text-stone-400")} />
                      <div>
                        <div className={cn("text-sm font-black", activo ? "text-[#5c0f1b]" : "text-[#2a1115]")}>
                          {tab.nombre}
                        </div>
                        <div className="text-xs text-stone-400 font-semibold mt-0.5 leading-relaxed">
                          {tab.descripcion}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Descripción del reporte activo */}
        {(() => {
          const tab = TABS.find((t) => t.id === activeTab)!
          return (
            <div className="bg-white rounded-2xl border border-[#5c0f1b]/8 p-5 shadow-sm">
              <h2 className="text-lg font-black text-[#5c0f1b] flex items-center gap-2">
                <tab.icon className="h-5 w-5 text-[#ff7a45]" />
                {tab.nombre}
              </h2>
              <p className="text-sm text-stone-500 font-medium mt-1">{tab.descripcion}</p>
            </div>
          )
        })()}

        {/* Contenido por tab */}
        {activeTab === 'ventas' && <ReporteVentasTab />}
        {activeTab === 'pedidos' && <ReportePedidosTab />}
        {activeTab === 'catalogo' && <ReporteCatalogoTab />}
        {activeTab === 'inventario' && <ReporteInventarioTab />}
        {activeTab === 'usuarios' && <ReporteUsuariosTab />}
        {activeTab === 'comprobantes' && <ComprobantesTab />}
        {activeTab === 'fidelizacion' && <ReporteFidelizacionTab />}
      </main>
    </div>
  )
}

// ── Componentes compartidos ──────────────────────────────────────────────────

function ExportarBotones({
  tipo,
  filtros,
}: {
  tipo: ReporteTipo
  filtros?: ReporteFiltros
}) {
  const [exportando, setExportando] = useState<null | 'pdf' | 'excel'>(null)

  const handle = async (formato: 'pdf' | 'excel') => {
    setExportando(formato)
    try {
      const stamp = new Date().toISOString().split('T')[0]
      if (formato === 'pdf') {
        const blob = await reportsApi.descargarPdf(tipo, filtros)
        descargarBlob(blob, `reporte_${tipo}_${stamp}.pdf`)
      } else {
        const blob = await reportsApi.descargarExcel(tipo, filtros)
        descargarBlob(blob, `reporte_${tipo}_${stamp}.xlsx`)
      }
      toast.success(`Reporte descargado (${formato.toUpperCase()})`)
    } catch {
      toast.error('No se pudo generar el reporte')
    } finally {
      setExportando(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handle('pdf')}
        disabled={exportando !== null}
        className="inline-flex items-center gap-2 bg-[#5c0f1b] hover:bg-[#7a1525] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition active:scale-95 cursor-pointer disabled:opacity-50"
      >
        {exportando === 'pdf' ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        PDF
      </button>
      <button
        onClick={() => handle('excel')}
        disabled={exportando !== null}
        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition active:scale-95 cursor-pointer disabled:opacity-50"
      >
        {exportando === 'excel' ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}
        Excel
      </button>
    </div>
  )
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: 'green' | 'red' | 'orange'
}) {
  const color =
    accent === 'green'
      ? 'text-green-600'
      : accent === 'red'
        ? 'text-red-600'
        : accent === 'orange'
          ? 'text-[#ff7a45]'
          : 'text-[#5c0f1b]'
  return (
    <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-wider text-stone-400">{label}</p>
      <p className={cn('text-2xl font-black mt-1', color)}>{value}</p>
    </div>
  )
}

function FiltrosFechas({
  desde,
  hasta,
  onDesde,
  onHasta,
}: {
  desde: string | undefined
  hasta: string | undefined
  onDesde: (v: string) => void
  onHasta: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm font-bold text-stone-500">
        Desde
        <input
          type="date"
          value={desde}
          onChange={(e) => onDesde(e.target.value)}
          className="px-3 py-2 rounded-xl border border-stone-200 bg-[#faf8f5] text-[#2a1115] font-semibold outline-none"
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-bold text-stone-500">
        Hasta
        <input
          type="date"
          value={hasta}
          onChange={(e) => onHasta(e.target.value)}
          className="px-3 py-2 rounded-xl border border-stone-200 bg-[#faf8f5] text-[#2a1115] font-semibold outline-none"
        />
      </label>
    </div>
  )
}

function Tabla({
  headers,
  children,
}: {
  headers: string[]
  children: React.ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider text-[11px]">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 text-[#2a1115] font-semibold">
          {children}
        </tbody>
      </table>
    </div>
  )
}

function Badge({
  texto,
  tono,
}: {
  texto: string
  tono: 'vino' | 'naranja' | 'green' | 'red' | 'gris'
}) {
  const estilos: Record<string, string> = {
    vino: 'bg-[#5c0f1b]/10 text-[#5c0f1b]',
    naranja: 'bg-[#ff7a45]/10 text-[#7a1525]',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    gris: 'bg-stone-100 text-stone-600',
  }
  return (
    <span
      className={cn('inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black', estilos[tono])}
    >
      {texto}
    </span>
  )
}

function Cargando() {
  return (
    <div className="flex justify-center py-16">
      <RefreshCw className="h-8 w-8 animate-spin text-[#5c0f1b]" />
    </div>
  )
}

function Vacio({ mensaje }: { mensaje: string }) {
  return <p className="text-center py-12 font-bold text-stone-400">{mensaje}</p>
}

const money = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return '—'
  const n = typeof v === 'number' ? v : Number(v)
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── 1. Rendimiento de Ventas ─────────────────────────────────────────────────

function ReporteVentasTab() {
  const hoy = new Date()
  const haceUnMes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate())
  const [desde, setDesde] = useState(haceUnMes.toISOString().split('T')[0])
  const [hasta, setHasta] = useState(hoy.toISOString().split('T')[0])
  const [estadoPago, setEstadoPago] = useState<'all' | 'PAGADO' | 'PENDIENTE'>('all')

  const filtros: ReporteFiltros = useMemo(
    () => ({
      fecha_desde: desde || undefined,
      fecha_hasta: hasta || undefined,
      estado_pago: estadoPago !== 'all' ? estadoPago : undefined,
    }),
    [desde, hasta, estadoPago],
  )

  const { data, isLoading, isFetching, refetch } = useReporteQuery('ventas', filtros)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltrosFechas desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
        <div className="flex items-center gap-2">
          <select
            value={estadoPago}
            onChange={(e) => setEstadoPago(e.target.value as 'all' | 'PAGADO' | 'PENDIENTE')}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-bold text-[#2a1115] outline-none cursor-pointer"
          >
            <option value="all">Todos los pagos</option>
            <option value="PAGADO">Pagados</option>
            <option value="PENDIENTE">Pendientes</option>
          </select>
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-stone-200 bg-[#faf8f5] hover:bg-[#5c0f1b]/5 cursor-pointer"
            title="Refrescar"
          >
            <RefreshCw className={cn('h-4 w-4 text-[#5c0f1b]', isFetching && 'animate-spin')} />
          </button>
          <ExportarBotones tipo="ventas" filtros={filtros} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total ventas" value={money(data?.total_ventas)} />
        <KpiCard label="N° pedidos" value={data?.cantidad_pedidos ?? 0} accent="orange" />
        <KpiCard label="Ticket promedio" value={money(data?.ticket_promedio)} accent="green" />
      </div>

      {isLoading ? (
        <Cargando />
      ) : !data?.items?.length ? (
        <Vacio mensaje="No hay ventas en el rango seleccionado." />
      ) : (
        <Tabla headers={['ID', 'Fecha', 'Cliente', 'Estado', 'Pago', 'Base', 'IGV', 'Total', 'M. Pago']}>
          {data.items.map((v) => (
            <tr key={v.id_venta} className="hover:bg-[#faf8f5]/50">
              <td className="px-4 py-3">#{v.id_venta}</td>
              <td className="px-4 py-3">{new Date(v.fecha_venta).toLocaleDateString('es-PE')}</td>
              <td className="px-4 py-3 max-w-[200px] truncate">{v.cliente}</td>
              <td className="px-4 py-3">
                <Badge
                  texto={v.estado}
                  tono={v.estado === 'ENTREGADO' ? 'green' : v.estado === 'CANCELADO' ? 'red' : 'naranja'}
                />
              </td>
              <td className="px-4 py-3">
                <Badge texto={v.estado_pago} tono={v.estado_pago === 'PAGADO' ? 'green' : 'gris'} />
              </td>
              <td className="px-4 py-3">{money(v.base_imponible)}</td>
              <td className="px-4 py-3">{money(v.igv)}</td>
              <td className="px-4 py-3 font-black">{money(v.total)}</td>
              <td className="px-4 py-3 text-stone-500">{v.metodo_pago ?? '—'}</td>
            </tr>
          ))}
        </Tabla>
      )}
    </div>
  )
}

// ── 2. Seguimiento de Pedidos ────────────────────────────────────────────────

function ReportePedidosTab() {
  const hoy = new Date()
  const haceUnMes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate())
  const [desde, setDesde] = useState(haceUnMes.toISOString().split('T')[0])
  const [hasta, setHasta] = useState(hoy.toISOString().split('T')[0])
  const [estado, setEstado] = useState<string>('all')

  const filtros: ReporteFiltros = useMemo(
    () => ({
      fecha_desde: desde || undefined,
      fecha_hasta: hasta || undefined,
      estado: estado !== 'all' ? estado : undefined,
    }),
    [desde, hasta, estado],
  )

  const { data, isLoading, isFetching, refetch } = useReporteQuery('pedidos', filtros)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltrosFechas desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
        <div className="flex items-center gap-2">
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-bold text-[#2a1115] outline-none cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PAGADO">Pagado</option>
            <option value="PREPARANDO">Preparando</option>
            <option value="EN_CAMINO">En camino</option>
            <option value="ENTREGADO">Entregado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-stone-200 bg-[#faf8f5] hover:bg-[#5c0f1b]/5 cursor-pointer"
            title="Refrescar"
          >
            <RefreshCw className={cn('h-4 w-4 text-[#5c0f1b]', isFetching && 'animate-spin')} />
          </button>
          <ExportarBotones tipo="pedidos" filtros={filtros} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total pedidos" value={data?.total_pedidos ?? 0} />
        {data?.por_estado &&
          Object.entries(data.por_estado)
            .slice(0, 3)
            .map(([k, v]) => (
              <KpiCard
                key={k}
                label={k}
                value={v}
                accent={k === 'ENTREGADO' ? 'green' : 'orange'}
              />
            ))}
      </div>

      {isLoading ? (
        <Cargando />
      ) : !data?.items?.length ? (
        <Vacio mensaje="No hay pedidos en el rango seleccionado." />
      ) : (
        <Tabla headers={['ID', 'Cliente', 'Estado', 'Pago', 'Fecha venta', 'Entregado', 'Total']}>
          {data.items.map((p) => (
            <tr key={p.id_venta} className="hover:bg-[#faf8f5]/50">
              <td className="px-4 py-3">#{p.id_venta}</td>
              <td className="px-4 py-3 max-w-[200px] truncate">{p.cliente}</td>
              <td className="px-4 py-3">
                <Badge
                  texto={p.estado}
                  tono={p.estado === 'ENTREGADO' ? 'green' : p.estado === 'CANCELADO' ? 'red' : 'naranja'}
                />
              </td>
              <td className="px-4 py-3">
                <Badge texto={p.estado_pago} tono={p.estado_pago === 'PAGADO' ? 'green' : 'gris'} />
              </td>
              <td className="px-4 py-3">{new Date(p.fecha_venta).toLocaleDateString('es-PE')}</td>
              <td className="px-4 py-3 text-stone-500">
                {p.delivery_completed_at
                  ? new Date(p.delivery_completed_at).toLocaleDateString('es-PE')
                  : '—'}
              </td>
              <td className="px-4 py-3 font-black">{money(p.total_final)}</td>
            </tr>
          ))}
        </Tabla>
      )}
    </div>
  )
}

// ── 3. Catálogo Comercial ────────────────────────────────────────────────────

function ReporteCatalogoTab() {
  const [search, setSearch] = useState('')
  const filtros: ReporteFiltros = useMemo(() => ({ search: search || undefined }), [search])
  const { data, isLoading, isFetching, refetch } = useReporteQuery('catalogo', filtros)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          className="px-4 py-2.5 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] outline-none flex-1 min-w-[200px]"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-stone-200 bg-[#faf8f5] hover:bg-[#5c0f1b]/5 cursor-pointer"
            title="Refrescar"
          >
            <RefreshCw className={cn('h-4 w-4 text-[#5c0f1b]', isFetching && 'animate-spin')} />
          </button>
          <ExportarBotones tipo="catalogo" filtros={filtros} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total productos" value={data?.total_productos ?? 0} />
        <KpiCard label="Activos" value={data?.productos_activos ?? 0} accent="green" />
        <KpiCard label="Inactivos" value={data?.productos_inactivos ?? 0} accent="red" />
      </div>

      {isLoading ? (
        <Cargando />
      ) : !data?.items?.length ? (
        <Vacio mensaje="No hay productos que coincidan con la búsqueda." />
      ) : (
        <Tabla headers={['ID', 'Nombre', 'Categoría', 'Precio', 'Stock', 'Estado']}>
          {data.items.map((p) => (
            <tr key={p.id_producto} className="hover:bg-[#faf8f5]/50">
              <td className="px-4 py-3">#{p.id_producto}</td>
              <td className="px-4 py-3 font-black">{p.nombre}</td>
              <td className="px-4 py-3 text-stone-500">{p.categoria ?? '—'}</td>
              <td className="px-4 py-3">{money(p.precio)}</td>
              <td className="px-4 py-3">{p.stock_actual}</td>
              <td className="px-4 py-3">
                <Badge texto={p.estado ? 'Activo' : 'Inactivo'} tono={p.estado ? 'green' : 'red'} />
              </td>
            </tr>
          ))}
        </Tabla>
      )}
    </div>
  )
}

// ── 4. Control de Inventario ─────────────────────────────────────────────────

function ReporteInventarioTab() {
  const { data, isLoading, isFetching, refetch } = useReporteQuery('inventario')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => refetch()}
          className="p-2.5 rounded-xl border border-stone-200 bg-[#faf8f5] hover:bg-[#5c0f1b]/5 cursor-pointer"
          title="Refrescar"
        >
          <RefreshCw className={cn('h-4 w-4 text-[#5c0f1b]', isFetching && 'animate-spin')} />
        </button>
        <ExportarBotones tipo="inventario" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Productos" value={data?.total_productos ?? 0} />
        <KpiCard label="Bajo stock" value={data?.productos_bajo_stock ?? 0} accent="orange" />
        <KpiCard label="Agotados" value={data?.productos_agotados ?? 0} accent="red" />
        <KpiCard label="Valor inventario" value={money(data?.valor_inventario)} accent="green" />
      </div>

      {isLoading ? (
        <Cargando />
      ) : !data?.items?.length ? (
        <Vacio mensaje="No hay productos registrados." />
      ) : (
        <Tabla
          headers={['ID', 'Nombre', 'Categoría', 'Stock', 'Mínimo', 'Estado stock', 'Valorización']}
        >
          {data.items.map((p) => (
            <tr key={p.id_producto} className="hover:bg-[#faf8f5]/50">
              <td className="px-4 py-3">#{p.id_producto}</td>
              <td className="px-4 py-3 font-black">{p.nombre}</td>
              <td className="px-4 py-3 text-stone-500">{p.categoria ?? '—'}</td>
              <td className="px-4 py-3">{p.stock_actual}</td>
              <td className="px-4 py-3">{p.stock_minimo}</td>
              <td className="px-4 py-3">
                <Badge
                  texto={p.estado_stock}
                  tono={
                    p.estado_stock === 'AGOTADO'
                      ? 'red'
                      : p.estado_stock === 'BAJO'
                        ? 'naranja'
                        : 'green'
                  }
                />
              </td>
              <td className="px-4 py-3">{money(p.valorizacion)}</td>
            </tr>
          ))}
        </Tabla>
      )}
    </div>
  )
}

// ── 5. Gestión de Usuarios ───────────────────────────────────────────────────

function ReporteUsuariosTab() {
  const [search, setSearch] = useState('')
  const [rol, setRol] = useState<'all' | 'ADMIN' | 'CLIENTE'>('all')
  const filtros: ReporteFiltros = useMemo(
    () => ({ search: search || undefined, estado: rol !== 'all' ? rol : undefined }),
    [search, rol],
  )
  const { data, isLoading, isFetching, refetch } = useReporteQuery('usuarios', filtros)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar usuario..."
          className="px-4 py-2.5 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] outline-none flex-1 min-w-[200px]"
        />
        <div className="flex items-center gap-2">
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as 'all' | 'ADMIN' | 'CLIENTE')}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-bold text-[#2a1115] outline-none cursor-pointer"
          >
            <option value="all">Todos los roles</option>
            <option value="ADMIN">Administradores</option>
            <option value="CLIENTE">Clientes</option>
          </select>
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-stone-200 bg-[#faf8f5] hover:bg-[#5c0f1b]/5 cursor-pointer"
            title="Refrescar"
          >
            <RefreshCw className={cn('h-4 w-4 text-[#5c0f1b]', isFetching && 'animate-spin')} />
          </button>
          <ExportarBotones tipo="usuarios" filtros={filtros} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total usuarios" value={data?.total_usuarios ?? 0} />
        <KpiCard label="Activos" value={data?.activos ?? 0} accent="green" />
        <KpiCard label="Inactivos" value={data?.inactivos ?? 0} accent="red" />
      </div>

      {isLoading ? (
        <Cargando />
      ) : !data?.items?.length ? (
        <Vacio mensaje="No hay usuarios que coincidan con los filtros." />
      ) : (
        <Tabla headers={['ID', 'Nombre', 'Email', 'Rol', 'Estado', 'Auth']}>
          {data.items.map((u) => (
            <tr key={u.id_usuario} className="hover:bg-[#faf8f5]/50">
              <td className="px-4 py-3">#{u.id_usuario}</td>
              <td className="px-4 py-3 font-black">
                {u.nombres} {u.apellidos}
              </td>
              <td className="px-4 py-3 text-stone-500">{u.email}</td>
              <td className="px-4 py-3">
                <Badge texto={u.rol} tono={u.rol === 'ADMIN' ? 'vino' : 'naranja'} />
              </td>
              <td className="px-4 py-3">
                <Badge texto={u.estado ? 'Activo' : 'Inactivo'} tono={u.estado ? 'green' : 'red'} />
              </td>
              <td className="px-4 py-3 text-stone-500">{u.auth_provider}</td>
            </tr>
          ))}
        </Tabla>
      )}
    </div>
  )
}

// ── 6. Comprobantes Electrónicos ─────────────────────────────────────────────

function ComprobantesTab() {
  const hoy = new Date()
  const haceUnMes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate())
  const [desde, setDesde] = useState(haceUnMes.toISOString().split('T')[0])
  const [hasta, setHasta] = useState(hoy.toISOString().split('T')[0])
  const [search, setSearch] = useState('')
  const [descargando, setDescargando] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const filtros: ReporteFiltros = useMemo(
    () => ({
      fecha_desde: desde || undefined,
      fecha_hasta: hasta || undefined,
    }),
    [desde, hasta],
  )

  const { data, isLoading, isFetching, refetch } = useReporteQuery('ventas', filtros)

  // Búsqueda en el cliente
  const filteredItems = useMemo(() => {
    if (!data?.items) return []
    return data.items.filter((item) => {
      const matchSearch =
        !search ||
        item.cliente.toLowerCase().includes(search.toLowerCase()) ||
        item.id_venta.toString().includes(search)
      return matchSearch
    })
  }, [data?.items, search])

  const handleDescargar = async (id: number) => {
    try {
      const blob = await reportsApi.descargarComprobante(id)
      descargarBlob(blob, `comprobante_venta_${id}.pdf`)
      toast.success(`Comprobante #${id} descargado.`)
    } catch {
      toast.error(`No se pudo generar el comprobante #${id}.`)
    }
  }

  const handleDescargarVarios = async () => {
    if (selectedIds.length === 0) return
    setDescargando(true)
    try {
      for (let i = 0; i < selectedIds.length; i++) {
        const id = selectedIds[i]
        if (id !== undefined) {
          await handleDescargar(id)
        }
        if (i < selectedIds.length - 1) {
          // Delay de 600ms para evitar bloqueos del navegador
          await new Promise((resolve) => setTimeout(resolve, 600))
        }
      }
      toast.success('Todos los comprobantes seleccionados han sido procesados.')
      setSelectedIds([])
    } catch {
      toast.error('Ocurrió un error en la descarga masiva.')
    } finally {
      setDescargando(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredItems.map((item) => item.id_venta))
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-5">
      {/* Filtros de búsqueda e intervalo de fechas */}
      <div className="bg-white p-5 rounded-2xl border border-[#5c0f1b]/10 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente o ID de pedido..."
              className="px-4 py-2.5 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] outline-none flex-1 focus:ring-2 focus:ring-[#5c0f1b]/20 focus:border-[#5c0f1b]"
            />
          </div>
          <FiltrosFechas desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2.5 rounded-xl border border-stone-200 bg-[#faf8f5] hover:bg-[#5c0f1b]/5 cursor-pointer transition active:scale-95"
              title="Refrescar"
            >
              <RefreshCw className={cn('h-4 w-4 text-[#5c0f1b]', isFetching && 'animate-spin')} />
            </button>
            <button
              onClick={handleDescargarVarios}
              disabled={descargando || selectedIds.length === 0}
              className="inline-flex items-center gap-2 bg-[#5c0f1b] hover:bg-[#7a1525] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {descargando ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Generar PDF ({selectedIds.length})
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Cargando />
      ) : !filteredItems.length ? (
        <Vacio mensaje="No se encontraron comprobantes para los filtros ingresados." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-[#5c0f1b]/70 font-bold uppercase tracking-wider text-[11px] border-b border-stone-100">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
                    onChange={toggleSelectAll}
                    className="rounded text-[#5c0f1b] focus:ring-[#5c0f1b] cursor-pointer h-4 w-4"
                  />
                </th>
                <th className="px-4 py-3 text-left">Pedido</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Fecha Emisión</th>
                <th className="px-4 py-3 text-left">Base Imponible</th>
                <th className="px-4 py-3 text-left">IGV</th>
                <th className="px-4 py-3 text-left">Total Final</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-[#2a1115] font-semibold">
              {filteredItems.map((item) => {
                const isSelected = selectedIds.includes(item.id_venta)
                const baseVal = Number(item.base_imponible)
                const igvVal = Number(item.igv)
                const totalFinalCalculado = Number(item.total) + igvVal
                return (
                  <tr key={item.id_venta} className={cn("hover:bg-[#faf8f5]/50 transition", isSelected && "bg-[#5c0f1b]/2")}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id_venta)}
                        className="rounded text-[#5c0f1b] focus:ring-[#5c0f1b] cursor-pointer h-4 w-4"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-black text-[#5c0f1b]">
                        #{item.id_venta}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black">{item.cliente}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs font-mono">
                      {new Date(item.fecha_venta).toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-stone-600">{money(baseVal)}</td>
                    <td className="px-4 py-3 text-stone-600">{money(igvVal)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-black text-[#5c0f1b]">
                          {money(totalFinalCalculado)}
                        </span>
                        {(!!item.id_cupon_cliente || !!item.cupon_codigo) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md mt-0.5 w-max">
                            🏷️ {item.cupon_codigo ? `Cupón: ${item.cupon_codigo}` : 'Cupón Usado'}
                            {Number(item.monto_descuento_cupon || 0) > 0 && ` (-${money(Number(item.monto_descuento_cupon))})`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDescargar(item.id_venta)}
                        className="inline-flex items-center gap-1.5 bg-stone-100 hover:bg-[#5c0f1b]/10 text-stone-700 hover:text-[#5c0f1b] text-xs font-black px-3 py-1.5 rounded-xl transition cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        PDF
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── 7. Fidelización CriptoTrufas ───────────────────────────────────────────────

function ReporteFidelizacionTab() {
  const { data, isLoading, isFetching, refetch } = useReporteQuery('fidelizacion')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => refetch()}
          className="p-2.5 rounded-xl border border-stone-200 bg-[#faf8f5] hover:bg-[#5c0f1b]/5 cursor-pointer"
          title="Refrescar"
        >
          <RefreshCw className={cn('h-4 w-4 text-[#5c0f1b]', isFetching && 'animate-spin')} />
        </button>
        <ExportarBotones tipo="fidelizacion" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Clientes" value={data?.total_clientes ?? 0} />
        <KpiCard label="Puntos circulación" value={data?.puntos_circulacion ?? 0} accent="orange" />
        <KpiCard label="Cupones disponibles" value={data?.cupones_disponibles_total ?? 0} accent="green" />
      </div>

      {isLoading ? (
        <Cargando />
      ) : !data?.items?.length ? (
        <Vacio mensaje="No hay clientes con actividad de fidelización." />
      ) : (
        <Tabla headers={['ID', 'Cliente', 'Email', 'Saldo puntos', 'Puntos usados']}>
          {data.items.map((c) => (
            <tr key={c.id_cliente} className="hover:bg-[#faf8f5]/50">
              <td className="px-4 py-3">#{c.id_cliente}</td>
              <td className="px-4 py-3 font-black">{c.cliente}</td>
              <td className="px-4 py-3 text-stone-500">{c.email}</td>
              <td className="px-4 py-3">
                <Badge texto={String(c.saldo_puntos)} tono="naranja" />
              </td>
              <td className="px-4 py-3 text-stone-500">{c.puntos_usados}</td>
            </tr>
          ))}
        </Tabla>
      )}
    </div>
  )
}
