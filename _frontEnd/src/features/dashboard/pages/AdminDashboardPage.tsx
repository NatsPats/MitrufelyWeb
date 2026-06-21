import { Link } from 'react-router'
import { ArrowLeft, Sparkles, Loader2, DollarSign, Package, AlertTriangle, Star, Clock, Undo2 } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { useDashboardQuery } from '../hooks/useDashboard'

export default function AdminDashboardPage() {
  const { data: metrics, isLoading, isError } = useDashboardQuery()

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased pb-12">
      {/* Cabecera */}
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
                Métricas del Negocio
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-[#5c0f1b] animate-spin" />
            <p className="text-sm font-bold text-[#2a1115]/50">Cargando métricas...</p>
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 p-6 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-semibold">
            <span>Error al cargar las métricas. Revisa tu conexión.</span>
          </div>
        )}

        {!isLoading && !isError && metrics && (
          <div className="space-y-6">
            
            {/* Tarjetas Principales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-[#5c0f1b]/10 shadow-sm flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-[#2a1115]/50 uppercase tracking-wider mb-1">Ingresos Totales</p>
                  <p className="text-2xl font-black text-[#5c0f1b]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    S/. {Number(metrics.ventas_totales_monto || 0).toFixed(2)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#5c0f1b]/10 shadow-sm flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-[#2a1115]/50 uppercase tracking-wider mb-1">Total Pedidos</p>
                  <p className="text-2xl font-black text-[#5c0f1b]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {metrics.pedidos_totales}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#5c0f1b]/10 shadow-sm flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-[#2a1115]/50 uppercase tracking-wider mb-1">Ticket Promedio</p>
                  <p className="text-2xl font-black text-[#5c0f1b]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    S/. {Number(metrics.ticket_promedio || 0).toFixed(2)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#5c0f1b]/10 shadow-sm flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-[#2a1115]/50 uppercase tracking-wider mb-1">Tiempo de Entrega</p>
                  <p className="text-2xl font-black text-[#5c0f1b]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {metrics.tiempo_promedio_entrega_minutos ? `${Math.round(metrics.tiempo_promedio_entrega_minutos)} min` : 'N/A'}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Fila secundaria: Calificación, Incidencias, Reembolsos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-[#5c0f1b]/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-full bg-yellow-50 flex items-center justify-center">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  </div>
                  <h3 className="font-black text-[#2a1115] text-sm">Satisfacción</h3>
                </div>
                <p className="text-3xl font-black text-[#2a1115] mb-1">
                  {metrics.calificacion_promedio ? Number(metrics.calificacion_promedio).toFixed(1) : 'N/A'} <span className="text-sm text-stone-400">/ 5.0</span>
                </p>
                <p className="text-xs font-bold text-stone-500">{metrics.total_calificaciones} calificaciones totales</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#5c0f1b]/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-full bg-red-50 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  <h3 className="font-black text-[#2a1115] text-sm">Incidencias</h3>
                </div>
                <p className="text-3xl font-black text-red-600 mb-1">{metrics.incidencias_abiertas}</p>
                <p className="text-xs font-bold text-stone-500">tickets abiertos requiriendo atención</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#5c0f1b]/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-full bg-rose-50 flex items-center justify-center">
                    <Undo2 className="h-4 w-4 text-rose-500" />
                  </div>
                  <h3 className="font-black text-[#2a1115] text-sm">Reembolsos & Devoluciones</h3>
                </div>
                <p className="text-3xl font-black text-rose-600 mb-1">S/. {Number(metrics.monto_reembolsado || 0).toFixed(2)}</p>
                <p className="text-xs font-bold text-stone-500">
                  {metrics.pedidos_reembolsados} reembolsados, {metrics.pedidos_devueltos} devueltos
                </p>
              </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Ventas por Día */}
              <div className="bg-white p-6 rounded-2xl border border-[#5c0f1b]/10 shadow-sm">
                <h3 className="font-black text-[#2a1115] text-sm uppercase tracking-wider mb-6">
                  Evolución de Ingresos (Últimos 7 días)
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.ventas_por_dia}>
                      <defs>
                        <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#5c0f1b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#5c0f1b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="fecha" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#6b7280' }} 
                        tickFormatter={(val) => new Date(val).toLocaleDateString('es-PE', { weekday: 'short' })}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        tickFormatter={(val) => `S/${val}`}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`S/. ${Number(value || 0).toFixed(2)}`, 'Ingresos']}
                      />
                      <Area type="monotone" dataKey="total_ingresos" stroke="#5c0f1b" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Productos más vendidos */}
              <div className="bg-white p-6 rounded-2xl border border-[#5c0f1b]/10 shadow-sm">
                <h3 className="font-black text-[#2a1115] text-sm uppercase tracking-wider mb-6">
                  Productos Más Vendidos
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.productos_mas_vendidos} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <YAxis 
                        dataKey="nombre" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#6b7280' }} 
                        width={100}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`${value} unids.`, 'Vendido']}
                      />
                      <Bar dataKey="total_vendido" fill="#ff7a45" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

          </div>
        )}
      </main>
    </div>
  )
}
