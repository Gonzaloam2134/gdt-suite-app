import { useCallback, useEffect, useState } from 'react'
import { getTerminosVersion, aceptarTerminos } from '../lib/services/auth'
import { debeAceptarTerminos } from '../lib/domain/terminos'
import { VERSION_TERMINOS_ACTUAL } from '../lib/constants/legal'

/**
 * Bloquea el acceso a cualquier pantalla hasta que la persona acepte la
 * versión vigente de los Términos y Condiciones — alcanza a TODOS los roles,
 * no solo a los registros nuevos: un dueño, cajero o empleado con una cuenta
 * vieja tiene que aceptar la próxima vez que entra, igual que uno nuevo.
 */
export function useTerminosGuard(userId) {
  const [debeAceptar, setDebeAceptar] = useState(false)
  const [checking, setChecking] = useState(true)

  const verificar = useCallback(async () => {
    if (!userId) { setDebeAceptar(false); setChecking(false); return }
    setChecking(true)
    try {
      const perfil = await getTerminosVersion(userId)
      setDebeAceptar(debeAceptarTerminos(perfil?.terminos_version ?? null, VERSION_TERMINOS_ACTUAL))
    } catch (err) {
      console.error('[useTerminosGuard]', err)
      // Fail-closed: si no se pudo verificar, se pide aceptar antes de seguir.
      setDebeAceptar(true)
    } finally {
      setChecking(false)
    }
  }, [userId])

  useEffect(() => { verificar() }, [verificar])

  const aceptar = useCallback(async () => {
    await aceptarTerminos(userId, VERSION_TERMINOS_ACTUAL)
    setDebeAceptar(false)
  }, [userId])

  return { debeAceptar, checking, aceptar }
}
