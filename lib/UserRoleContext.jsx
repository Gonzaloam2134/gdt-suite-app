import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const UserRoleContext = createContext(null)

export function UserRoleProvider({ children }) {
  const [role, setRole] = useState('owner') // ✅ FALLBACK: por defecto owner
  const [globalRole, setGlobalRole] = useState('owner')
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRole = async () => {
      try {
        console.log('🔍 [UserRole] Iniciando carga de rol...')
        
        const { data: { session } } = await supabase.auth.getSession()
        console.log(' [UserRole] Session:', session?.user?.email)
        
        if (!session?.user) {
          console.log('⚠️ [UserRole] No hay sesión')
          setLoading(false)
          return
        }

        setUserId(session.user.id)

        // Cargar rol global desde perfiles
        const { data: perfil, error: perfilError } = await supabase
          .from('perfiles')
          .select('rol_global')
          .eq('id', session.user.id)
          .single()

        if (perfilError) {
          console.warn('⚠️ [UserRole] Error cargando perfil:', perfilError.message)
        } else {
          console.log('🔍 [UserRole] Perfil:', perfil)
          setGlobalRole(perfil?.rol_global || 'owner')
        }

        // Si es super_user, tiene acceso total
        if (perfil?.rol_global === 'super_user') {
          console.log('✅ [UserRole] Es super_user')
          setRole('super_user')
          setLoading(false)
          return
        }

        // Cargar rol en el local activo
        const activeLocalId = typeof window !== 'undefined' 
          ? localStorage.getItem('activeLocalId') 
          : null

        console.log('🔍 [UserRole] activeLocalId:', activeLocalId)

        if (!activeLocalId) {
          console.log('️ [UserRole] No hay local activo')
          setRole('owner') // Fallback
          setLoading(false)
          return
        }

        const { data: miembro, error: miembroError } = await supabase
          .from('miembros_locales')
          .select('rol')
          .eq('local_id', activeLocalId)
          .eq('user_id', session.user.id)
          .eq('activo', true)
          .single()

        if (miembroError) {
          console.warn('⚠️ [UserRole] Error cargando miembro:', miembroError.message)
          setRole('owner') // ✅ FALLBACK
        } else if (!miembro) {
          console.warn('⚠️ [UserRole] Miembro no encontrado. Usando fallback: owner')
          setRole('owner') // ✅ FALLBACK
        } else {
          console.log('✅ [UserRole] Miembro encontrado:', miembro)
          setRole(miembro.rol || 'owner')
        }
        
      } catch (err) {
        console.error('❌ [UserRole] Error fatal:', err)
        setRole('owner') // ✅ FALLBACK SEGURO
      } finally {
        setLoading(false)
        console.log('✅ [UserRole] Carga completada. Rol final:', role)
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