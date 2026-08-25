import { useState, useCallback, useEffect } from 'react'
import { listarAnuncios, listarLeidos, marcarLeidos, desmarcarLeido } from '../lib/services/anuncios'

/**
 * Anuncios no leídos del usuario. Los leídos viven en la tabla anuncios_leidos:
 * antes estaban en localStorage y volvían a aparecer al cambiar de dispositivo
 * o al limpiar el navegador.
 */
export function useAnuncios(userId) {
  const [todos, setTodos] = useState([])
  const [leidos, setLeidos] = useState([])
  const [cargado, setCargado] = useState(false)

  const cargar = useCallback(async () => {
    if (!userId) return
    try {
      const [lista, ids] = await Promise.all([listarAnuncios(), listarLeidos(userId)])
      setTodos(lista)
      setLeidos(ids)
    } catch (err) {
      console.error('[useAnuncios]', err)
      setTodos([])
      setLeidos([])
    } finally { setCargado(true) }
  }, [userId])

  const pendientes = todos.filter(a => !leidos.includes(a.id))

  useEffect(() => { cargar() }, [cargar])

  /** Marca los anuncios como leídos y los saca de pendientes (optimista). */
  const marcarComoLeidos = useCallback(async (ids) => {
    const nuevos = [].concat(ids || []).filter(Boolean)
    if (!userId || nuevos.length === 0) return
    setLeidos(prev => [...new Set([...prev, ...nuevos])])
    try {
      await marcarLeidos(userId, nuevos)
    } catch (err) {
      console.error('[useAnuncios] no se pudieron marcar como leídos', err)
      cargar()   // si falló, volvemos al estado real
    }
  }, [userId, cargar])

  /** Volver a marcar como no leído (centro de anuncios). */
  const marcarComoNoLeido = useCallback(async (id) => {
    if (!userId) return
    setLeidos(prev => prev.filter(x => x !== id))
    try {
      await desmarcarLeido(userId, id)
    } catch (err) {
      console.error('[useAnuncios] no se pudo desmarcar', err)
      cargar()
    }
  }, [userId, cargar])

  /** Todos los anuncios con su estado de lectura, para el centro de anuncios. */
  const conEstado = todos.map(a => ({ ...a, leido: leidos.includes(a.id) }))

  return {
    todos: conEstado, pendientes, cantidad: pendientes.length, cargado,
    marcarComoLeidos, marcarComoNoLeido, recargar: cargar,
  }
}
