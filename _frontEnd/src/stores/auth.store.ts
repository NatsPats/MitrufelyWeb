import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { User } from '@/types/auth'
import { setAccessToken, registerLogoutCallback } from '@/lib/axios'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  refreshToken: string | null
}

interface AuthActions {
  setUser: (user: User, accessToken: string, refreshToken?: string) => void
  setRefreshToken: (token: string | null) => void
  updateUser: (partial: Partial<User>) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  persist(
    immer((set) => ({
      // ─── State ─────────────────────────────────────────────────────────────
      user: null,
      isAuthenticated: false,
      isLoading: false,
      refreshToken: null,

      // ─── Actions ───────────────────────────────────────────────────────────
      setUser: (user, accessToken, refreshToken) => {
        setAccessToken(accessToken)
        set((state) => {
          state.user = user
          state.isAuthenticated = true
          state.isLoading = false
          if (refreshToken) {
            state.refreshToken = refreshToken
          }
        })
      },

      setRefreshToken: (token) => {
        set((state) => {
          state.refreshToken = token
        })
      },

      updateUser: (partial) => {
        set((state) => {
          if (state.user) {
            Object.assign(state.user, partial)
          }
        })
      },

      logout: () => {
        setAccessToken(null)
        set((state) => {
          state.user = null
          state.isAuthenticated = false
          state.isLoading = false
          state.refreshToken = null
        })
      },

      setLoading: (loading) => {
        set((state) => {
          state.isLoading = loading
        })
      },
    })),
    {
      name: 'mitrufely-auth',
      storage: createJSONStorage(() => sessionStorage),
      // Persistimos datos de usuario e identidad y el refresh_token
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        refreshToken: state.refreshToken,
      }),
    },
  ),
)

// Registra el callback de logout en Axios para que el interceptor 401
// pueda llamar logout sin crear un import circular
registerLogoutCallback(() => {
  useAuthStore.getState().logout()
})
