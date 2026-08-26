import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getLocal } from '../lib/services/locales'
import { useUserRole } from '../lib/UserRoleContext'

/**
 * Local activo, sincronizado con el contexto.
 *
 * Lee activeLocalId del contexto y no de localStorage: cuando el usuario cambia
 * de local con el selector, el contexto se actualiza y esta pantalla recarga sus
 * datos. Leyendo localStorage directo, el hook solo se enteraba al montar y la
 * caja seguía mostrando el local anterior.
 */
export function useActiveLocal(user) {
  const router = useRouter()
  const { activeLocalId, loading: cargandoRol } = useUserRole()
  const [local, setLocal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || cargandoRol) return

    if (!activeLocalId) {
      setLocal(null)
      setLoading(false)
      router.replace('/locales')
      return
    }

    let cancelado = false
    setLoading(true)
    getLocal(activeLocalId)
      .then((l) => { if (!cancelado) setLocal(l) })
      .catch((e) => console.error('[useActiveLocal]', e))
      .finally(() => { if (!cancelado) setLoading(false) })

    return () => { cancelado = true }
  }, [user, activeLocalId, cargandoRol, router])

  return { local, localId: activeLocalId, loading }
}
