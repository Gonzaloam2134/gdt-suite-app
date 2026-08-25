import { useState, useCallback, useEffect } from 'react'
import { listarAnuncios, listarLeidos, marcarLeidos } from '../lib/services/anuncios'

/**
 * Anuncios no leídos del usuario. Los leídos viven en la tabla anuncios_leidos:
 * antes estaban en localStorage y volvían a aparecer al cambiar de dispositivo
 * o al limpiar el navegador.
 */
export function useAnuncios(userId) {
  const [pendientes, setPendientes] = useState([])
  const [cargado, setCargado] = useState(false)

  const cargar = useCallback(async () => {
    if (!userId) return
    try {
      const [todos, leidos] = await Promise.all([listarAnuncios(), listarLeidos(userId)])
      setPendientes(todos.filter(a => !leidos.includes(a.id)))
    } catch (err) {
      console.error('[useAnuncios]', err)
      setPendientes([])
    } finally { setCargado(true) }
  }, [userId])

  useEffect(() => { cargar() }, [cargar])

  /** Marca los anuncios como leídos y los saca de pendientes (optimista). */
  const marcarComoLeidos = useCallback(async (ids) => {
    if (!userId || !ids?.length) return
    setPendientes(prev => prev.filter(a => !ids.includes(a.id)))
    try {
      await marcarLeidos(userId, ids)
    } catch (err) {
      console.error('[useAnuncios] no se pudieron marcar como leídos', err)
      cargar()   // si falló, volvemos al estado real
    }
  }, [userId, cargar])

  return { pendientes, cantidad: pendientes.length, cargado, marcarComoLeidos, recargar: cargar }
}
