import { Outlet, NavLink, useLocation, Navigate } from 'react-router'
import { MessageSquare, AlertTriangle } from 'lucide-react'

export default function AdminCustomerServiceLayout() {
  const location = useLocation()

  // Redirect to reviews if exactly at /dashboard/atencion-cliente
  if (location.pathname === '/dashboard/atencion-cliente' || location.pathname === '/dashboard/atencion-cliente/') {
    return <Navigate to="/dashboard/atencion-cliente/reviews" replace />
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-stone-50/50">
      {/* Top Navbar */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto w-full">
          <nav className="flex items-center gap-6">
            <NavLink
              to="/dashboard/atencion-cliente/reviews"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-colors ${
                  isActive
                    ? 'bg-[#5c0f1b]/10 text-[#5c0f1b]'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
                }`
              }
            >
              <MessageSquare className="h-5 w-5" />
              Reseñas
            </NavLink>
            <NavLink
              to="/dashboard/atencion-cliente/incidencias"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-colors ${
                  isActive
                    ? 'bg-red-500/10 text-red-700'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
                }`
              }
            >
              <AlertTriangle className="h-5 w-5" />
              Incidencias
            </NavLink>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full">
        <Outlet />
      </div>
    </div>
  )
}
