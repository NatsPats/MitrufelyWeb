import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { toast } from 'sonner'

/** Almacenamiento en memoria del access token (NO en localStorage) */
let accessToken: string | null = null

/**
 * Callback de logout — se registra desde el auth store para evitar
 * import circular entre axios.ts y auth.store.ts
 */
let onLogoutCallback: (() => void) | null = null

export const setAccessToken = (token: string | null): void => {
  accessToken = token
}

export const getAccessToken = (): string | null => accessToken

/** Registra el callback de logout (llamar desde auth.store.ts) */
export const registerLogoutCallback = (cb: () => void): void => {
  onLogoutCallback = cb
}

const BASE_URL = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:8000/api/v1'

/** Instancia Axios principal */
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true, // para recibir cookies httpOnly del refresh token
})

// ─── Request interceptor: adjunta Bearer token ───────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error: unknown) => Promise.reject(error),
)

// ─── Response interceptor: manejo de errores + refresh automático ─────────────
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

const subscribeToRefresh = (callback: (token: string) => void): void => {
  refreshSubscribers.push(callback)
}

const onRefreshSuccess = (token: string): void => {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // 401 → intentar refresh silencioso
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Cola de requests mientras se refresca
        return new Promise((resolve) => {
          subscribeToRefresh((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            resolve(api(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { useAuthStore } = await import('@/app/store')
        const rToken = useAuthStore.getState().refreshToken
        if (!rToken) throw new Error('No refresh token available')

        const { data } = await axios.post<{ access_token: string; refresh_token?: string }>(
          `${BASE_URL}/auth/refresh`,
          { refresh_token: rToken },
        )
        const newToken = data.access_token
        setAccessToken(newToken)
        if (data.refresh_token) {
          useAuthStore.getState().setRefreshToken(data.refresh_token)
        }
        onRefreshSuccess(newToken)
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
        }
        return api(originalRequest)
      } catch {
        // Refresh falló → logout via callback registrado
        setAccessToken(null)
        onLogoutCallback?.()
        toast.error('Tu sesión expiró. Por favor, inicia sesión nuevamente.')
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    if (error.response?.status === 403) {
      toast.error('No tienes permisos para realizar esta acción.')
    }

    if (error.response?.status === 500) {
      toast.error('Error del servidor. Intenta nuevamente en unos momentos.')
    }

    return Promise.reject(error)
  },
)

export default api
