import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getLocal } from '../lib/services/locales'

/**
 * Lee activeLocalId de localStorage y carga el local. Si no hay, redirige a /locales.
 * Usar junto con useAuthGuard: `const { user } = useAuthGuard(); const { local } = useActiveLocal(user)`
 */
export function useActiveLocal(user) {
  const router = useRouter()
  const [local, setLocal] = useState(null)
  const [localId, setLocalId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const id = localStorage.getItem('activeLocalId')
    if (!id) { router.replace('/locales'); return }
    setLocalId(id)
    let cancelado = false
    getLocal(id)
      .then((l) => { if (!cancelado) setLocal(l) })
      .catch((e) => console.error('[useActiveLocal]', e))
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [user, router])

  return { local, localId, loading }
}
