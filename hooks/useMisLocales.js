import { useState, useEffect, useCallback } from 'react'
import { getMembresias } from '../lib/services/miembros'
import { getLocales } from '../lib/services/locales'

/** Locales a los que pertenece el usuario, con su rol en cada uno. */
export function useMisLocales(userId) {
  const [locales, setLocales] = useState([])
  const [cargado, setCargado] = useState(false)

  const cargar = useCallback(async () => {
    if (!userId) return
    try {
      const membresias = await getMembresias(userId)
      if (!membresias?.length) { setLocales([]); return }
      const datos = await getLocales(membresias.map(m => m.local_id))
      setLocales(datos.map(l => ({ ...l, rol: membresias.find(m => m.local_id === l.id)?.rol })))
    } catch (err) {
      console.error('[useMisLocales]', err)
      setLocales([])
    } finally { setCargado(true) }
  }, [userId])

  useEffect(() => { cargar() }, [cargar])

  return { locales, cargado, recargar: cargar }
}
