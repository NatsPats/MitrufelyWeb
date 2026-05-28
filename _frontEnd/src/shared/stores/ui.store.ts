import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

type Theme = 'light' | 'dark' | 'system'

interface UiState {
  theme: Theme
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  globalLoading: boolean
  loadingMessage: string
}

interface UiActions {
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setGlobalLoading: (loading: boolean, message?: string) => void
}

type UiStore = UiState & UiActions

export const useUiStore = create<UiStore>()(
  immer((set) => ({
    // ─── State ───────────────────────────────────────────────────────────────
    theme: 'system',
    sidebarOpen: true,
    sidebarCollapsed: false,
    globalLoading: false,
    loadingMessage: 'Cargando…',

    // ─── Actions ─────────────────────────────────────────────────────────────
    setTheme: (theme) => {
      set((state) => {
        state.theme = theme
      })
    },

    toggleSidebar: () => {
      set((state) => {
        state.sidebarOpen = !state.sidebarOpen
      })
    },

    setSidebarOpen: (open) => {
      set((state) => {
        state.sidebarOpen = open
      })
    },

    setSidebarCollapsed: (collapsed) => {
      set((state) => {
        state.sidebarCollapsed = collapsed
      })
    },

    setGlobalLoading: (loading, message) => {
      set((state) => {
        state.globalLoading = loading
        state.loadingMessage = message ?? 'Cargando…'
      })
    },
  })),
)
