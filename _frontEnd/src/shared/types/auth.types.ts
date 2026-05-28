import type { Role } from '@/shared/types/roles'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  avatarUrl?: string
  sweetCoinsBalance: number
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  accessToken: string
  /** El refresh token llega en httpOnly cookie — no se expone en JS */
  expiresIn: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  passwordConfirm: string
}

export interface AuthResponse {
  user: User
  tokens: AuthTokens
}
