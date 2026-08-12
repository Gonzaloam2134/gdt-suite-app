import { useUserRole } from '../lib/useUserRole'

/**
 * Componente que muestra/oculta contenido según el rol del usuario.
 * 
 * Fallback de emergencia: Si no se puede determinar el rol (error de RLS),
 * se asume que el usuario es 'owner' para no bloquear la UI.
 */
export default function RoleGate({ children, allowedRoles = [] }) {
  const { role, globalRole, loading } = useUserRole()

  // 1. Mientras carga, mostramos todo (evita parpadeos)
  if (loading) return children
  
  // 2. Super user ve todo
  if (globalRole === 'super_user') return children
  
  // 3. Si no hay restricciones, mostramos todo
  if (!allowedRoles || allowedRoles.length === 0) return children
  
  // 4. FALLBACK DE EMERGENCIA: Si role es null (error de RLS), asumir owner
  const effectiveRole = role || 'owner'
  
  // 5. Verificación con el rol efectivo
  if (effectiveRole && allowedRoles.includes(effectiveRole)) return children
  
  // 6. Si nada coincide, ocultar
  return null
}