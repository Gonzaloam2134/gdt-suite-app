import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSession, getPerfil } from './services/auth'
import { getRolEnLocal } from './services/miembros'
import { ROLES_GLOBALES } from './constants/roles'

const UserRoleContext = createContext(null)

const leerLocalActivo = () => (typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null)

/**
 * Único origen de verdad sobre quién es el usuario y qué rol tiene en el local activo.
 * FAIL-CLOSED: si no se puede determinar el rol, role = null y la UI no muestra nada privilegiado.
 */
export function UserRoleProvider({ children }) {
  const [userId, setUserId] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [globalRole, setGlobalRole] = useState(null)
  const [role, setRole] = useState(null)
  const [activeLocalId, setActiveLocalId] = useState(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session?.user) { setUserId(null); setRole(null); setGlobalRole(null); return }
      setUserId(session.user.id)

      const p = await getPerfil(session.user.id)
      setPerfil(p)
      setGlobalRole(p?.rol_global ?? null)

      const localId = leerLocalActivo()
      setActiveLocalId(localId)

      if (p?.rol_global === ROLES_GLOBALES.SUPER_USER) { setRole('super_user'); return }
      if (!localId) { setRole(null); return }

      setRole(await getRolEnLocal(session.user.id, localId))
    } catch (err) {
      console.error('[UserRole] error cargando rol:', err)
      setRole(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /** Llamar después de cambiar de local (localStorage) para recargar el rol */
  const cambiarLocal = useCallback((localId) => {
    localStorage.setItem('activeLocalId', localId)
    return cargar()
  }, [cargar])

  const esSuperUser = globalRole === ROLES_GLOBALES.SUPER_USER
  const hasRole = useCallback((allowed = []) => {
    if (esSuperUser) return true
    if (!role) return false
    return allowed.includes(role)
  }, [role, esSuperUser])

  return (
    <UserRoleContext.Provider value={{ userId, perfil, role, globalRole, esSuperUser, activeLocalId, loading, hasRole, cambiarLocal, recargar: cargar }}>
      {children}
    </UserRoleContext.Provider>
  )
}

export function useUserRole() {
  const ctx = useContext(UserRoleContext)
  if (!ctx) throw new Error('useUserRole debe usarse dentro de UserRoleProvider')
  return ctx
}
