import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router'
import { useAuthStore } from '@/app/store'
import { PERMISSIONS, type Role } from '@/types/roles'
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  ClipboardList,
  BarChart3,
  Coins,
  LogOut,
  Menu,
  X,
  User,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Home,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  permission?: keyof typeof PERMISSIONS
}

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Redirigir si no hay usuario o si es un cliente (los clientes no entran al panel administrativo)
  useEffect(() => {
    if (!user || user.role === 'customer') {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  if (!user || user.role === 'customer') {
    return null
  }

  const handleLogout = () => {
    logout()
    toast.success('Sesión cerrada correctamente.')
    navigate('/login')
  }

  // Definición de ítems del menú con sus permisos
  const menuItems: NavigationItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Catálogo',
      href: '/catalog/admin',
      icon: ShoppingBag,
      permission: 'VIEW_INVENTORY', // ADMIN, MANAGER, BAKER
    },
    {
      name: 'Inventario',
      href: '/inventory',
      icon: Boxes,
      permission: 'VIEW_INVENTORY', // ADMIN, MANAGER, BAKER
    },
    {
      name: 'Pedidos',
      href: '/orders',
      icon: ClipboardList,
      permission: 'VIEW_ORDERS', // ADMIN, MANAGER, CASHIER
    },
    {
      name: 'Reportes',
      href: '/reports',
      icon: BarChart3,
      permission: 'VIEW_REPORTS', // ADMIN, MANAGER
    },
    {
      name: 'SweetCoins',
      href: '/sweetcoins',
      icon: Coins,
      permission: 'VIEW_SWEETCOINS', // ADMIN, MANAGER, CUSTOMER
    },
    {
      name: 'Atención al Cliente',
      href: '/dashboard/atencion-cliente',
      icon: MessageSquare,
      permission: 'VIEW_REPORTS', // ADMIN, MANAGER
    },
  ]

  // Filtrar ítems de navegación según el rol del usuario actual
  const allowedMenuItems = menuItems.filter((item) => {
    if (!item.permission) return true
    const allowedRoles = PERMISSIONS[item.permission] as Role[]
    return allowedRoles.includes(user.role as Role)
  })

  // Obtener nombre formateado del rol
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return { label: 'Administrador', classes: 'bg-red-50 text-red-700 border-red-200' }
      case 'manager':
        return { label: 'Gerente', classes: 'bg-purple-50 text-purple-700 border-purple-200' }
      case 'baker':
        return { label: 'Repostero', classes: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'cashier':
        return { label: 'Cajero', classes: 'bg-green-50 text-green-700 border-green-200' }
      default:
        return { label: role, classes: 'bg-stone-50 text-stone-600 border-stone-200' }
    }
  }

  const roleInfo = getRoleBadge(user.role)

  return (
    <div className="flex h-screen bg-[#faf8f5] text-[#2a1115] font-sans overflow-hidden antialiased">
      {/* ─── SIDEBAR ESCRITORIO ────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-white border-r border-[#5c0f1b]/10 transition-all duration-300 relative z-20 shadow-md',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Cabecera / Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-[#5c0f1b]/10 bg-white">
          <Link to="/dashboard" className="flex items-center gap-3 decoration-none">
            <div className="h-10 w-10 bg-[#5c0f1b] rounded-xl flex items-center justify-center shadow-lg shadow-[#5c0f1b]/15 transition-transform hover:scale-105 active:scale-95">
              <Sparkles className="h-5 w-5 text-white animate-pulse" />
            </div>
            {!collapsed && (
              <span
                className="font-black text-[#5c0f1b] text-xl tracking-tight"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Mitrufely
              </span>
            )}
          </Link>
        </div>

        {/* Lista de navegación */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {allowedMenuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-extrabold transition-all group relative decoration-none',
                  isActive
                    ? 'bg-[#5c0f1b] text-white shadow-md shadow-[#5c0f1b]/15'
                    : 'text-stone-500 hover:text-[#5c0f1b] hover:bg-stone-50'
                )}
                title={collapsed ? item.name : undefined}
              >
                <Icon className={cn('h-5 w-5 transition-transform group-hover:scale-105', isActive ? 'text-white' : 'text-stone-400 group-hover:text-[#5c0f1b]')} />
                {!collapsed && <span>{item.name}</span>}
                {isActive && collapsed && (
                  <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-r-full" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Atajo a Página Principal */}
        <div className="px-4 py-2 bg-white flex flex-col items-stretch">
          <Link
            to="/"
            className={cn(
              'flex items-center rounded-xl text-sm font-extrabold transition-all group relative decoration-none bg-gradient-to-r from-[#ff7a45] to-[#ff9e7d] text-white shadow-md shadow-[#ff7a45]/20 hover:from-[#ff8e5c] hover:to-[#ffae8f] hover:scale-[1.02] active:scale-[0.98]',
              collapsed ? 'justify-center p-3' : 'gap-3.5 px-4 py-3'
            )}
            title="Ir a Página Principal"
          >
            <Home className="h-5 w-5 transition-transform group-hover:scale-110" />
            {!collapsed && <span>Página Principal</span>}
          </Link>
        </div>

        {/* Info del Usuario Logueado & Collapse / Logout */}
        <div className="p-4 border-t border-[#5c0f1b]/10 bg-stone-50/50 flex flex-col gap-3">
          {!collapsed && (
            <div className="flex items-center gap-3 p-2 bg-white border border-[#5c0f1b]/10 rounded-xl shadow-2xs">
              <div className="h-10 w-10 rounded-lg bg-[#5c0f1b]/5 border border-[#5c0f1b]/10 flex items-center justify-center text-[#5c0f1b]">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-[#2a1115] truncate leading-snug">{user.name}</p>
                <span className={cn('inline-flex border px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase mt-1 tracking-wider', roleInfo.classes)}>
                  {roleInfo.label}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            {/* Collapse button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-400 hover:text-stone-700 shadow-2xs transition-colors cursor-pointer"
              title={collapsed ? 'Expandir Sidebar' : 'Colapsar Sidebar'}
            >
              {collapsed ? <ChevronRight className="h-4.5 w-4.5" /> : <ChevronLeft className="h-4.5 w-4.5" />}
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-stone-500 hover:text-red-600 px-3.5 py-2 rounded-lg border border-stone-200 hover:border-red-200 font-extrabold text-xs transition-colors cursor-pointer',
                collapsed && 'px-2'
              )}
              title="Cerrar Sesión"
            >
              <LogOut className="h-4.5 w-4.5" />
              {!collapsed && <span>Cerrar Sesión</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── SIDEBAR MÓVIL (MENU HAMBURGUESA) ─────────────────────────────────── */}
      <div className={cn('fixed inset-0 bg-black/50 backdrop-blur-xs z-50 transition-opacity md:hidden', mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
        <aside
          className={cn(
            'fixed top-0 bottom-0 left-0 w-64 bg-white flex flex-col z-50 transition-transform duration-300 border-r border-[#5c0f1b]/10 shadow-2xl',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Cabecera / Close */}
          <div className="h-20 flex items-center justify-between px-6 border-b border-[#5c0f1b]/10 bg-white">
            <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 decoration-none">
              <div className="h-10 w-10 bg-[#5c0f1b] rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-black text-[#5c0f1b] text-xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Mitrufely
              </span>
            </Link>
            <button onClick={() => setMobileOpen(false)} className="p-1 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Menú */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {allowedMenuItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-extrabold transition-all group decoration-none',
                    isActive
                      ? 'bg-[#5c0f1b] text-white shadow-md'
                      : 'text-stone-500 hover:text-[#5c0f1b] hover:bg-stone-50'
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive ? 'text-white' : 'text-stone-400 group-hover:text-[#5c0f1b]')} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Atajo a Página Principal */}
          <div className="px-4 py-2 bg-white flex flex-col items-stretch">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-extrabold transition-all group decoration-none bg-gradient-to-r from-[#ff7a45] to-[#ff9e7d] text-white shadow-md shadow-[#ff7a45]/20 hover:from-[#ff8e5c] hover:to-[#ffae8f] hover:scale-[1.02] active:scale-[0.98]"
              title="Ir a Página Principal"
            >
              <Home className="h-5 w-5 transition-transform group-hover:scale-110" />
              <span>Página Principal</span>
            </Link>
          </div>

          {/* Info Usuario & Logout */}
          <div className="p-4 border-t border-[#5c0f1b]/10 bg-stone-50/50 flex flex-col gap-3">
            <div className="flex items-center gap-3 p-2 bg-white border border-[#5c0f1b]/10 rounded-xl shadow-2xs">
              <div className="h-10 w-10 rounded-lg bg-[#5c0f1b]/5 border border-[#5c0f1b]/10 flex items-center justify-center text-[#5c0f1b]">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-[#2a1115] truncate leading-snug">{user.name}</p>
                <span className={cn('inline-flex border px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase mt-1 tracking-wider', roleInfo.classes)}>
                  {roleInfo.label}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-stone-500 hover:text-red-600 py-3 rounded-lg border border-stone-200 hover:border-red-200 font-extrabold text-xs transition-colors cursor-pointer"
            >
              <LogOut className="h-4.5 w-4.5" />
              Cerrar Sesión
            </button>
          </div>
        </aside>
      </div>

      {/* ─── CONTENEDOR PRINCIPAL ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        
        {/* Barra superior de control (Para Toggle Móvil) */}
        <header className="h-20 bg-white border-b border-[#5c0f1b]/10 flex items-center justify-between px-6 md:px-8 flex-shrink-0 relative z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-500 md:hidden transition-colors cursor-pointer"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="hidden md:inline-flex items-center gap-1.5 bg-[#5c0f1b]/5 border border-[#5c0f1b]/10 px-3 py-1 rounded-full text-xs font-black text-[#5c0f1b] uppercase tracking-wide">
              🍫 Panel Administrativo
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col text-right">
              <span className="text-xs font-black text-[#2a1115]">{user.name}</span>
              <span className="text-[9px] font-extrabold text-stone-400 uppercase tracking-wider">{roleInfo.label}</span>
            </div>
            <div className="h-10 w-10 rounded-full bg-[#5c0f1b] border-2 border-[#faf8f5] flex items-center justify-center text-white font-black text-sm shadow-md">
              {user?.name ? user.name[0]?.toUpperCase() : 'A'}
            </div>
          </div>
        </header>

        {/* Área de Contenido React Router (Scrollable) */}
        <main className="flex-1 overflow-y-auto bg-[#faf8f5] relative">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
