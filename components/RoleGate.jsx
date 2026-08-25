import { useUserRole } from '../lib/UserRoleContext'

/**
 * Muestra `children` solo si el usuario tiene uno de los roles permitidos.
 * FAIL-CLOSED: mientras carga o si el rol es desconocido, no muestra nada.
 * Super user ve todo. Sin allowedRoles, solo exige estar autenticado con rol.
 */
export default function RoleGate({ children, allowedRoles = [], fallback = null }) {
  const { role, esSuperUser, loading } = useUserRole()
  if (loading) return fallback
  if (esSuperUser) return children
  if (!role) return fallback
  if (allowedRoles.length === 0) return children
  return allowedRoles.includes(role) ? children : fallback
}
