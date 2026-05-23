import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react({
        // Activa React Compiler vía Rolldown Babel preset
        include: /\.[tj]sx?$/,
      }),
      tailwindcss(),
    ],

    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },

    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': {
          target: env['VITE_API_BASE_URL'] ?? 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ''),
        },
      },
    },

    preview: {
      port: 4173,
    },

    build: {
      target: 'es2022',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 1000,
    },

    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router',
        '@tanstack/react-query',
        'zustand',
        'axios',
        'clsx',
        'tailwind-merge',
      ],
    },
  }
})

// Exporta el preset para uso en configuraciones avanzadas
export { reactCompilerPreset }
