import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { getMapeoDeLocal } from '../lib/services/mapeoLocalesMp'

const conToken = async (path, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${session?.access_token}`, ...(options.headers || {}) },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || 'Error de red')
  return data
}

/**
 * Estado de la conexión con Mercado Pago del DUEÑO (una cuenta cubre todos
 * sus locales) y el mapeo Store/POS de este local puntual. Combina el
 * service de mapeo (lectura directa, RLS lo permite) con las rutas de
 * servidor que hablan con Mercado Pago (conectar / vincular).
 */
export function useMercadoPagoCliente(localId) {
  const [conectado, setConectado] = useState(null) // null = todavía no se sabe
  const [mapeo, setMapeo] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [conectando, setConectando] = useState(false)
  const [vinculando, setVinculando] = useState(false)

  const cargar = useCallback(async () => {
    if (!localId) return
    setCargando(true)
    try {
      const [estado, mapeoLocal] = await Promise.all([
        conToken('/api/mercadopago-cliente/estado'),
        getMapeoDeLocal(localId),
      ])
      setConectado(estado.conectado)
      setMapeo(mapeoLocal)
    } catch (err) {
      console.error('[useMercadoPagoCliente]', err)
    } finally {
      setCargando(false)
    }
  }, [localId])

  useEffect(() => { cargar() }, [cargar])

  const conectar = async () => {
    setConectando(true)
    try {
      const { url } = await conToken('/api/mercadopago-cliente/conectar', { method: 'POST' })
      window.location.href = url
    } catch (err) {
      toast.error(err.message || 'No se pudo iniciar la conexión con Mercado Pago')
      setConectando(false)
    }
  }

  const vincular = async () => {
    setVinculando(true)
    try {
      const nuevoMapeo = await conToken('/api/mercadopago-cliente/vincular-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId }),
      })
      setMapeo(nuevoMapeo)
      toast.success('Local vinculado con Mercado Pago')
    } catch (err) {
      toast.error(err.message || 'No se pudo vincular el local')
    } finally {
      setVinculando(false)
    }
  }

  return { conectado, mapeo, cargando, conectando, vinculando, conectar, vincular, recargar: cargar }
}
