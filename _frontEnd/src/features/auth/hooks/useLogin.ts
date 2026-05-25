import { useMutation } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '@/app/store'
import type { LoginCredentials } from '@/types/auth'

export function decodeJwt(token: string): any {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64Url = parts[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

export function mapRole(backendRole: string): 'admin' | 'manager' | 'baker' | 'cashier' | 'customer' {
  const role = backendRole.toUpperCase()
  if (role === 'ADMIN') return 'admin'
  if (role === 'CLIENTE') return 'customer'
  if (role === 'CAJERO') return 'cashier'
  if (role === 'ALMACEN') return 'baker'
  return 'customer'
}

export function useLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUser = useAuthStore((s) => s.setUser)

  const from = (location.state as any)?.from?.pathname || '/'

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      const decoded = decodeJwt(data.access_token)
      if (!decoded) {
        toast.error('Token inválido recibido del servidor.')
        return
      }

      // Estructuramos el usuario extrayendo datos del JWT
      const user = {
        id: decoded.sub,
        email: decoded.extra?.email || '',
        name: decoded.extra?.email ? decoded.extra.email.split('@')[0] : 'Usuario',
        role: mapRole(decoded.role),
        sweetCoinsBalance: 1000, // puntos iniciales para la UI
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setUser(user, data.access_token, data.refresh_token)
      toast.success('¡Sesión iniciada correctamente!')
      navigate(from, { replace: true })
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Credenciales incorrectas o error de conexión.'
      toast.error(message)
    },
  })
}
