import { useMemo } from 'react'
import { Link } from 'react-router'
import {
  Sparkles,
  TrendingUp,
  DollarSign,
  Boxes,
  ClipboardList,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle,
} from 'lucide-react'
import { motion } from 'framer-motion'
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
  Cell,
} from 'recharts'

import { useOrdersQuery } from '@/features/orders/hooks/useOrders'
import { useAdminProducts } from '@/features/products/hooks/useCatalogAdmin'
import { useReconciliationQuery } from '@/features/inventory/hooks/useInventory'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  // 1. Fetch Orders (limit to 100 recent)
  const { data: orders = [], isLoading: ordersLoading } = useOrdersQuery({ limit: 100 })

  // 2. Fetch Products for stock alerts
  const { data: productsData, isLoading: productsLoading } = useAdminProducts({ size: 100 })
  const products = productsData?.items || []

  // 3. Fetch Reconciliation for FEFO alerts
  const { data: reconciliation = [], isLoading: reconLoading } = useReconciliationQuery(false)

  const isLoading = ordersLoading || productsLoading || reconLoading

  // --- COMPUTE STATISTICS ---
  const stats = useMemo(() => {
    const totalRevenue = orders
      .filter((o) => o.estado_pago === 'PAGADO')
      .reduce((sum, o) => sum + Number(o.total), 0)

    // Today's Date range
    const today = new Date().toDateString()
    const todayOrders = orders.filter((o) => new Date(o.fecha_venta).toDateString() === today)
    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0)

    const pendingPaymentsCount = orders.filter(
      (o) => o.estado_pago === 'PENDIENTE' && o.estado !== 'ANULADO'
    ).length

    const lowStockCount = products.filter((p) => p.stock_actual <= p.stock_minimo).length

    const discrepanciesCount = reconciliation.filter((r) => r.descuadrado).length

    return {
      totalRevenue,
      todayOrdersCount: todayOrders.length,
      todayRevenue,
      pendingPaymentsCount,
      lowStockCount,
      discrepanciesCount,
    }
  }, [orders, products, reconciliation])

  // --- PROCESS CHART DATA (Sales by Date) ---
  const chartData = useMemo(() => {
    const dailyMap: Record<string, { date: string; ventas: number; ordenes: number }> = {}

    // Process last 7 days of data from orders
    orders.forEach((order) => {
      const dateStr = new Date(order.fecha_venta).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
      })
      const isPaid = order.estado_pago === 'PAGADO'

      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { date: dateStr, ventas: 0, ordenes: 0 }
      }

      dailyMap[dateStr].ordenes += 1
      if (isPaid) {
        dailyMap[dateStr].ventas += Number(order.total)
      }
    })

    // Convert to sorted array
    return Object.values(dailyMap).reverse().slice(-7)
  }, [orders])

  // --- PROCESS TOP PRODUCTS CHART ---
  const topProductsData = useMemo(() => {
    return products
      .slice(0, 5)
      .map((p) => ({
        name: p.nombre,
        stock: p.stock_actual,
      }))
  }, [products])

  const recentOrders = useMemo(() => {
    return orders.slice(0, 5)
  }, [orders])

  const criticalProducts = useMemo(() => {
    return products.filter((p) => p.stock_actual <= p.stock_minimo).slice(0, 5)
  }, [products])

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased pb-12">
      {/* Cabecera del Dashboard */}
      <header className="bg-white border-b border-[#5c0f1b]/10 sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black bg-[#ff7a45]/12 border border-[#ff7a45]/20 px-2.5 py-1 rounded-full text-[#ff7a45] uppercase tracking-wide">
                Analíticas en tiempo real
              </span>
              <Sparkles className="h-4 w-4 text-[#ff7a45] animate-pulse" />
            </div>
            <h1 className="text-2xl font-black text-[#5c0f1b] tracking-tight mt-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Panel de Control Administrativo
            </h1>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex h-[60vh] w-full items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#5c0f1b] border-t-transparent" />
            <p className="text-sm font-bold text-[#5c0f1b]">Cargando analíticas del negocio...</p>
          </div>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Grilla de Widgets de KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Widget 1: Ingresos Totales */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-3xl border border-[#5c0f1b]/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-stone-400">Ingresos Totales (Cobrados)</span>
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#5c0f1b]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  S/. {Number(stats.totalRevenue || 0).toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] text-stone-400 font-bold mt-2">
                Hoy: S/. {Number(stats.todayRevenue || 0).toFixed(2)} ({stats.todayOrdersCount} órdenes)
              </div>
            </motion.div>

            {/* Widget 2: Pedidos Pendientes de Pago */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white p-6 rounded-3xl border border-[#5c0f1b]/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-stone-400">Pagos Pendientes</span>
                <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#5c0f1b]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {stats.pendingPaymentsCount} pedidos
                </span>
              </div>
              <div className="text-[10px] text-amber-600 font-black mt-2">
                Requieren confirmación manual en Pedidos
              </div>
            </motion.div>

            {/* Widget 3: Alertas de Stock Mínimo */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-6 rounded-3xl border border-[#5c0f1b]/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-stone-400">Alertas de Stock</span>
                <div className={cn(
                  'h-9 w-9 rounded-xl flex items-center justify-center',
                  stats.lowStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                )}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#5c0f1b]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {stats.lowStockCount} alertas
                </span>
              </div>
              <div className="text-[10px] text-stone-400 font-bold mt-2">
                Productos con nivel crítico en almacén
              </div>
            </motion.div>

            {/* Widget 4: Conciliaciones Descuadradas */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white p-6 rounded-3xl border border-[#5c0f1b]/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-stone-400">Discrepancias FEFO</span>
                <div className={cn(
                  'h-9 w-9 rounded-xl flex items-center justify-center',
                  stats.discrepanciesCount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                )}>
                  <Boxes className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#5c0f1b]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {stats.discrepanciesCount} diferencias
                </span>
              </div>
              <div className="text-[10px] text-stone-400 font-bold mt-2">
                Comparativa Cache vs Lotes contables
              </div>
            </motion.div>
          </div>

          {/* Grilla de Gráficos Analíticos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Gráfico 1: Ventas en los últimos 7 días */}
            <div className="lg:col-span-2 bg-white p-6 rounded-[32px] border border-[#5c0f1b]/10 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-wider text-[#5c0f1b] mb-6 flex items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <TrendingUp className="h-4.5 w-4.5" />
                Historial de Ventas Diarias (Última semana)
              </h3>
              <div className="h-80 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#5c0f1b" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#5c0f1b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1eeea" />
                      <XAxis dataKey="date" stroke="#a39891" fontSize={11} fontWeight="bold" />
                      <YAxis stroke="#a39891" fontSize={11} fontWeight="bold" tickFormatter={(val) => `S/.${val}`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#white',
                          borderRadius: '16px',
                          border: '1px solid #5c0f1b20',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '12px',
                        }}
                        formatter={(value: any) => [`S/. ${Number(value).toFixed(2)}`, 'Ventas Cobradas']}
                      />
                      <Area type="monotone" dataKey="ventas" stroke="#5c0f1b" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-stone-400">
                    Aún no hay transacciones para graficar.
                  </div>
                )}
              </div>
            </div>

            {/* Gráfico 2: Niveles de Stock de los Primeros Productos */}
            <div className="bg-white p-6 rounded-[32px] border border-[#5c0f1b]/10 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-wider text-[#5c0f1b] mb-6 flex items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <Boxes className="h-4.5 w-4.5" />
                Inventario Crítico de Trufas
              </h3>
              <div className="h-80 w-full">
                {topProductsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProductsData} layout="vertical" margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1eeea" />
                      <XAxis type="number" stroke="#a39891" fontSize={11} fontWeight="bold" />
                      <YAxis dataKey="name" type="category" stroke="#a39891" fontSize={9} fontWeight="bold" width={80} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#white',
                          borderRadius: '16px',
                          border: '1px solid #5c0f1b20',
                          fontSize: '12px',
                        }}
                        formatter={(value) => [`${value} unidades`, 'Stock Disponible']}
                      />
                      <Bar dataKey="stock" radius={[0, 8, 8, 0]}>
                        {topProductsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.stock <= 5 ? '#ff4d4f' : '#ff7a45'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-stone-400">
                    Sin productos registrados.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grilla Inferior: Últimos Pedidos y Productos en Alerta */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Tabla: Últimos Pedidos */}
            <div className="bg-white p-6 rounded-[32px] border border-[#5c0f1b]/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-[#5c0f1b]/8 pb-3">
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#5c0f1b] flex items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    <ClipboardList className="h-4.5 w-4.5" />
                    Últimas Transacciones
                  </h3>
                  <Link to="/orders" className="text-xs font-black text-[#ff7a45] hover:text-[#5c0f1b] inline-flex items-center gap-0.5 transition-colors">
                    Ver todos
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="divide-y divide-[#5c0f1b]/6 space-y-1">
                  {recentOrders.length > 0 ? (
                    recentOrders.map((order) => (
                      <Link
                        key={order.id_venta}
                        to={`/orders/${order.id_venta}`}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-50 transition-all text-stone-700 decoration-none"
                      >
                        <div>
                          <span className="font-mono text-xs font-black text-[#5c0f1b]">#{order.id_venta}</span>
                          <span className="text-[10px] text-stone-400 font-mono block">
                            {new Date(order.fecha_venta).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className={cn(
                            'px-2 py-0.5 rounded-md text-[9px] font-black uppercase border',
                            order.estado_pago === 'PAGADO' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          )}>
                            {order.estado_pago === 'PAGADO' ? 'Cobrado' : 'Pendiente'}
                          </span>
                          <span className="font-black text-sm text-[#5c0f1b]">
                            S/. {Number(order.total).toFixed(2)}
                          </span>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="p-8 text-center text-stone-400">No hay ventas registradas.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabla: Alertas de Stock Mínimo */}
            <div className="bg-white p-6 rounded-[32px] border border-[#5c0f1b]/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-[#5c0f1b]/8 pb-3">
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#5c0f1b] flex items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    <AlertTriangle className="h-4.5 w-4.5" />
                    Alertas Críticas de Stock
                  </h3>
                  <Link to="/inventory" className="text-xs font-black text-[#ff7a45] hover:text-[#5c0f1b] inline-flex items-center gap-0.5 transition-colors">
                    Ir al Kardex
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="divide-y divide-[#5c0f1b]/6 space-y-1">
                  {criticalProducts.length > 0 ? (
                    criticalProducts.map((p) => (
                      <div key={p.id_producto} className="flex items-center justify-between p-2.5 rounded-xl bg-red-50/10 hover:bg-red-50/30 transition-all border border-red-50">
                        <div>
                          <span className="font-bold text-xs text-[#2a1115]">{p.nombre}</span>
                          <span className="text-[10px] text-red-500 font-bold block">
                            Mínimo requerido: {p.stock_minimo} uds
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-sm text-red-600 block">
                            {p.stock_actual} uds
                          </span>
                          <span className="text-[9px] font-bold text-stone-400">Stock Actual</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-emerald-600 font-bold flex flex-col items-center gap-2">
                      <CheckCircle className="h-8 w-8 text-emerald-500" />
                      <span>¡Todo en orden! No hay productos con bajo inventario.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </main>
      )}
    </div>
  )
}
