import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export function useUserRole() {
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [globalRole, setGlobalRole] = useState(null)

  useEffect(() => {
    const loadRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          setLoading(false)
          return
        }

        setUserId(session.user.id)

        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol_global')
          .eq('id', session.user.id)
          .single()

        setGlobalRole(perfil?.rol_global || 'owner')

        if (perfil?.rol_global === 'super_user') {
          setRole('super_user')
          setLoading(false)
          return
        }

        const activeLocalId = typeof window !== 'undefined' 
          ? localStorage.getItem('activeLocalId') 
          : null

        if (!activeLocalId) {
          setRole(null)
          setLoading(false)
          return
        }

        const { data: miembro } = await supabase
          .from('miembros_locales')
          .select('rol')
          .eq('local_id', activeLocalId)
          .eq('user_id', session.user.id)
          .eq('activo', true)
          .single()

        setRole(miembro?.rol || null)
        
        // DEBUG (opcional - descomentar si es necesario)
        // console.log('🔍 useUserRole:', {
        //   userId: session.user.id,
        //   globalRole: perfil?.rol_global,
        //   role: miembro?.rol,
        //   activeLocalId,
        //   perfil,
        //   miembro
        // })
      } catch (err) {
        console.error('Error cargando rol:', err)
        setRole(null)
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

  return { role, globalRole, userId, loading, hasRole }
}