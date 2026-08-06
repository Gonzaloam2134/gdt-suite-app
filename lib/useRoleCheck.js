import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from './supabaseClient'

// Niveles de permiso: 1=Operador, 2=Administrador, 3=Dueño/SuperAdmin
const NIVELES = {
  'OPERADOR': 1,
  'ADMINISTRADOR': 2,
  'DUEÑO': 3,
  'SUPER_ADMIN': 3
}

export function useRoleCheck(requiredLevel = 1) {
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(null)
  const router = useRouter()
  const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

  useEffect(() => {
    const checkRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !activeLocalId) {
        router.push('/')
        return
      }

      const { data } = await supabase
        .from('roles_usuario')
        .select('rol')
        .eq('local_id', activeLocalId)
        .eq('usuario_id', session.user.id)
        .single()

      const userRole = data?.rol || 'OPERADOR'
      setRole(userRole)

      // Si el nivel del usuario es menor al requerido, lo echamos
      if (NIVELES[userRole] < requiredLevel) {
        alert('No tienes permisos para ver esta página.')
        router.push('/dashboard')
      }
      
      setLoading(false)
    }

    checkRole()
  }, [router, activeLocalId, requiredLevel])

  return { loading, role }
}
