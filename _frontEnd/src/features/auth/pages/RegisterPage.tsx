import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Link } from 'react-router'
import { useRegister } from '../hooks/useRegister'
import { User, Phone, Mail, Lock, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

// Schema de validación Zod que coincide con RegisterRequest y el validador del backend
const registerSchema = z
  .object({
    first_name: z
      .string()
      .min(2, 'El nombre debe tener al menos 2 caracteres.')
      .max(100, 'El nombre es demasiado largo.'),
    last_name: z
      .string()
      .min(2, 'Los apellidos deben tener al menos 2 caracteres.')
      .max(100, 'Los apellidos son demasiado largos.'),
    email: z.string().email('Por favor, ingresa un correo electrónico válido.'),
    phone: z
      .string()
      .transform((val) => (val === '' ? undefined : val))
      .optional()
      .refine(
        (val) => !val || /^\+?[\d\s\-]{7,20}$/.test(val),
        'El teléfono debe tener entre 7 y 20 dígitos y formato válido (+51...)',
      ),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres.')
      .max(128, 'La contraseña es demasiado larga.')
      .refine((val) => /[A-Z]/.test(val), 'Debe contener al menos una letra mayúscula.')
      .refine((val) => /[0-9]/.test(val), 'Debe contener al menos un número.'),
    passwordConfirm: z.string().min(8, 'Confirma tu contraseña.'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Las contraseñas no coinciden.',
    path: ['passwordConfirm'],
  })

type RegisterFormValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const { mutate: registerUser, isPending } = useRegister()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      password: '',
      passwordConfirm: '',
    },
  })

  const onSubmit = (data: RegisterFormValues) => {
    // Solo enviamos los campos DTO esperados por el backend
    const payload: import('../api/auth.api').RegisterPayload = {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      password: data.password,
    }
    if (data.phone) {
      payload.phone = data.phone
    }
    registerUser(payload)
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-4xl bg-[#e6e6e6]/90 backdrop-blur-md rounded-[40px] border-2 border-[#5c0f1b] p-8 md:p-12 shadow-[0_20px_50px_rgba(92,15,27,0.15)]"
      >
        {/* Cabecera del Formulario */}
        <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-8 pb-4 border-b border-[#5c0f1b]/10">
          <div className="flex items-baseline gap-3">
            <h1 
              className="font-display text-[#5c0f1b] text-4xl md:text-5xl font-black tracking-tight"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Mitrufely
            </h1>
            <span className="text-lg font-bold text-[#2a1115]/80 font-sans tracking-wide">
              Datos de nuevo usuario
            </span>
          </div>
          <Link 
            to="/login" 
            className="text-[#5c0f1b] hover:text-[#ff7a45] text-sm font-black underline mt-2 md:mt-0 transition-colors"
          >
            ¿Ya tienes cuenta? Inicia sesión
          </Link>
        </div>

        {/* Formulario estructurado en Cuadrícula (Grid) */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Campo: Nombres */}
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#5c0f1b]">
                <User className="h-5 w-5" />
              </span>
              <input
                type="text"
                placeholder="Nombre"
                {...register('first_name')}
                className={`w-full bg-[#f0efed]/90 text-[#2a1115] placeholder-[#5c0f1b]/40 rounded-full border-2 pl-12 pr-4 py-3.5 text-base font-medium transition-all outline-none ${
                  errors.first_name 
                    ? 'border-destructive focus:ring-2 focus:ring-destructive' 
                    : 'border-[#5c0f1b] focus:border-[#ff7a45] focus:ring-2 focus:ring-[#ff7a45]'
                }`}
              />
              {errors.first_name && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-destructive mt-1.5 pl-3"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.first_name.message}
                </motion.p>
              )}
            </div>

            {/* Campo: Apellidos */}
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#5c0f1b]">
                <User className="h-5 w-5" />
              </span>
              <input
                type="text"
                placeholder="Apellidos"
                {...register('last_name')}
                className={`w-full bg-[#f0efed]/90 text-[#2a1115] placeholder-[#5c0f1b]/40 rounded-full border-2 pl-12 pr-4 py-3.5 text-base font-medium transition-all outline-none ${
                  errors.last_name 
                    ? 'border-destructive focus:ring-2 focus:ring-destructive' 
                    : 'border-[#5c0f1b] focus:border-[#ff7a45] focus:ring-2 focus:ring-[#ff7a45]'
                }`}
              />
              {errors.last_name && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-destructive mt-1.5 pl-3"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.last_name.message}
                </motion.p>
              )}
            </div>

            {/* Campo: Correo Electrónico */}
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#5c0f1b]">
                <Mail className="h-5 w-5" />
              </span>
              <input
                type="email"
                placeholder="Email"
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

            {/* Campo: Teléfono */}
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#5c0f1b]">
                <Phone className="h-5 w-5" />
              </span>
              <input
                type="text"
                placeholder="Telefono (Opcional)"
                {...register('phone')}
                className={`w-full bg-[#f0efed]/90 text-[#2a1115] placeholder-[#5c0f1b]/40 rounded-full border-2 pl-12 pr-4 py-3.5 text-base font-medium transition-all outline-none ${
                  errors.phone 
                    ? 'border-destructive focus:ring-2 focus:ring-destructive' 
                    : 'border-[#5c0f1b] focus:border-[#ff7a45] focus:ring-2 focus:ring-[#ff7a45]'
                }`}
              />
              {errors.phone && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-destructive mt-1.5 pl-3"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.phone.message}
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

            {/* Campo: Confirmar Contraseña */}
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#5c0f1b]">
                <Lock className="h-5 w-5" />
              </span>
              <input
                type="password"
                placeholder="Confirmar contraseña"
                {...register('passwordConfirm')}
                className={`w-full bg-[#f0efed]/90 text-[#2a1115] placeholder-[#5c0f1b]/40 rounded-full border-2 pl-12 pr-4 py-3.5 text-base font-medium transition-all outline-none ${
                  errors.passwordConfirm 
                    ? 'border-destructive focus:ring-2 focus:ring-destructive' 
                    : 'border-[#5c0f1b] focus:border-[#ff7a45] focus:ring-2 focus:ring-[#ff7a45]'
                }`}
              />
              {errors.passwordConfirm && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-destructive mt-1.5 pl-3"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.passwordConfirm.message}
                </motion.p>
              )}
            </div>
          </div>

          {/* Botón Registrase */}
          <div className="flex justify-end pt-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isPending}
              className="px-10 bg-[#ff7a45] text-white hover:bg-[#ff7a45]/90 py-3.5 rounded-full text-lg font-black tracking-wide shadow-md transition-all disabled:opacity-75 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Registrando...</span>
                </>
              ) : (
                <span>Registarse</span>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
