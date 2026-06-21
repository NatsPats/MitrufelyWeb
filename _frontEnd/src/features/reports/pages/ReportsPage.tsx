import { useState, useMemo } from 'react'
import {
  FileText,
  Printer,
  Calendar,
  Boxes,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileSpreadsheet,
  AlertOctagon,
  ArrowRight,
} from 'lucide-react'
import ExcelJS from 'exceljs'
import { cn } from '@/lib/utils'

import { useAdminProducts } from '@/features/products/hooks/useCatalogAdmin'
import { useOrdersQuery } from '@/features/orders/hooks/useOrders'
import { useReconciliationQuery } from '@/features/inventory/hooks/useInventory'

type ReportType = 'inventory' | 'sales' | 'audit'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportType>('inventory')

  // --- FILTERS STATE ---
  // Inventory Filters
  const [invStockFilter, setInvStockFilter] = useState<'all' | 'low' | 'out' | 'available'>('all')

  // Sales Filters
  const today = new Date()
  const defaultStartDate =
    new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
      .toISOString()
      .split('T')[0] || ''
  const defaultEndDate = today.toISOString().split('T')[0] || ''
  
  const [salesStartDate, setSalesStartDate] = useState<string>(defaultStartDate)
  const [salesEndDate, setSalesEndDate] = useState<string>(defaultEndDate)
  const [salesPayStatus, setSalesPayStatus] = useState<'all' | 'PAGADO' | 'PENDIENTE'>('all')

  // Audit Filters
  const [auditOnlyDiscrepancies, setAuditOnlyDiscrepancies] = useState<boolean>(false)

  // --- DATA LOADING (TanStack Query) ---
  // Fetch up to 200 products for inventory report
  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useAdminProducts({ size: 200 })
  const products = productsData?.items || []

  // Fetch up to 1000 orders for sales report
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useOrdersQuery({ limit: 100 })

  // Fetch reconciliation data for FEFO audit
  const { data: reconciliation = [], isLoading: reconLoading, refetch: refetchRecon } = useReconciliationQuery(false)

  const isLoading = productsLoading || ordersLoading || reconLoading

  // --- REFRESH HANDLER ---
  const handleRefreshData = () => {
    if (activeTab === 'inventory') refetchProducts()
    else if (activeTab === 'sales') refetchOrders()
    else if (activeTab === 'audit') refetchRecon()
  }

  // --- CATEGORIES HELPER ---
  const getCategoryName = (idCategoria: number | null) => {
    if (!idCategoria) return 'Sin categoría'
    switch (idCategoria) {
      case 1:
        return 'Best Sellers'
      case 2:
        return 'Nuevos Sabores'
      case 3:
        return 'Promociones'
      default:
        return `Categoría #${idCategoria}`
    }
  }

  // --- FILTERED DATA COMPUTATION ---
  // 1. Filtered Inventory
  const filteredInventory = useMemo(() => {
    return products.filter((p) => {
      if (invStockFilter === 'out') return p.stock_actual === 0
      if (invStockFilter === 'low') return p.stock_actual > 0 && p.stock_actual <= p.stock_minimo
      if (invStockFilter === 'available') return p.stock_actual > p.stock_minimo
      return true
    })
  }, [products, invStockFilter])

  // 2. Filtered Sales
  const filteredSales = useMemo(() => {
    return orders.filter((order) => {
      // Date filter
      if (order.fecha_venta) {
        const orderDateStr = order.fecha_venta.split('T')[0] || ''
        if (salesStartDate && orderDateStr < salesStartDate) return false
        if (salesEndDate && orderDateStr > salesEndDate) return false
      }
      // Status filter
      if (salesPayStatus !== 'all' && order.estado_pago !== salesPayStatus) return false
      return true
    })
  }, [orders, salesStartDate, salesEndDate, salesPayStatus])

  // 3. Filtered Audit
  const filteredAudit = useMemo(() => {
    return reconciliation.filter((r) => {
      if (auditOnlyDiscrepancies) return r.descuadrado
      return true
    })
  }, [reconciliation, auditOnlyDiscrepancies])

  // --- METRICS COMPUTATION ---
  const inventoryMetrics = useMemo(() => {
    const total = products.length
    const lowStock = products.filter((p) => p.stock_actual > 0 && p.stock_actual <= p.stock_minimo).length
    const outOfStock = products.filter((p) => p.stock_actual === 0).length
    const totalValuation = products.reduce((sum, p) => sum + p.precio * p.stock_actual, 0)
    return { total, lowStock, outOfStock, totalValuation }
  }, [products])

  const salesMetrics = useMemo(() => {
    const totalCount = filteredSales.length
    const paidCount = filteredSales.filter((s) => s.estado_pago === 'PAGADO').length
    
    // Base imponible y IGV sumatorios
    const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.total), 0)
    const paidRevenue = filteredSales
      .filter((s) => s.estado_pago === 'PAGADO')
      .reduce((sum, s) => sum + Number(s.total), 0)
      
    const baseImponibleTotal = filteredSales.reduce((sum, s) => {
      return sum + (s.base_imponible ?? Number(s.total) / 1.18)
    }, 0)

    const igvTotal = filteredSales.reduce((sum, s) => {
      return sum + (s.igv ?? (Number(s.total) - (s.base_imponible ?? Number(s.total) / 1.18)))
    }, 0)

    return { totalCount, paidCount, totalRevenue, paidRevenue, baseImponibleTotal, igvTotal }
  }, [filteredSales])

  const auditMetrics = useMemo(() => {
    const totalAudited = reconciliation.length
    const discrepancies = reconciliation.filter((r) => r.descuadrado).length
    return { totalAudited, discrepancies, isClean: discrepancies === 0 }
  }, [reconciliation])

  // --- EXPORT TO EXCEL (EXCELJS) ---
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Reporte Corporativo')

    // Style elements
    const titleStyle = { font: { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5C0F1B' } } }
    const headerStyle = { font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7A1525' } } }
    const totalRowStyle = { font: { name: 'Arial', size: 11, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF6F0' } } }

    if (activeTab === 'inventory') {
      sheet.mergeCells('A1:G1')
      const titleRow = sheet.getCell('A1')
      titleRow.value = 'REPORTE CORPORATIVO DE INVENTARIO - MITRUFELY'
      titleRow.style = titleStyle as any
      titleRow.alignment = { horizontal: 'center' }

      sheet.addRow([])
      sheet.addRow(['Generado el:', new Date().toLocaleString('es-PE')])
      sheet.addRow(['Filtro aplicado:', invStockFilter.toUpperCase()])
      sheet.addRow(['Valorización Total:', `S/. ${Number(inventoryMetrics.totalValuation || 0).toFixed(2)}`])
      sheet.addRow([])

      // Table headers
      const headers = ['ID Producto', 'Nombre', 'Categoría', 'Precio Unitario', 'Stock Mínimo', 'Stock Actual', 'Estado Almacén']
      const row = sheet.addRow(headers)
      row.eachCell((cell) => { cell.style = headerStyle as any })

      filteredInventory.forEach((p) => {
        const status = p.stock_actual === 0 ? 'AGOTADO' : (p.stock_actual <= p.stock_minimo ? 'BAJO STOCK' : 'DISPONIBLE')
        sheet.addRow([
          p.id_producto,
          p.nombre,
          getCategoryName(p.id_categoria),
          p.precio,
          p.stock_minimo,
          p.stock_actual,
          status
        ])
      })

      // Column widths
      sheet.columns.forEach((col, idx) => {
        col.width = ([15, 30, 20, 15, 15, 15, 15][idx] ?? 15) as number
      })

    } else if (activeTab === 'sales') {
      sheet.mergeCells('A1:G1')
      const titleRow = sheet.getCell('A1')
      titleRow.value = 'REPORTE CORPORATIVO DE VENTAS - MITRUFELY'
      titleRow.style = titleStyle as any
      titleRow.alignment = { horizontal: 'center' }

      sheet.addRow([])
      sheet.addRow(['Generado el:', new Date().toLocaleString('es-PE')])
      sheet.addRow(['Rango de Fechas:', `${salesStartDate} a ${salesEndDate}`])
      sheet.addRow(['Estado de Pago:', salesPayStatus.toUpperCase()])
      sheet.addRow([])

      // Table headers
      const headers = ['ID Venta', 'Fecha y Hora', 'ID Cliente', 'Estado Pago', 'Base Imponible', 'IGV', 'Total (S/.)']
      const row = sheet.addRow(headers)
      row.eachCell((cell) => { cell.style = headerStyle as any })

      filteredSales.forEach((s) => {
        const base = s.base_imponible ?? (Number(s.total) / 1.18)
        const igv = s.igv ?? (Number(s.total) - base)
        sheet.addRow([
          s.id_venta,
          new Date(s.fecha_venta).toLocaleString('es-PE'),
          s.id_cliente,
          s.estado_pago,
          base,
          igv,
          Number(s.total)
        ])
      })

      // Summary row
      sheet.addRow([])
      const totalRow = sheet.addRow([
        'TOTAL GENERAL', '', '', '',
        salesMetrics.baseImponibleTotal,
        salesMetrics.igvTotal,
        salesMetrics.totalRevenue
      ])
      totalRow.eachCell((cell) => { cell.style = totalRowStyle as any })

      // Column widths
      sheet.columns.forEach((col, idx) => {
        col.width = ([15, 25, 15, 15, 18, 15, 18][idx] ?? 15) as number
      })

    } else if (activeTab === 'audit') {
      sheet.mergeCells('A1:F1')
      const titleRow = sheet.getCell('A1')
      titleRow.value = 'REPORTE DE AUDITORÍA Y CONCILIACIÓN FEFO - MITRUFELY'
      titleRow.style = titleStyle as any
      titleRow.alignment = { horizontal: 'center' }

      sheet.addRow([])
      sheet.addRow(['Generado el:', new Date().toLocaleString('es-PE')])
      sheet.addRow(['Discrepancias encontradas:', `${auditMetrics.discrepancies} productos desalineados`])
      sheet.addRow([])

      // Table headers
      const headers = ['ID Producto', 'Producto', 'Stock Actual (Caché)', 'Kardex (Transaccional)', 'Lotes Activos (Físico)', 'Estado Conciliación']
      const row = sheet.addRow(headers)
      row.eachCell((cell) => { cell.style = headerStyle as any })

      filteredAudit.forEach((r) => {
        sheet.addRow([
          r.id_producto,
          r.nombre,
          r.stock_actual,
          r.stock_calculado_kardex,
          r.stock_calculado_lotes,
          r.descuadrado ? 'DESALINEADO' : 'CUADRADO'
        ])
      })

      // Column widths
      sheet.columns.forEach((col, idx) => {
        col.width = ([15, 30, 20, 22, 22, 20][idx] ?? 15) as number
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `reporte_mitrufely_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`
    link.click()
  }

  // --- PRINT WINDOW ---
  const handlePrint = () => {
    window.print()
  }

  const activeReportName = useMemo(() => {
    if (activeTab === 'inventory') return 'Reporte de Inventario de Productos'
    if (activeTab === 'sales') return 'Reporte de Ventas y Rendimiento'
    return 'Reporte de Auditoría y Conciliación FEFO'
  }, [activeTab])

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased pb-12 print:bg-white print:pb-0">
      
      {/* ========================================================================= */}
      {/* 1. SCREEN LAYOUT (Hidden in print mode)                                   */}
      {/* ========================================================================= */}
      <div className="print:hidden">
        {/* Header */}
        <header className="bg-white border-b border-[#5c0f1b]/10 sticky top-0 z-40 backdrop-blur-md bg-white/95">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black bg-[#ff7a45]/12 border border-[#ff7a45]/20 px-2.5 py-1 rounded-full text-[#ff7a45] uppercase tracking-wide">
                  Módulo de Inteligencia
                </span>
                <Sparkles className="h-4 w-4 text-[#ff7a45] animate-pulse" />
              </div>
              <h1 className="text-2xl font-black text-[#5c0f1b] tracking-tight mt-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Reportes y Exportación Corporativa
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefreshData}
                disabled={isLoading}
                className="inline-flex items-center justify-center h-10 w-10 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 rounded-xl transition-all border-none cursor-pointer disabled:opacity-50"
                title="Refrescar datos"
              >
                <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
              </button>
              
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 bg-[#5c0f1b] text-white hover:bg-[#7a1525] active:scale-98 transition-all px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-[#5c0f1b]/15 border-none cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Imprimir (PDF)
              </button>

              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98 transition-all px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-600/15 border-none cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          
          {/* Tab Selector Buttons */}
          <div className="flex border-b border-stone-200">
            <button
              onClick={() => setActiveTab('inventory')}
              className={cn(
                'pb-4 px-6 text-sm font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer',
                activeTab === 'inventory'
                  ? 'border-[#5c0f1b] text-[#5c0f1b]'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              )}
            >
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4" />
                Inventario y Stock
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('sales')}
              className={cn(
                'pb-4 px-6 text-sm font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer',
                activeTab === 'sales'
                  ? 'border-[#5c0f1b] text-[#5c0f1b]'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              )}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Ventas y Facturación
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('audit')}
              className={cn(
                'pb-4 px-6 text-sm font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer',
                activeTab === 'audit'
                  ? 'border-[#5c0f1b] text-[#5c0f1b]'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              )}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Conciliación y Auditoría
              </div>
            </button>
          </div>

          {/* ============================================== */}
          {/* TABS VIEW CONTROLLERS (SCREEN)                 */}
          {/* ============================================== */}
          
          {/* TAB 1: INVENTARIO */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-stone-400">Total Productos</p>
                  <p className="text-2xl font-black text-[#5c0f1b] mt-1">{inventoryMetrics.total}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-stone-400">Productos Bajo Stock</p>
                  <p className={cn("text-2xl font-black mt-1", inventoryMetrics.lowStock > 0 ? "text-amber-600" : "text-stone-700")}>
                    {inventoryMetrics.lowStock}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-stone-400">Productos Agotados</p>
                  <p className={cn("text-2xl font-black mt-1", inventoryMetrics.outOfStock > 0 ? "text-red-600 animate-pulse" : "text-stone-700")}>
                    {inventoryMetrics.outOfStock}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-stone-400">Valorización del Almacén</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">S/. {Number(inventoryMetrics.totalValuation || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Filters Panel */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-stone-500 uppercase">Filtrar por Stock:</span>
                  <div className="flex bg-stone-100 rounded-lg p-1">
                    {(['all', 'low', 'out', 'available'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setInvStockFilter(filter)}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-black cursor-pointer transition-all border-none",
                          invStockFilter === filter
                            ? "bg-[#5c0f1b] text-white"
                            : "text-stone-500 hover:text-stone-700"
                        )}
                      >
                        {filter === 'all' && 'Todos'}
                        {filter === 'low' && 'Bajo Stock'}
                        {filter === 'out' && 'Agotados'}
                        {filter === 'available' && 'Disponible'}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-xs font-bold text-stone-400">
                  Mostrando {filteredInventory.length} de {products.length} productos
                </span>
              </div>

              {/* Screen Table */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-stone-600">
                    <thead className="bg-stone-50 text-stone-700 text-xs font-black uppercase tracking-wider border-b border-stone-200">
                      <tr>
                        <th className="py-4 px-6">ID</th>
                        <th className="py-4 px-6">Producto</th>
                        <th className="py-4 px-6">Categoría</th>
                        <th className="py-4 px-6 text-right">Precio unitario</th>
                        <th className="py-4 px-6 text-right">Stock Mínimo</th>
                        <th className="py-4 px-6 text-right">Stock Actual</th>
                        <th className="py-4 px-6 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-stone-400 font-bold">
                            Cargando productos de la base de datos...
                          </td>
                        </tr>
                      ) : filteredInventory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-stone-400">
                            Ningún producto coincide con el filtro de stock.
                          </td>
                        </tr>
                      ) : (
                        filteredInventory.map((p) => {
                          const isAgotado = p.stock_actual === 0
                          const isBajo = p.stock_actual > 0 && p.stock_actual <= p.stock_minimo
                          return (
                            <tr key={p.id_producto} className="hover:bg-stone-50 transition-colors">
                              <td className="py-4 px-6 font-mono text-xs font-bold text-stone-400">#{p.id_producto}</td>
                              <td className="py-4 px-6 font-bold text-[#2a1115]">{p.nombre}</td>
                              <td className="py-4 px-6 text-stone-500">{getCategoryName(p.id_categoria)}</td>
                              <td className="py-4 px-6 text-right font-semibold">S/. {Number(p.precio).toFixed(2)}</td>
                              <td className="py-4 px-6 text-right font-medium text-stone-400">{p.stock_minimo} uds</td>
                              <td className="py-4 px-6 text-right font-bold text-stone-800">{p.stock_actual} uds</td>
                              <td className="py-4 px-6 text-center">
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                  isAgotado
                                    ? "bg-red-50 text-red-600 border-red-200"
                                    : isBajo
                                    ? "bg-amber-50 text-amber-600 border-amber-200"
                                    : "bg-green-50 text-green-700 border-green-200"
                                )}>
                                  {isAgotado ? 'Agotado' : isBajo ? 'Bajo Stock' : 'Disponible'}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VENTAS & RENDIMIENTO */}
          {activeTab === 'sales' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-stone-400">Órdenes Totales</p>
                  <p className="text-2xl font-black text-[#5c0f1b] mt-1">{salesMetrics.totalCount}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-stone-400">Total Base Imponible</p>
                  <p className="text-2xl font-black text-stone-700 mt-1">S/. {Number(salesMetrics.baseImponibleTotal || 0).toFixed(2)}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-stone-400">Total IGV (18%)</p>
                  <p className="text-2xl font-black text-stone-700 mt-1">S/. {Number(salesMetrics.igvTotal || 0).toFixed(2)}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-stone-400">Ventas Cobradas (Suma Total)</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">S/. {Number(salesMetrics.totalRevenue || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Filters Panel */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-6">
                <div className="flex flex-wrap items-center gap-6">
                  {/* Date range picker */}
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-stone-400" />
                    <span className="text-xs font-bold text-stone-500 uppercase">Rango:</span>
                    <input
                      type="date"
                      value={salesStartDate}
                      onChange={(e) => setSalesStartDate(e.target.value)}
                      className="border border-stone-200 rounded-lg p-2 text-xs font-semibold focus:outline-[#5c0f1b] text-stone-700 bg-stone-50"
                    />
                    <ArrowRight className="h-3.5 w-3.5 text-stone-400" />
                    <input
                      type="date"
                      value={salesEndDate}
                      onChange={(e) => setSalesEndDate(e.target.value)}
                      className="border border-stone-200 rounded-lg p-2 text-xs font-semibold focus:outline-[#5c0f1b] text-stone-700 bg-stone-50"
                    />
                  </div>

                  {/* Payment Status */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-stone-500 uppercase">Estado Pago:</span>
                    <select
                      value={salesPayStatus}
                      onChange={(e: any) => setSalesPayStatus(e.target.value)}
                      className="border border-stone-200 rounded-lg p-2 text-xs font-semibold focus:outline-[#5c0f1b] text-stone-700 bg-stone-50"
                    >
                      <option value="all">Todos</option>
                      <option value="PAGADO">Cobrados (Pagado)</option>
                      <option value="PENDIENTE">Pendientes de Pago</option>
                    </select>
                  </div>
                </div>

                <span className="text-xs font-bold text-stone-400">
                  Mostrando {filteredSales.length} de {orders.length} pedidos en rango
                </span>
              </div>

              {/* Screen Table */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-stone-600">
                    <thead className="bg-stone-50 text-stone-700 text-xs font-black uppercase tracking-wider border-b border-stone-200">
                      <tr>
                        <th className="py-4 px-6">ID Pedido</th>
                        <th className="py-4 px-6">Fecha y Hora</th>
                        <th className="py-4 px-6">ID Cliente</th>
                        <th className="py-4 px-6">Estado Pago</th>
                        <th className="py-4 px-6 text-right">Base Imponible</th>
                        <th className="py-4 px-6 text-right">IGV (18%)</th>
                        <th className="py-4 px-6 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-stone-400 font-bold">
                            Cargando listado de ventas...
                          </td>
                        </tr>
                      ) : filteredSales.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-stone-400">
                            No se encontraron transacciones en el rango de fechas.
                          </td>
                        </tr>
                      ) : (
                        filteredSales.map((s) => {
                          const base = s.base_imponible ?? (Number(s.total) / 1.18)
                          const igv = s.igv ?? (Number(s.total) - base)
                          return (
                            <tr key={s.id_venta} className="hover:bg-stone-50 transition-colors">
                              <td className="py-4 px-6 font-mono text-xs font-bold text-[#5c0f1b]">#{s.id_venta}</td>
                              <td className="py-4 px-6 font-semibold">
                                {new Date(s.fecha_venta).toLocaleString('es-PE', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-4 px-6 font-mono text-xs text-stone-400">Cliente #{s.id_cliente}</td>
                              <td className="py-4 px-6">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border",
                                  s.estado_pago === 'PAGADO'
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                )}>
                                  {s.estado_pago === 'PAGADO' ? 'Cobrado' : 'Pendiente'}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right text-stone-500 font-medium">S/. {Number(base || 0).toFixed(2)}</td>
                              <td className="py-4 px-6 text-right text-stone-500 font-medium">S/. {Number(igv || 0).toFixed(2)}</td>
                              <td className="py-4 px-6 text-right font-black text-stone-800">S/. {Number(s.total).toFixed(2)}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONCILIACIÓN & AUDITORÍA FEFO */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              {/* Summary Audit Panel */}
              <div className={cn(
                'p-6 rounded-3xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6',
                auditMetrics.isClean
                  ? 'bg-green-50/50 border-green-200/60'
                  : 'bg-red-50/50 border-red-200/60'
              )}>
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'p-3.5 rounded-2xl',
                    auditMetrics.isClean ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  )}>
                    {auditMetrics.isClean ? (
                      <CheckCircle className="h-7 w-7" />
                    ) : (
                      <AlertTriangle className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <h3 className={cn(
                      'text-xl font-black',
                      auditMetrics.isClean ? 'text-green-800' : 'text-red-800'
                    )} style={{ fontFamily: "'Outfit', sans-serif" }}>
                      {auditMetrics.isClean
                        ? 'Auditoría Cuadrada Sin Desviaciones'
                        : 'Se detectaron discrepancias en existencias'}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1 max-w-xl">
                      El sistema valida de forma cruzada el stock registrado en el caché de Redis contra los lotes físicos activos en almacén (FIFO/FEFO) y la sumatoria transaccional del Kardex.
                    </p>
                    {!auditMetrics.isClean && (
                      <p className="text-xs font-black text-red-600 mt-3 flex items-center gap-1.5">
                        <AlertOctagon className="h-4 w-4" />
                        Atención: Hay {auditMetrics.discrepancies} producto(s) desalineado(s) que requieren corrección de inventario.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="text-right print:hidden">
                    <span className="text-[10px] font-black uppercase text-stone-400 block">Auditoría Triple</span>
                    <span className="text-xs font-bold text-stone-600 block">{auditMetrics.totalAudited} Productos Auditados</span>
                  </div>
                </div>
              </div>

              {/* Filters Panel */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-stone-500 uppercase">Filtrar por Auditoría:</span>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-stone-600">
                    <input
                      type="checkbox"
                      checked={auditOnlyDiscrepancies}
                      onChange={(e) => setAuditOnlyDiscrepancies(e.target.checked)}
                      className="h-4 w-4 accent-[#5c0f1b]"
                    />
                    Mostrar solo discrepancias (Desalineados)
                  </label>
                </div>
                <span className="text-xs font-bold text-stone-400">
                  Mostrando {filteredAudit.length} de {reconciliation.length} productos analizados
                </span>
              </div>

              {/* Screen Table */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-stone-600">
                    <thead className="bg-stone-50 text-stone-700 text-xs font-black uppercase tracking-wider border-b border-stone-200">
                      <tr>
                        <th className="py-4 px-6">ID</th>
                        <th className="py-4 px-6">Producto</th>
                        <th className="py-4 px-6 text-right">Stock Caché</th>
                        <th className="py-4 px-6 text-right">Kardex (Transaccional)</th>
                        <th className="py-4 px-6 text-right">Lotes Activos (Físico)</th>
                        <th className="py-4 px-6 text-right">Desviación</th>
                        <th className="py-4 px-6 text-center">Estado Auditoría</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-stone-400 font-bold">
                            Corriendo conciliación cruzada de almacén...
                          </td>
                        </tr>
                      ) : filteredAudit.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-stone-400">
                            No se encontraron desajustes de stock en esta auditoría.
                          </td>
                        </tr>
                      ) : (
                        filteredAudit.map((r) => {
                          const drift = r.stock_actual - r.stock_calculado_lotes
                          return (
                            <tr key={r.id_producto} className="hover:bg-stone-50 transition-colors">
                              <td className="py-4 px-6 font-mono text-xs font-bold text-stone-400">#{r.id_producto}</td>
                              <td className="py-4 px-6 font-bold text-[#2a1115]">{r.nombre}</td>
                              <td className="py-4 px-6 text-right font-semibold text-stone-800">{r.stock_actual} uds</td>
                              <td className="py-4 px-6 text-right font-medium text-stone-600">{r.stock_calculado_kardex} uds</td>
                              <td className="py-4 px-6 text-right font-medium text-stone-600">{r.stock_calculado_lotes} uds</td>
                              <td className={cn(
                                "py-4 px-6 text-right font-black",
                                drift !== 0 ? "text-red-600" : "text-stone-400"
                              )}>
                                {drift > 0 ? `+${drift}` : drift}
                              </td>
                              <td className="py-4 px-6 text-center">
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                  r.descuadrado
                                    ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                                    : "bg-green-50 text-green-700 border-green-200"
                                )}>
                                  {r.descuadrado ? 'Desalineado' : 'Cuadrado'}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ========================================================================= */}
      {/* 2. PRINT LAYOUT (Only visible during print - window.print())             */}
      {/* ========================================================================= */}
      <div className="hidden print:block text-black bg-white p-8 space-y-8 max-w-full text-xs">
        
        {/* Letterhead */}
        <div className="flex justify-between items-start border-b-2 border-stone-800 pb-4">
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-[#5c0f1b]">Mitrufely Web S.A.C.</h1>
            <p className="text-stone-500 font-bold">R.U.C. 20123456789</p>
            <p className="text-stone-500">Pasaje Fino de Trufas de Chocolate y Pastelería de Lujo</p>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-black uppercase text-stone-700">Reporte de Control Administrativo</h2>
            <p className="text-stone-500"><strong>Fecha Emisión:</strong> {new Date().toLocaleString('es-PE')}</p>
            <p className="text-stone-500"><strong>Tipo de Reporte:</strong> {activeReportName}</p>
          </div>
        </div>

        {/* METRICS ROW IN PRINT VIEW */}
        {activeTab === 'inventory' && (
          <div className="grid grid-cols-4 gap-4 p-4 bg-stone-50 border border-stone-200 rounded-lg">
            <div>
              <span className="font-bold block uppercase text-stone-500 text-[9px]">Total Productos:</span>
              <span className="text-lg font-black text-[#5c0f1b]">{inventoryMetrics.total}</span>
            </div>
            <div>
              <span className="font-bold block uppercase text-stone-500 text-[9px]">Bajo Stock:</span>
              <span className="text-lg font-black text-amber-600">{inventoryMetrics.lowStock}</span>
            </div>
            <div>
              <span className="font-bold block uppercase text-stone-500 text-[9px]">Agotados:</span>
              <span className="text-lg font-black text-red-600">{inventoryMetrics.outOfStock}</span>
            </div>
            <div>
              <span className="font-bold block uppercase text-stone-500 text-[9px]">Valorización Total:</span>
              <span className="text-lg font-black text-emerald-600">S/. {Number(inventoryMetrics.totalValuation || 0).toFixed(2)}</span>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="grid grid-cols-4 gap-4 p-4 bg-stone-50 border border-stone-200 rounded-lg">
            <div>
              <span className="font-bold block uppercase text-stone-500 text-[9px]">Ventas Totales:</span>
              <span className="text-lg font-black text-[#5c0f1b]">{salesMetrics.totalCount} órdenes</span>
            </div>
            <div>
              <span className="font-bold block uppercase text-stone-500 text-[9px]">Total Base Imponible:</span>
              <span className="text-lg font-black text-stone-800">S/. {Number(salesMetrics.baseImponibleTotal || 0).toFixed(2)}</span>
            </div>
            <div>
              <span className="font-bold block uppercase text-stone-500 text-[9px]">Total IGV Recaudado:</span>
              <span className="text-lg font-black text-stone-800">S/. {Number(salesMetrics.igvTotal || 0).toFixed(2)}</span>
            </div>
            <div>
              <span className="font-bold block uppercase text-stone-500 text-[9px]">Total Recaudación:</span>
              <span className="text-lg font-black text-emerald-600">S/. {Number(salesMetrics.totalRevenue || 0).toFixed(2)}</span>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-stone-50 border border-stone-200 rounded-lg">
            <div>
              <span className="font-bold block uppercase text-stone-500 text-[9px]">Productos Fiscalizados:</span>
              <span className="text-lg font-black text-stone-800">{auditMetrics.totalAudited}</span>
            </div>
            <div>
              <span className="font-bold block uppercase text-stone-500 text-[9px]">Discrepancias en Conciliación:</span>
              <span className={cn("text-lg font-black", auditMetrics.isClean ? "text-green-700" : "text-red-700")}>
                {auditMetrics.discrepancies} discrepancias
              </span>
            </div>
            <div>
              <span className="font-bold block uppercase text-stone-500 text-[9px]">Dictamen de Almacén:</span>
              <span className={cn("text-lg font-black uppercase", auditMetrics.isClean ? "text-green-700" : "text-red-700")}>
                {auditMetrics.isClean ? "CONCILIADO" : "CON INCIDENCIAS"}
              </span>
            </div>
          </div>
        )}

        {/* PRINT TABLES */}
        <div className="border border-stone-300 rounded-lg overflow-hidden">
          {activeTab === 'inventory' && (
            <table className="w-full border-collapse text-left text-[10px]">
              <thead className="bg-stone-100 border-b border-stone-300">
                <tr>
                  <th className="py-2 px-3 border-r border-stone-200 font-bold">ID</th>
                  <th className="py-2 px-3 border-r border-stone-200 font-bold">Producto</th>
                  <th className="py-2 px-3 border-r border-stone-200 font-bold">Categoría</th>
                  <th className="py-2 px-3 border-r border-stone-200 font-bold text-right">Precio unitario</th>
                  <th className="py-2 px-3 border-r border-stone-200 text-right font-bold">Stock Mínimo</th>
                  <th className="py-2 px-3 border-r border-stone-200 text-right font-bold">Stock Actual</th>
                  <th className="py-2 px-3 text-center font-bold">Estado Almacén</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredInventory.map((p) => {
                  const isAgotado = p.stock_actual === 0
                  const isBajo = p.stock_actual > 0 && p.stock_actual <= p.stock_minimo
                  return (
                    <tr key={p.id_producto}>
                      <td className="py-2 px-3 border-r border-stone-200 font-mono">#{p.id_producto}</td>
                      <td className="py-2 px-3 border-r border-stone-200 font-bold">{p.nombre}</td>
                      <td className="py-2 px-3 border-r border-stone-200 text-stone-600">{getCategoryName(p.id_categoria)}</td>
                      <td className="py-2 px-3 border-r border-stone-200 text-right font-semibold">S/. {Number(p.precio).toFixed(2)}</td>
                      <td className="py-2 px-3 border-r border-stone-200 text-right text-stone-500">{p.stock_minimo}</td>
                      <td className="py-2 px-3 border-r border-stone-200 text-right font-bold text-stone-800">{p.stock_actual}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-bold uppercase border",
                          isAgotado
                            ? "bg-red-50 text-red-600 border-red-200"
                            : isBajo
                            ? "bg-amber-50 text-amber-600 border-amber-200"
                            : "bg-green-50 text-green-700 border-green-200"
                        )}>
                          {isAgotado ? 'Agotado' : isBajo ? 'Bajo Stock' : 'Disponible'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'sales' && (
            <table className="w-full border-collapse text-left text-[10px]">
              <thead className="bg-stone-100 border-b border-stone-300">
                <tr>
                  <th className="py-2 px-3 border-r border-stone-200 font-bold">ID Pedido</th>
                  <th className="py-2 px-3 border-r border-stone-200 font-bold">Fecha y Hora</th>
                  <th className="py-2 px-3 border-r border-stone-200 font-bold">Cliente</th>
                  <th className="py-2 px-3 border-r border-stone-200 font-bold">Estado Pago</th>
                  <th className="py-2 px-3 border-r border-stone-200 text-right font-bold">Base Imponible</th>
                  <th className="py-2 px-3 border-r border-stone-200 text-right font-bold">IGV (18%)</th>
                  <th className="py-2 px-3 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredSales.map((s) => {
                  const base = s.base_imponible ?? (Number(s.total) / 1.18)
                  const igv = s.igv ?? (Number(s.total) - base)
                  return (
                    <tr key={s.id_venta}>
                      <td className="py-2 px-3 border-r border-stone-200 font-mono font-bold">#{s.id_venta}</td>
                      <td className="py-2 px-3 border-r border-stone-200 font-medium">{new Date(s.fecha_venta).toLocaleString('es-PE')}</td>
                      <td className="py-2 px-3 border-r border-stone-200 font-mono">Cliente #{s.id_cliente}</td>
                      <td className="py-2 px-3 border-r border-stone-200 font-bold">
                        {s.estado_pago === 'PAGADO' ? 'COBRADO' : 'PENDIENTE'}
                      </td>
                      <td className="py-2 px-3 border-r border-stone-200 text-right">S/. {Number(base || 0).toFixed(2)}</td>
                      <td className="py-2 px-3 border-r border-stone-200 text-right">S/. {Number(igv || 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold">S/. {Number(s.total).toFixed(2)}</td>
                    </tr>
                  )
                })}
                {/* Total Summary Row */}
                <tr className="bg-stone-50 font-bold border-t-2 border-stone-300">
                  <td colSpan={4} className="py-2 px-3 border-r border-stone-200 text-left font-black uppercase text-stone-700">Total General del Reporte</td>
                  <td className="py-2 px-3 border-r border-stone-200 text-right">S/. {Number(salesMetrics.baseImponibleTotal || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 border-r border-stone-200 text-right">S/. {Number(salesMetrics.igvTotal || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right text-emerald-700 font-black">S/. {Number(salesMetrics.totalRevenue || 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {activeTab === 'audit' && (
            <table className="w-full border-collapse text-left text-[10px]">
              <thead className="bg-stone-100 border-b border-stone-300">
                <tr>
                  <th className="py-2 px-3 border-r border-stone-200 font-bold">ID</th>
                  <th className="py-2 px-3 border-r border-stone-200 font-bold">Producto</th>
                  <th className="py-2 px-3 border-r border-stone-200 text-right font-bold">Stock Caché</th>
                  <th className="py-2 px-3 border-r border-stone-200 text-right font-bold">Kardex (Transaccional)</th>
                  <th className="py-2 px-3 border-r border-stone-200 text-right font-bold">Lotes Activos (Físico)</th>
                  <th className="py-2 px-3 border-r border-stone-200 text-right font-bold">Desviación</th>
                  <th className="py-2 px-3 text-center font-bold">Estado Auditoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredAudit.map((r) => {
                  const drift = r.stock_actual - r.stock_calculado_lotes
                  return (
                    <tr key={r.id_producto}>
                      <td className="py-2 px-3 border-r border-stone-200 font-mono">#{r.id_producto}</td>
                      <td className="py-2 px-3 border-r border-stone-200 font-bold">{r.nombre}</td>
                      <td className="py-2 px-3 border-r border-stone-200 text-right">{r.stock_actual}</td>
                      <td className="py-2 px-3 border-r border-stone-200 text-right">{r.stock_calculado_kardex}</td>
                      <td className="py-2 px-3 border-r border-stone-200 text-right">{r.stock_calculado_lotes}</td>
                      <td className={cn(
                        "py-2 px-3 border-r border-stone-200 text-right font-bold",
                        drift !== 0 ? "text-red-600 font-black" : "text-stone-400"
                      )}>
                        {drift > 0 ? `+${drift}` : drift}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-bold uppercase border",
                          r.descuadrado
                            ? "bg-red-50 text-red-600 border-red-200"
                            : "bg-green-50 text-green-700 border-green-200"
                        )}>
                          {r.descuadrado ? 'DESALINEADO' : 'CUADRADO'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Corporate Footer */}
        <div className="pt-12 text-center text-[8px] text-stone-400 border-t border-dashed border-stone-300">
          <p>Documento de uso confidencial interno para Mitrufely Web S.A.C.</p>
          <p>© {new Date().getFullYear()} Mitrufely. Todos los derechos reservados.</p>
        </div>

      </div>

    </div>
  )
}
