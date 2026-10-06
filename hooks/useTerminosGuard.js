import { useCallback, useEffect, useRef, useState } from 'react'
import { getTerminosVersion, aceptarTerminos } from '../lib/services/auth'
import { getTerminosVigentes } from '../lib/services/legal'
import { debeAceptarTerminos } from '../lib/domain/terminos'

/**
 * Bloquea el acceso a cualquier pantalla hasta que la persona acepte la
 * versión vigente de los Términos y Condiciones — alcanza a TODOS los roles,
 * no solo a los registros nuevos: un dueño, cajero o empleado con una cuenta
 * vieja tiene que aceptar la próxima vez que entra, igual que uno nuevo.
 *
 * La versión vigente ahora la edita el super admin desde su panel (ya no es
 * una constante fija en el código): se consulta en cada verificación, así
 * que un cambio de texto pide la aceptación a todo el mundo sin necesitar
 * un deploy.
 */
export function useTerminosGuard(userId) {
  const [debeAceptar, setDebeAceptar] = useState(false)
  const [checking, setChecking] = useState(true)
  const versionVigenteRef = useRef(null)

  const verificar = useCallback(async () => {
    if (!userId) { setDebeAceptar(false); setChecking(false); return }
    setChecking(true)
    try {
      const [perfil, vigentes] = await Promise.all([getTerminosVersion(userId), getTerminosVigentes()])
      versionVigenteRef.current = vigentes.version
      setDebeAceptar(debeAceptarTerminos(perfil?.terminos_version ?? null, vigentes.version))
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
    await aceptarTerminos(userId, versionVigenteRef.current)
    setDebeAceptar(false)
  }, [userId])

  return { debeAceptar, checking, aceptar }
}
