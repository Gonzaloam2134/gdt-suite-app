import { useRouter } from 'next/router'
import { useUserRole } from '../lib/useUserRole'
import toast from 'react-hot-toast'

/**
 * Componente que protege rutas según el rol del usuario
 * 
 * Uso:
 * <ProtectedRoute allowedRoles={['owner', 'cajero']}>
 *   <Dashboard />
 * </ProtectedRoute>
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const router = useRouter()
  const { role, globalRole, loading, hasRole } = useUserRole()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-center">
          <div className="text-4xl mb-2"></div>
          <p className="text-gray-600 text-sm">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  // Si no hay rol, no está autenticado o no es miembro del local
  if (!role) {
    // Si es super_user, dejar pasar
    if (globalRole === 'super_user') {
      return children
    }
    
    // Redirigir a login
    if (typeof window !== 'undefined') {
      toast.error('No tenés acceso a este local')
      router.push('/locales')
    }
    return null
  }

  // Si no tiene el rol requerido
  if (allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    if (typeof window !== 'undefined') {
      toast.error(`Acceso denegado. Se requiere rol: ${allowedRoles.join(' o ')}`)
      router.push('/dashboard')
    }
    return null
  }

  return children
}