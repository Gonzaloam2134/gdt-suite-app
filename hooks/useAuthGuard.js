import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../lib/services/auth'

/**
 * Exige sesión. Si no hay, redirige a '/'.
 * Reemplaza el bloque `supabase.auth.getSession().then(... router.push('/'))` repetido en cada página.
 */
export function useAuthGuard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelado = false
    getSession().then((session) => {
      if (cancelado) return
      if (!session?.user) { router.replace('/'); return }
      setUser(session.user)
      setChecking(false)
    })
    return () => { cancelado = true }
  }, [router])

  return { user, checking }
}
