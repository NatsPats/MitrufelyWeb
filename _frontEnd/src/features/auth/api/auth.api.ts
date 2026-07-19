import api from '@/lib/axios'
import type { LoginCredentials } from '@/types/auth'

export interface RegisterPayload {
  first_name: string
  last_name: string
  email: string
  password: string
  phone?: string
}

export interface AuthTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface RegisterResponse {
  user_id: number
  email: string
  message: string
}

export interface ResetPasswordPayload {
  token: string
  new_password: string
}

export interface UserMeResponse {
  id_usuario: number
  nombres: string
  apellidos: string
  email: string
  telefono: string | null
  estado: boolean
  auth_provider: string
  rol: {
    id_rol: number
    nombre: string
  }
  cliente?: {
    id_cliente: number
    direccion: string | null
    referencia: string | null
    telefono: string | null
  } | null
  avatar_url?: string | null
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthTokenResponse> => {
    const { data } = await api.post<AuthTokenResponse>('/auth/login', credentials)
    return data
  },

  loginWithGoogle: async (idToken: string): Promise<AuthTokenResponse> => {
    const { data } = await api.post<AuthTokenResponse>('/auth/google', { id_token: idToken })
    return data
  },

  register: async (payload: RegisterPayload): Promise<RegisterResponse> => {
    const { data } = await api.post<RegisterResponse>('/auth/register', payload)
    return data
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout')
  },

  getMe: async (): Promise<UserMeResponse> => {
    const { data } = await api.get<UserMeResponse>('/auth/me')
    return data
  },

  verify: async (token: string): Promise<{ message: string }> => {
    const { data } = await api.get<{ message: string }>('/auth/verify', {
      params: { token },
    })
    return data
  },

  requestPasswordReset: async (email: string): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>('/auth/forgot-password', { email })
    return data
  },

  resetPassword: async (payload: ResetPasswordPayload): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>('/auth/reset-password', payload)
    return data
  }
}
