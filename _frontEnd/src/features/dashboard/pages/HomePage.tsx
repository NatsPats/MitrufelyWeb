import { useState } from 'react'
import { useAuthStore } from '@/app/store'
import { Link, useNavigate } from 'react-router'
import {
  Search,
  Star,
  User,
  ShoppingCart,
  Heart,
  Home,
  BookOpen,
  Info,
  Gift,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Instagram,
  Facebook,
  Mail,
  X,
  Plus,
  Minus,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

// Datos Mockeados de Trufas del Catálogo
interface Trufa {
  id: number
  nombre: string
  categoria: 'best_sellers' | 'new_flavors' | 'promos'
  precio: number
  puntosGasto?: number
  imagenUrl: string
  descripcion: string
}

const TRUFAS_MOCK: Trufa[] = [
  {
    id: 1,
    nombre: 'Trufa de Oreo',
    categoria: 'best_sellers',
    precio: 2.5,
    imagenUrl: 'https://images.unsplash.com/photo-1548907040-4d42b52125e0?auto=format&fit=crop&q=80&w=400',
    descripcion: 'Delicioso relleno de galleta Oreo triturada mezclada con suave queso crema, cubierto de una crujiente capa de chocolate blanco artesanal.',
  },
  {
    id: 2,
    nombre: 'Trufa de Coco & Almendra',
    categoria: 'new_flavors',
    precio: 2.8,
    imagenUrl: 'https://images.unsplash.com/photo-1544966951-009c02dfc585?auto=format&fit=crop&q=80&w=400',
    descripcion: 'Relleno cremoso de coco rallado de la selva y almendras tostadas crujientes, bañado en finas hebras de chocolate con leche.',
  },
  {
    id: 3,
    nombre: 'Trufa Belga Clásica',
    categoria: 'best_sellers',
    precio: 3.0,
    imagenUrl: 'https://images.unsplash.com/photo-1511381939415-e44015469834?auto=format&fit=crop&q=80&w=400',
    descripcion: 'Elaborada con auténtico cacao belga al 70%, espolvoreada con cacao en polvo premium para una experiencia amarga e inolvidable.',
  },
  {
    id: 4,
    nombre: 'Trufa de Fresa Silvestre',
    categoria: 'promos',
    precio: 2.2,
    imagenUrl: 'https://images.unsplash.com/photo-1604514281729-0ecbd2b75a13?auto=format&fit=crop&q=80&w=400',
    descripcion: 'Una explosión de sabor a fresa natural infusionada en ganache de chocolate blanco y un toque de licor dulce artesanal.',
  },
  {
    id: 5,
    nombre: 'Trufa de Avellana Crujiente',
    categoria: 'best_sellers',
    precio: 2.9,
    imagenUrl: 'https://images.unsplash.com/photo-1575549594211-18c1e626e2e0?auto=format&fit=crop&q=80&w=400',
    descripcion: 'Centro entero de avellana tostada cubierto de praliné de chocolate con leche y trozos de barquillo crujiente.',
  },
]

// Packs Mockeados para Compartir
interface Pack {
  id: number
  nombre: string
  precio: number
  puntos: number
  descripcion: string
  imagenUrl: string
}

const PACKS_MOCK: Pack[] = [
  {
    id: 1,
    nombre: 'Detalle Especial',
    precio: 15.0,
    puntos: 1500,
    descripcion: 'Un gesto perfecto para cualquier celebración o para obsequiar a esa persona ideal. Seis trufas artesanales seleccionadas a mano con amor.',
    imagenUrl: 'https://images.unsplash.com/photo-1513534894444-24c9190c3741?auto=format&fit=crop&q=80&w=600',
  },
  {
    id: 2,
    nombre: 'Break de Estudio',
    precio: 25.0,
    puntos: 2500,
    descripcion: 'La dosis de energía extra que necesitas para tus jornadas de repaso. Doce trufas surtidas perfectas para compartir o consentirte tú solo.',
    imagenUrl: 'https://images.unsplash.com/photo-1549007994-cb92ca7a4b2a?auto=format&fit=crop&q=80&w=600',
  },
  {
    id: 3,
    nombre: 'Colección Exclusiva Premium',
    precio: 35.0,
    puntos: 3500,
    descripcion: 'Nuestra obra maestra. 16 trufas premium elaboradas con ingredientes exóticos de lujo, cacao orgánico selecto y finos detalles decorativos.',
    imagenUrl: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&q=80&w=600',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()

  // Estados de Interacción
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'best_sellers' | 'new_flavors' | 'promos'>('best_sellers')
  const [packIndex, setPackIndex] = useState(0)
  const [selectedTrufa, setSelectedTrufa] = useState<Trufa | null>(null)
  const [trufaQuantity, setTrufaQuantity] = useState(1)
  const [cartItemsCount, setCartItemsCount] = useState(0)
  const [favoritesList, setFavoritesList] = useState<number[]>([])

  const activePack = PACKS_MOCK[packIndex]!

  // Buscador
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim() === '') return
    toast.success(`Buscando trufas: "${searchQuery}"`)
  }

  // Carrusel
  const nextPack = () => {
    setPackIndex((prev) => (prev + 1) % PACKS_MOCK.length)
  }

  const prevPack = () => {
    setPackIndex((prev) => (prev - 1 + PACKS_MOCK.length) % PACKS_MOCK.length)
  }

  // Carrito y Favoritos
  const toggleFavorite = (id: number) => {
    setFavoritesList((prev) =>
      prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id]
    )
    toast.success(
      favoritesList.includes(id)
        ? 'Removido de favoritos'
        : 'Agregado a favoritos ❤️'
    )
  }

  const handleAddToCart = (nombre: string, qty: number) => {
    setCartItemsCount((prev) => prev + qty)
    toast.success(`Agregado al carrito: ${qty}x ${nombre}`)
    setSelectedTrufa(null)
    setTrufaQuantity(1)
  }

  // Filtrado de Trufas
  const trufasFiltradas = TRUFAS_MOCK.filter(
    (trufa) =>
      trufa.categoria === activeTab &&
      trufa.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-[#2a1115] font-sans antialiased overflow-x-hidden">
      {/* ─── NAVBAR SUPERIOR ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#fcfbf9]/95 backdrop-blur-md border-b border-[#5c0f1b]/10 py-3.5 px-4 md:px-8 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo Tipográfico */}
          <Link to="/" className="flex items-center gap-1.5 shrink-0 group">
            <h1 
              className="font-display text-[#5c0f1b] text-3.5xl font-black tracking-tight select-none group-hover:text-[#ff7a45] transition-colors"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Mitrufely
            </h1>
          </Link>

          {/* Barra de Búsqueda */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-md relative">
            <input
              type="text"
              placeholder="Buscar trufas, sabores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f4f3f0] border-2 border-[#5c0f1b]/15 rounded-full pl-5 pr-11 py-2 text-sm font-semibold outline-none focus:border-[#ff7a45] transition-colors placeholder-[#2a1115]/40"
            />
            <button type="submit" className="absolute right-3.5 top-2.5 text-[#5c0f1b] hover:text-[#ff7a45] transition-colors">
              <Search className="h-4.5 w-4.5" />
            </button>
          </form>

          {/* Indicadores & Acciones */}
          <div className="flex items-center gap-4.5">
            {/* Saldo de SweetCoins */}
            <div className="flex items-center gap-1.5 bg-[#ff7a45]/10 px-3.5 py-1.5 rounded-full border border-[#ff7a45]/20 select-none">
              <span className="text-sm font-black text-[#ff7a45]">
                {isAuthenticated ? '1.000' : '1.000'}
              </span>
              <Star className="h-4.5 w-4.5 fill-[#ff7a45] text-[#ff7a45] animate-pulse" />
            </div>

            {/* Icono de Favoritos */}
            <button 
              onClick={() => toast.info('Tus favoritos se guardarán al iniciar sesión.')}
              className="relative p-2 text-[#5c0f1b] hover:text-[#ff7a45] transition-colors shrink-0 hover:scale-105 active:scale-95"
            >
              <Heart className={`h-6 w-6 ${favoritesList.length > 0 ? 'fill-[#ff7a45] text-[#ff7a45]' : ''}`} />
              {favoritesList.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#ff7a45] text-white text-[10px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-white">
                  {favoritesList.length}
                </span>
              )}
            </button>

            {/* Icono de Carrito */}
            <button 
              onClick={() => toast.info('¡El carrito se activará próximamente al realizar compras!')}
              className="relative p-2 text-[#5c0f1b] hover:text-[#ff7a45] transition-colors shrink-0 hover:scale-105 active:scale-95"
            >
              <ShoppingCart className="h-6 w-6" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#ff7a45] text-white text-[10px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-white">
                  {cartItemsCount}
                </span>
              )}
            </button>

            {/* Icono de Perfil */}
            <div className="relative group shrink-0">
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      logout()
                      toast.success('Sesión cerrada.')
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5c0f1b] text-white hover:bg-[#ff7a45] transition-colors font-bold text-sm"
                    title="Cerrar sesión"
                  >
                    {(() => {
                      const name = user?.name
                      return name ? name.charAt(0).toUpperCase() : <User className="h-4 w-4" />
                    })()}
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => navigate('/login')}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f3f0] border border-[#5c0f1b]/15 text-[#5c0f1b] hover:bg-[#ff7a45] hover:text-white transition-colors"
                >
                  <User className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── MENÚ DE ENLACES SECUNDARIO ────────────────────────────────────────── */}
      <nav className="bg-[#f4f3f0] border-b border-[#5c0f1b]/5 py-2 px-4 shadow-inner">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-6 md:gap-10">
          <a href="#" className="flex items-center gap-1.5 text-[#5c0f1b] hover:text-[#ff7a45] text-sm font-black transition-colors">
            <Home className="h-4 w-4" />
            <span>Inicio</span>
          </a>
          <a href="#catalogo" className="flex items-center gap-1.5 text-[#5c0f1b] hover:text-[#ff7a45] text-sm font-black transition-colors">
            <BookOpen className="h-4 w-4" />
            <span>Catálogo</span>
          </a>
          <a href="#nosotros" className="flex items-center gap-1.5 text-[#5c0f1b] hover:text-[#ff7a45] text-sm font-black transition-colors">
            <Info className="h-4 w-4" />
            <span>Nosotros</span>
          </a>
          <a href="#puntos" className="flex items-center gap-1.5 text-[#5c0f1b] hover:text-[#ff7a45] text-sm font-black transition-colors">
            <Gift className="h-4 w-4" />
            <span>Tus puntos</span>
          </a>
        </div>
      </nav>

      {/* ─── HERO SECTION ───────────────────────────────────────────────────── */}
      <section className="relative bg-[#f4f3f0] py-16 md:py-24 px-4 overflow-hidden border-b border-[#5c0f1b]/5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 items-center gap-12 relative z-10">
          
          {/* Contenido de Texto */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-start text-left"
          >
            <div className="inline-flex items-center gap-1.5 bg-[#ff7a45]/15 border border-[#ff7a45]/25 px-4 py-1.5 rounded-full mb-6 select-none animate-bounce">
              <Sparkles className="h-4 w-4 text-[#ff7a45] fill-[#ff7a45]" />
              <span className="text-xs font-black text-[#ff7a45] tracking-wide uppercase">CriptoTrufas Recompensa</span>
            </div>
            
            <h2 className="font-display text-[#5c0f1b] text-4.5xl md:text-6xl font-black leading-tight tracking-tight mb-6">
              El antojo perfecto que te recompensa.
            </h2>
            <p className="text-lg text-[#2a1115]/80 font-medium mb-8 leading-relaxed">
              Gana puntos <strong className="text-[#ff7a45]">Mitrufely</strong> por cada una de tus compras.{' '}
              <span className="text-[#5c0f1b] font-bold">Canjéalos por descuentos exclusivos y más trufas.</span>
            </p>

            <motion.a 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href="#catalogo"
              className="bg-[#5c0f1b] hover:bg-[#5c0f1b]/95 text-white px-10 py-4 rounded-full text-base font-black tracking-wide shadow-lg hover:shadow-xl transition-all"
            >
              Ver Catálogo
            </motion.a>
          </motion.div>

          {/* Imagen Premium */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="relative flex justify-center lg:justify-end"
          >
            <div className="absolute inset-0 bg-radial from-[#ff7a45]/10 to-transparent rounded-full blur-3xl" />
            <img
              src="https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&q=80&w=800"
              alt="Premium Truffles Selection"
              className="w-full max-w-md h-[340px] md:h-[400px] object-cover rounded-[50px] border-4 border-[#5c0f1b] shadow-2xl relative z-10"
            />
          </motion.div>
        </div>
      </section>

      {/* ─── GRILLA DE PRODUCTOS CON TABS ───────────────────────────────────── */}
      <section id="catalogo" className="py-20 px-4 max-w-7xl mx-auto scroll-mt-16">
        {/* Cabecera del Catálogo */}
        <div className="text-center mb-12">
          <h3 className="font-display text-[#5c0f1b] text-3.5xl font-black mb-4">Nuestro Catálogo Especial</h3>
          <p className="text-[#2a1115]/60 max-w-md mx-auto font-medium text-sm">
            Disfruta de trufas artesanales elaboradas a mano con el cacao más fino y rellenos irresistibles.
          </p>
        </div>

        {/* Sistema de Pestañas (Tabs) */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-[#ff7a45] p-1.5 rounded-full shadow-md select-none border border-[#ff7a45]">
            <button
              onClick={() => setActiveTab('best_sellers')}
              className={`px-6 py-2.5 rounded-full text-sm font-black tracking-wide transition-all ${
                activeTab === 'best_sellers'
                  ? 'bg-[#fcfbf9] text-[#5c0f1b] shadow-sm'
                  : 'text-white hover:text-[#fcfbf9]/85'
              }`}
            >
              Más vendidos
            </button>
            <button
              onClick={() => setActiveTab('new_flavors')}
              className={`px-6 py-2.5 rounded-full text-sm font-black tracking-wide transition-all ${
                activeTab === 'new_flavors'
                  ? 'bg-[#fcfbf9] text-[#5c0f1b] shadow-sm'
                  : 'text-white hover:text-[#fcfbf9]/85'
              }`}
            >
              Nuevos sabores
            </button>
            <button
              onClick={() => setActiveTab('promos')}
              className={`px-6 py-2.5 rounded-full text-sm font-black tracking-wide transition-all ${
                activeTab === 'promos'
                  ? 'bg-[#fcfbf9] text-[#5c0f1b] shadow-sm'
                  : 'text-white hover:text-[#fcfbf9]/85'
              }`}
            >
              Promociones
            </button>
          </div>
        </div>

        {/* Grilla de Tarjetas */}
        <motion.div 
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
        >
          <AnimatePresence mode="popLayout">
            {trufasFiltradas.length > 0 ? (
              trufasFiltradas.map((trufa) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  key={trufa.id}
                  className="bg-card rounded-[30px] border border-[#5c0f1b]/10 p-5 flex flex-col justify-between group hover:border-[#ff7a45] hover:shadow-[0_12px_30px_rgba(92,15,27,0.06)] transition-all overflow-hidden relative"
                >
                  {/* Imagen y Favorito */}
                  <div className="relative rounded-[20px] overflow-hidden mb-4 aspect-square">
                    <img
                      src={trufa.imagenUrl}
                      alt={trufa.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <button
                      onClick={() => toggleFavorite(trufa.id)}
                      className="absolute top-3.5 right-3.5 p-2 bg-[#fcfbf9]/90 backdrop-blur-sm rounded-full text-[#5c0f1b] hover:text-[#ff7a45] transition-colors shadow-sm hover:scale-110 active:scale-90"
                    >
                      <Heart className={`h-4.5 w-4.5 ${favoritesList.includes(trufa.id) ? 'fill-[#ff7a45] text-[#ff7a45]' : ''}`} />
                    </button>
                  </div>

                  {/* Detalles */}
                  <div className="text-left">
                    <h4 className="font-display text-[#5c0f1b] text-xl font-black mb-1 group-hover:text-[#ff7a45] transition-colors select-none">
                      {trufa.nombre}
                    </h4>
                    <div className="flex items-baseline justify-between mb-4">
                      <span className="text-lg font-black text-[#2a1115]/90">
                        S/. {trufa.precio.toFixed(2)}
                      </span>
                    </div>

                    {/* Botón Ver Más */}
                    <button
                      onClick={() => setSelectedTrufa(trufa)}
                      className="w-full bg-[#5c0f1b] hover:bg-[#5c0f1b]/95 text-white py-3.5 rounded-full text-xs font-black tracking-wide transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <span>Ver mas</span>
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center">
                <p className="text-muted-foreground font-semibold text-lg">No se encontraron trufas en esta sección.</p>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* ─── CARRUSEL DE PACKS ──────────────────────────────────────────────── */}
      <section id="puntos" className="bg-[#f4f3f0] py-20 px-4 border-y border-[#5c0f1b]/5">
        <div className="max-w-7xl mx-auto">
          {/* Cabecera del Carrusel */}
          <div className="text-center mb-14">
            <h3 className="font-display text-[#5c0f1b] text-3.5xl font-black mb-4">
              Packs para compartir (o para ti solo)
            </h3>
            <p className="text-[#2a1115]/60 max-w-md mx-auto font-medium text-sm">
              Nuestras cajas surtidas más exclusivas diseñadas para regalar, estudiar o disfrutar con los tuyos.
            </p>
          </div>

          {/* Carrusel Deslizable */}
          <div className="relative flex items-center justify-center px-0 md:px-12 max-w-4xl mx-auto">
            {/* Botón Izquierdo */}
            <button
              onClick={prevPack}
              className="absolute left-2 md:-left-4 z-20 p-3.5 bg-white border-2 border-[#5c0f1b]/20 hover:border-[#ff7a45] rounded-full text-[#5c0f1b] hover:text-[#ff7a45] transition-all shadow-md hover:scale-105 active:scale-95 shrink-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Contenedor de la Tarjeta del Pack Activo */}
            <div className="w-full overflow-hidden px-4 py-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={packIndex}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.4 }}
                  className="bg-card rounded-[40px] border-2 border-[#5c0f1b]/15 p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 items-center gap-8 shadow-lg overflow-hidden"
                >
                  {/* Foto del Pack */}
                  <div className="relative rounded-[25px] overflow-hidden aspect-video md:aspect-square h-full">
                    <img
                      src={activePack.imagenUrl}
                      alt={activePack.nombre}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-[#ff7a45] px-3.5 py-1.5 rounded-full text-white text-xs font-black tracking-wide shadow-sm">
                      <Star className="h-3.5 w-3.5 fill-white" />
                      <span>+{activePack.puntos} ⭐</span>
                    </div>
                  </div>

                  {/* Información del Pack */}
                  <div className="text-left flex flex-col justify-between h-full">
                    <div>
                      <h4 className="font-display text-[#5c0f1b] text-3xl font-black mb-3">
                        {activePack.nombre}
                      </h4>
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-2xl font-black text-[#2a1115]">
                          S/. {activePack.precio.toFixed(2)}
                        </span>
                        <span className="text-xs font-bold text-[#ff7a45]">
                          | +{activePack.puntos} SweetCoins ⭐
                        </span>
                      </div>
                      <p className="text-sm text-[#2a1115]/75 font-medium leading-relaxed mb-6">
                        {activePack.descripcion}
                      </p>
                    </div>

                    <button
                      onClick={() => handleAddToCart(activePack.nombre, 1)}
                      className="w-full bg-[#5c0f1b] hover:bg-[#5c0f1b]/95 text-white py-4 rounded-full text-sm font-black tracking-wide transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <span>Ver mas</span>
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Botón Derecho */}
            <button
              onClick={nextPack}
              className="absolute right-2 md:-right-4 z-20 p-3.5 bg-white border-2 border-[#5c0f1b]/20 hover:border-[#ff7a45] rounded-full text-[#5c0f1b] hover:text-[#ff7a45] transition-all shadow-md hover:scale-105 active:scale-95 shrink-0"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── BANNERS DE BENEFICIOS ──────────────────────────────────────────── */}
      <section className="py-20 px-4 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Banner 1: CriptoTrufas */}
        <motion.div
          whileHover={{ y: -5 }}
          className="bg-card rounded-[35px] border border-[#5c0f1b]/10 p-8 flex flex-col justify-between items-start md:flex-row md:items-center gap-6 shadow-sm hover:border-[#ff7a45] transition-all text-left"
        >
          <div>
            <div className="inline-flex items-center gap-1 bg-[#ff7a45]/15 border border-[#ff7a45]/20 px-3.5 py-1 rounded-full mb-4 text-xs font-black text-[#ff7a45] uppercase tracking-wide">
              <span>Beneficios 🎁</span>
            </div>
            <h4 className="font-display text-[#5c0f1b] text-3xl font-black mb-2">CriptoTrufas</h4>
            <p className="text-sm text-[#2a1115]/70 font-semibold mb-6">
              Gana Puntos y obtén descuentos exclusivos
            </p>
            <button
              onClick={() => toast.info('El club CriptoTrufas estará activo próximamente.')}
              className="bg-[#ff7a45] hover:bg-[#ff7a45]/90 text-white px-8 py-3 rounded-full text-sm font-black tracking-wide shadow-md transition-all"
            >
              Obtener
            </button>
          </div>
          <img
            src="https://images.unsplash.com/photo-1549007994-cb92ca7a4b2a?auto=format&fit=crop&q=80&w=250"
            alt="SweetCoins Loyalty"
            className="w-full md:w-[160px] h-[160px] object-cover rounded-[20px] border border-[#5c0f1b]/10"
          />
        </motion.div>

        {/* Banner 2: Tu trufa perfecta */}
        <motion.div
          whileHover={{ y: -5 }}
          className="bg-card rounded-[35px] border border-[#5c0f1b]/10 p-8 flex flex-col justify-between items-start md:flex-row md:items-center gap-6 shadow-sm hover:border-[#ff7a45] transition-all text-left"
        >
          <div>
            <div className="inline-flex items-center gap-1 bg-[#5c0f1b]/10 border border-[#5c0f1b]/15 px-3.5 py-1 rounded-full mb-4 text-xs font-black text-[#5c0f1b] uppercase tracking-wide">
              <span>Personalización ❤️</span>
            </div>
            <h4 className="font-display text-[#5c0f1b] text-3xl font-black mb-2">Tu trufa perfecta</h4>
            <p className="text-sm text-[#2a1115]/70 font-semibold mb-6">
              Personaliza para una ocasion especial
            </p>
            <button
              onClick={() => toast.info('Formulario de personalización de trufas en desarrollo.')}
              className="bg-[#ff7a45] hover:bg-[#ff7a45]/90 text-white px-8 py-3 rounded-full text-sm font-black tracking-wide shadow-md transition-all"
            >
              Contactanos
            </button>
          </div>
          <img
            src="https://images.unsplash.com/photo-1544966951-009c02dfc585?auto=format&fit=crop&q=80&w=250"
            alt="Custom Truffle Design"
            className="w-full md:w-[160px] h-[160px] object-cover rounded-[20px] border border-[#5c0f1b]/10"
          />
        </motion.div>
      </section>

      {/* ─── NOSOTROS Y MARCA ────────────────────────────────────────────────── */}
      <section id="nosotros" className="bg-[#f4f3f0] py-20 px-4 border-t border-[#5c0f1b]/5 scroll-mt-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h3 className="font-display text-[#5c0f1b] text-3.5xl font-black mb-6">Repostería Fina & Confitería Artesanal</h3>
          <p className="text-base text-[#2a1115]/80 font-medium leading-relaxed mb-6">
            En <strong>Mitrufely</strong> nos especializamos en crear pequeños momentos de felicidad a través de nuestras trufas artesanales premium. Cada trufa es elaborada a mano empleando cacao fino de aroma 100% peruano e ingredientes selectos de la más alta calidad.
          </p>
          <div className="h-1 w-20 bg-[#ff7a45] mx-auto rounded-full" />
        </div>
      </section>

      {/* ─── MODAL DETALLE TRUFA (ANIMA PRESENCE) ────────────────────────────── */}
      <AnimatePresence>
        {selectedTrufa && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#2a1115]/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedTrufa(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-card w-full max-w-2xl rounded-[35px] border-2 border-[#5c0f1b] overflow-hidden shadow-2xl relative grid grid-cols-1 md:grid-cols-2"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Botón de Cierre */}
              <button
                onClick={() => setSelectedTrufa(null)}
                className="absolute top-4 right-4 z-20 p-2 bg-white rounded-full text-[#5c0f1b] hover:text-[#ff7a45] border border-[#5c0f1b]/15 shadow-sm transition-all hover:scale-105 active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Imagen del modal */}
              <div className="relative h-[250px] md:h-full">
                <img
                  src={selectedTrufa.imagenUrl}
                  alt={selectedTrufa.nombre}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Contenido del modal */}
              <div className="p-6 md:p-8 flex flex-col justify-between text-left h-full">
                <div>
                  <div className="inline-flex items-center gap-1 bg-[#ff7a45]/15 border border-[#ff7a45]/20 px-3.5 py-1 rounded-full mb-4 text-xs font-black text-[#ff7a45] uppercase tracking-wide">
                    <span>Artesanal 🍫</span>
                  </div>
                  <h3 className="font-display text-[#5c0f1b] text-3xl font-black mb-3">
                    {selectedTrufa.nombre}
                  </h3>
                  <p className="text-sm text-[#2a1115]/75 font-semibold leading-relaxed mb-6">
                    {selectedTrufa.descripcion}
                  </p>
                </div>

                <div>
                  {/* Selector de Cantidades y Precio */}
                  <div className="flex items-center justify-between gap-4 mb-6 pt-4 border-t border-[#5c0f1b]/10">
                    <span className="text-2xl font-black text-[#2a1115]">
                      S/. {(selectedTrufa.precio * trufaQuantity).toFixed(2)}
                    </span>
                    <div className="flex items-center gap-3 bg-[#f4f3f0] border-2 border-[#5c0f1b]/15 rounded-full px-3.5 py-1">
                      <button
                        onClick={() => setTrufaQuantity((q) => Math.max(1, q - 1))}
                        className="text-[#5c0f1b] hover:text-[#ff7a45] p-1 font-bold transition-colors"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-base font-black text-[#5c0f1b] w-6 text-center select-none">
                        {trufaQuantity}
                      </span>
                      <button
                        onClick={() => setTrufaQuantity((q) => q + 1)}
                        className="text-[#5c0f1b] hover:text-[#ff7a45] p-1 font-bold transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* CTA Carrito */}
                  <button
                    onClick={() => handleAddToCart(selectedTrufa.nombre, trufaQuantity)}
                    className="w-full bg-[#5c0f1b] hover:bg-[#5c0f1b]/95 text-white py-4 rounded-full text-sm font-black tracking-wide shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    <span>Agregar al carrito</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="bg-[#5c0f1b] text-white py-14 px-4 md:px-8 border-t border-[#ff7a45]/15">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 pb-10 border-b border-white/10">
          {/* Logo y Email */}
          <div className="text-center md:text-left flex flex-col items-center md:items-start">
            <h2 
              className="font-display text-white text-4xl font-black tracking-tight mb-2 select-none"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Mitrufely
            </h2>
            <p className="text-sm font-semibold text-white/70 flex items-center gap-1.5 mt-2">
              <Mail className="h-4 w-4 text-[#ff7a45]" />
              <span>mitrufely123@gmail.com</span>
            </p>
          </div>

          {/* Redes Sociales */}
          <div className="flex items-center gap-4">
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); toast.success('Visitando Facebook') }}
              className="p-3 bg-white/5 hover:bg-[#ff7a45] rounded-full text-white transition-all hover:scale-105 active:scale-95"
            >
              <Facebook className="h-5.5 w-5.5" />
            </a>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); toast.success('Visitando Instagram') }}
              className="p-3 bg-white/5 hover:bg-[#ff7a45] rounded-full text-white transition-all hover:scale-105 active:scale-95"
            >
              <Instagram className="h-5.5 w-5.5" />
            </a>
          </div>

          {/* Navegación rápida */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a href="#" className="text-sm font-bold text-white/80 hover:text-[#ff7a45] transition-colors">Inicio</a>
            <a href="#catalogo" className="text-sm font-bold text-white/80 hover:text-[#ff7a45] transition-colors">Catálogo</a>
            <a href="#nosotros" className="text-sm font-bold text-white/80 hover:text-[#ff7a45] transition-colors">Nosotros</a>
            <a href="#puntos" className="text-sm font-bold text-white/80 hover:text-[#ff7a45] transition-colors">Tus puntos</a>
          </div>
        </div>

        {/* Derechos Reservados */}
        <div className="max-w-7xl mx-auto pt-8 text-center text-xs font-semibold text-white/40">
          <p>© {new Date().getFullYear()} Mitrufely. Todos los derechos reservados. Repostería Fina Artesanal.</p>
        </div>
      </footer>
    </div>
  )
}
