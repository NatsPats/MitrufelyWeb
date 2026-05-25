import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { authApi, type RegisterPayload } from '../api/auth.api'

export function useRegister() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: (data) => {
      toast.success(data.message || '¡Cuenta creada exitosamente!')
      navigate('/login')
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Error al crear la cuenta. Revisa los datos.'
      toast.error(message)
    },
  })
}
