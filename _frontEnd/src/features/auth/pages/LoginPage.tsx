import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Link } from 'react-router'
import { useLogin } from '../hooks/useLogin'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

// Schema de validación Zod que coincide con LoginRequest del backend
const loginSchema = z.object({
  email: z.string().email('Por favor, ingresa un correo electrónico válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { mutate: login, isPending } = useLogin()

  const handleGoogleLogin = () => {
    const clientId = import.meta.env['VITE_GOOGLE_CLIENT_ID']
    if (!clientId) {
      toast.error('Google Client ID no está configurado en el frontend.')
      return
    }
    const redirectUri = 'http://localhost:5173/auth/callback'
    const scope = 'openid email profile'
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36)

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=id_token` +
      `&scope=${encodeURIComponent(scope)}` +
      `&nonce=${encodeURIComponent(nonce)}`

    window.location.href = authUrl
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (data: LoginFormValues) => {
    login(data)
  }

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-[#f0efed] px-4 overflow-hidden">
      {/* Patrón de Destellos de Fondo Decorativo (Sparkles Pattern) */}
      <div 
        className="absolute inset-0 opacity-[0.08] pointer-events-none" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cpath d='M40 0l3 37 37 3-37 3-3 37-3-37-37-3 37-3z' fill='%235c0f1b' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-lg bg-[#e6e6e6]/90 backdrop-blur-md rounded-[40px] border-[#5c0f1b] p-10 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.25)]"
      >
        {/* Logotipo Tipográfico estilizado */}
        <div className="text-center mb-8">
          <motion.h1 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="font-display text-[#5c0f1b] text-5xl font-black tracking-tight drop-shadow-sm select-none"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Mitrufely
          </motion.h1>
          <p className="text-sm font-semibold text-[#5c0f1b]/80 mt-2 font-sans tracking-wide">
            Inicia Sesión en Mitrufely
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Campo: Correo Electrónico */}
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#5c0f1b]">
              <Mail className="h-5 w-5" />
            </span>
            <input
              type="email"
              placeholder="Correo Electrónico"
              {...register('email')}
              className={`w-full bg-[#f0efed]/90 text-[#5c0f1b] placeholder-[#5c0f1b]/40 rounded-full border-2 pl-12 pr-4 py-3.5 text-base font-medium transition-all outline-none focus-visible:!outline-none ${
                errors.email 
                  ? 'border-destructive focus:border-destructive focus:border-4 focus:ring-0' 
                  : 'border-[#5c0f1b] focus:border-[#5c0f1b] focus:border-4 focus:ring-0'
              }`}
            />
            {errors.email && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }} 
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-xs font-semibold text-destructive mt-1.5 pl-3"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.email.message}
              </motion.p>
            )}
          </div>

          {/* Campo: Contraseña */}
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#5c0f1b]">
              <Lock className="h-5 w-5" />
            </span>
            <input
              type="password"
              placeholder="Contraseña"
              {...register('password')}
              className={`w-full bg-[#f0efed]/90 text-[#5c0f1b] placeholder-[#5c0f1b]/40 rounded-full border-2 pl-12 pr-4 py-3.5 text-base font-medium transition-all outline-none focus-visible:!outline-none ${
                errors.password 
                  ? 'border-destructive focus:border-destructive focus:border-4 focus:ring-0' 
                  : 'border-[#5c0f1b] focus:border-[#5c0f1b] focus:border-4 focus:ring-0'
              }`}
            />
            {errors.password && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }} 
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-xs font-semibold text-destructive mt-1.5 pl-3"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.password.message}
              </motion.p>
            )}
          </div>

          {/* Recuperación de contraseña */}
          <div className="text-right">
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault()
                toast.info('La recuperación de contraseña estará disponible próximamente.')
              }}
              className="text-xs font-bold text-[#5c0f1b] hover:text-[#ff7a45] underline transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          {/* Botón de acción principal */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isPending}
            className="w-full bg-[#ff7a45] text-white hover:bg-[#ff7a45]/90 py-3.5 rounded-full text-lg font-black tracking-wide shadow-md transition-all disabled:opacity-75 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Ingresando...</span>
              </>
            ) : (
              <>
                <span>Ingresar</span>
              </>
            )}
          </motion.button>
        </form>

        {/* Divisor visual premium */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border border-[#5c0f1b]/15"></div>
          </div>
          <span className="relative bg-[#e3e3e3] px-4 text-xs font-black tracking-wider text-[#5c0f1b]/70 uppercase">
            O ingresa con
          </span>
        </div>

        {/* Botón premium de Google */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleGoogleLogin}
          className="w-full bg-[#f0efed] text-[#5c0f1b] hover:bg-[#e6e6e6] py-3.5 rounded-full text-base font-black tracking-wide shadow-sm border-2 border-[#5c0f1b]/20 hover:border-[#5c0f1b] transition-all flex items-center justify-center gap-3"
        >
          <svg className="h-5.5 w-5.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          <span style={{ fontFamily: "'Outfit', sans-serif" }}>Continuar con Google</span>
        </motion.button>

        {/* Footer del card */}
        <div className="text-center mt-8 pt-4 border-t border-[#5c0f1b]/10">
          <p className="text-sm font-semibold text-[#2a1115]/70">
            ¿Eres nuevo?{' '}
            <Link 
              to="/register" 
              className="text-[#5c0f1b] hover:text-[#ff7a45] font-black underline transition-colors"
            >
              Crea tu cuenta
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
