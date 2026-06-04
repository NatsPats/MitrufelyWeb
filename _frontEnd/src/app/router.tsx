import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { Suspense, lazy } from 'react'
import { useAuthStore } from '@/app/store'
import type { Permission } from '@/types/roles'
import { PERMISSIONS } from '@/types/roles'
import AdminLayout from '@/components/layout/AdminLayout'

// ─── Lazy imports ────────────────────────────────────────────────────────────
const LoginPage    = lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
const VerifyPage   = lazy(() => import('@/features/auth/pages/VerifyPage'))
const AuthCallbackPage = lazy(() => import('@/features/auth/pages/AuthCallbackPage'))
const HomePage     = lazy(() => import('@/pages/public/HomePage'))
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const InventoryPage = lazy(() => import('@/features/inventory/pages/InventoryPage'))
const CatalogAdminPage = lazy(() => import('@/features/products/pages/CatalogAdminPage'))
const CatalogPage = lazy(() => import('@/features/catalog/pages/CatalogPage'))
const OrdersPage = lazy(() => import('@/features/orders/pages/OrdersPage'))
const ReportsPage = lazy(() => import('@/features/reports/pages/ReportsPage'))
const CriptoTrufasPage = lazy(() => import('@/features/sweetcoins/pages/SweetCoinsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

// ─── Loading fallback ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    </div>
  )
}

// ─── Guard: usuario autenticado ───────────────────────────────────────────────
function RequireAuth() {
  const isAuthenticated = useAuthStore((s: { isAuthenticated: boolean }) => s.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

// ─── Guard: RBAC por permiso ──────────────────────────────────────────────────
interface RequirePermissionProps {
  permission: Permission
}

function RequirePermission({ permission }: RequirePermissionProps) {
  const user = useAuthStore(
    (s: { user: ReturnType<typeof useAuthStore.getState>['user'] }) => s.user,
  )

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const allowedRoles = PERMISSIONS[permission]
  if (!allowedRoles.includes(user.role)) {
    if (user.role === 'customer') {
      return <Navigate to="/" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

// ─── Guard: redirige si ya está autenticado ───────────────────────────────────
function GuestOnly() {
  const { isAuthenticated, user } = useAuthStore()
  if (isAuthenticated) {
    if (user?.role === 'customer') {
      return <Navigate to="/" replace />
    }
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}

// ─── Router principal ─────────────────────────────────────────────────────────
export function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Rutas públicas exclusivas para no autenticados */}
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Route>

        {/* Rutas protegidas — requieren autenticación */}
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Solo ADMIN y MANAGER */}
            <Route element={<RequirePermission permission="VIEW_INVENTORY" />}>
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/catalog/admin" element={<CatalogAdminPage />} />
            </Route>

            {/* ADMIN, MANAGER y CASHIER */}
            <Route element={<RequirePermission permission="VIEW_ORDERS" />}>
              <Route path="/orders" element={<OrdersPage />} />
            </Route>

            {/* Solo ADMIN y MANAGER */}
            <Route element={<RequirePermission permission="VIEW_REPORTS" />}>
              <Route path="/reports" element={<ReportsPage />} />
            </Route>

            {/* ADMIN, MANAGER y CUSTOMER */}
            <Route element={<RequirePermission permission="VIEW_SWEETCOINS" />}>
              <Route path="/sweetcoins" element={<CriptoTrufasPage />} />
            </Route>
          </Route>
        </Route>

        {/* Rutas públicas */}
        <Route path="/" element={<HomePage />} />
        <Route path="/catalogo" element={<CatalogPage />} />

        {/* Ruta de verificación pública */}
        <Route path="/verify" element={<VerifyPage />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
