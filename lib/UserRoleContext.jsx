import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const UserRoleContext = createContext(null)

export function UserRoleProvider({ children }) {
  const [role, setRole] = useState('owner') // ✅ Fallback seguro por defecto
  const [globalRole, setGlobalRole] = useState('owner')
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          setLoading(false)
          return
        }

        setUserId(session.user.id)

        // 1. Cargar rol global (usamos maybeSingle para evitar error si no existe la fila)
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol_global')
          .eq('id', session.user.id)
          .maybeSingle() // ✅ CAMBIO CLAVE: No lanza error si hay 0 filas

        if (perfil?.rol_global) {
          setGlobalRole(perfil.rol_global)
        }

        // Si es super_user, tiene acceso total
        if (perfil?.rol_global === 'super_user') {
          setRole('super_user')
          setLoading(false)
          return
        }

        // 2. Cargar rol en el local activo
        const activeLocalId = typeof window !== 'undefined' 
          ? localStorage.getItem('activeLocalId') 
          : null

        if (!activeLocalId) {
          setLoading(false)
          return
        }

        const { data: miembro } = await supabase
          .from('miembros_locales')
          .select('rol')
          .eq('local_id', activeLocalId)
          .eq('user_id', session.user.id)
          .eq('activo', true)
          .maybeSingle() // ✅ CAMBIO CLAVE: No lanza error si no es miembro aún

        if (miembro?.rol) {
          setRole(miembro.rol)
        } else {
          console.warn('⚠️ Usuario no encontrado en miembros_locales. Usando fallback: owner')
          // Se mantiene el fallback 'owner' definido al inicio
        }
        
      } catch (err) {
        console.error('❌ [UserRole] Error fatal:', err)
      } finally {
        setLoading(false)
      }
    }

    loadRole()
  }, [])

  const hasRole = (allowedRoles) => {
    if (!role) return false
    if (globalRole === 'super_user') return true
    return allowedRoles.includes(role)
  }

  return (
    <UserRoleContext.Provider value={{ role, globalRole, userId, loading, hasRole }}>
      {children}
    </UserRoleContext.Provider>
  )
}

export function useUserRole() {
  const context = useContext(UserRoleContext)
  if (!context) {
    throw new Error('useUserRole debe usarse dentro de UserRoleProvider')
  }
  return context
}
