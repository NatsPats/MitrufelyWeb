/**
 * AboutPage.tsx — Página pública "Nosotros" de Mitrufely
 *
 * SRP: Orquestar el layout y las secciones de la vista About.
 * Usa el mismo bloque de navegación sticky que HomePage.
 *
 * Secciones:
 *   1. AboutHeroSection  — "Tu Experiencia, Nuestra Misión"
 *   2. SharedMomentsSection — Collage de imágenes + cita
 *   3. PhilosophySection    — Grid 3 tarjetas filosofía
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/app/store'
import { useCartItemCount } from '@/features/cart/hooks/useCart'

// Layout compartido
import { PublicHeader } from '@/shared/components/layout/PublicHeader'

import { PublicFooter } from '@/shared/components/layout/PublicFooter'

// Secciones de dominio About
import { AboutHeroSection }    from '@/features/about/components/AboutHeroSection'
import { SharedMomentsSection } from '@/features/about/components/SharedMomentsSection'
import { PhilosophySection }   from '@/features/about/components/PhilosophySection'

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const { user, isAuthenticated, logout } = useAuthStore()

  // ── Estado de UI ──────────────────────────────────────────────────────────
  const [searchQuery,  setSearchQuery]  = useState('')
  const [favorites]                     = useState<number[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const cartCount = useCartItemCount()

  // Forzar fondo claro (mismo patrón que HomePage)
  useEffect(() => {
    const prevBg    = document.body.style.backgroundColor
    const prevColor = document.body.style.color
    document.body.style.backgroundColor = '#faf8f5'
    document.body.style.color           = '#2a1115'
    return () => {
      document.body.style.backgroundColor = prevBg
      document.body.style.color           = prevColor
    }
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    toast.info(`Buscando: "${searchQuery}"`)
  }

  const handleLogout = () => {
    logout()
    setUserMenuOpen(false)
    toast.success('Sesión cerrada correctamente.')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2a1115] font-sans antialiased">

      {/* ── Bloque de navegación fijo (nav integrado en PublicHeader) ── */}
      <PublicHeader
        cartCount={cartCount}
        favoriteCount={favorites.length}
        coinsBalance={isAuthenticated && user ? user.sweetCoinsBalance : null}
        userName={isAuthenticated && user ? user.name : null}
        userMenuOpen={userMenuOpen}
        onUserMenuToggle={() => setUserMenuOpen((o) => !o)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearch}
        onLogout={handleLogout}
      />

      {/* ── Secciones de contenido ── */}
      <main>
        {/* 1. Hero: "Tu Experiencia, Nuestra Misión" */}
        <AboutHeroSection />

        {/* 2. Collage asimétrico con imágenes + cita */}
        <SharedMomentsSection />

        {/* 3. Grid de filosofía: Ingredientes, Hecho a Mano, Sabor Casero */}
        <PhilosophySection />
      </main>

      <PublicFooter />
    </div>
  )
}
