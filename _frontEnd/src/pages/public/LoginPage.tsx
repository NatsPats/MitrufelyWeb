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
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#f0efed] px-4 py-12 overflow-hidden">
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
        className="relative z-10 w-full max-w-md bg-[#e6e6e6]/90 backdrop-blur-md rounded-[40px] border-2 border-[#5c0f1b] p-10 md:p-12 shadow-[0_20px_50px_rgba(92,15,27,0.15)]"
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Campo: Correo Electrónico */}
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#5c0f1b]">
              <Mail className="h-5 w-5" />
            </span>
            <input
              type="email"
              placeholder="Correo Electrónico"
              {...register('email')}
              className={`w-full bg-[#f0efed]/90 text-[#2a1115] placeholder-[#5c0f1b]/40 rounded-full border-2 pl-12 pr-4 py-3.5 text-base font-medium transition-all outline-none ${
                errors.email 
                  ? 'border-destructive focus:ring-2 focus:ring-destructive' 
                  : 'border-[#5c0f1b] focus:border-[#ff7a45] focus:ring-2 focus:ring-[#ff7a45]'
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
              className={`w-full bg-[#f0efed]/90 text-[#2a1115] placeholder-[#5c0f1b]/40 rounded-full border-2 pl-12 pr-4 py-3.5 text-base font-medium transition-all outline-none ${
                errors.password 
                  ? 'border-destructive focus:ring-2 focus:ring-destructive' 
                  : 'border-[#5c0f1b] focus:border-[#ff7a45] focus:ring-2 focus:ring-[#ff7a45]'
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
