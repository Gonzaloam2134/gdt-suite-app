import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  listarPendientesDeLocal, listarPendientesSinAsignar,
  asignarLocal, marcarConfirmado, descartarPendiente,
} from '../lib/services/movimientosMpPendientes'
import { registrarCobro } from '../lib/services/transacciones'

const conToken = async (path, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${session?.access_token}`, ...(options.headers || {}) },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.error || 'Error de red')
    err.reintentarEnSegundos = data?.reintentarEnSegundos
    throw err
  }
  return data
}

// Cada cuánto se sincroniza sola la pantalla mientras está abierta. Un poco
// por encima del cooldown del servidor (60s, ver pages/api/mercadopago-
// cliente/sincronizar.js) para no pisarlo nunca.
const INTERVALO_AUTOSYNC_MS = 65_000

/** Cola de "por confirmar" de ESTE local (dashboard) — QR/Point que ya se pudieron asignar solos, más transferencias que el dueño ya asignó a mano. */
export function usePendientesDeLocal(localId) {
  const [pendientes, setPendientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)

  const cargar = useCallback(async () => {
    if (!localId) return
    setLoading(true)
    try {
      setPendientes(await listarPendientesDeLocal(localId))
    } catch (err) {
      console.error('[usePendientesDeLocal]', err)
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => { cargar() }, [cargar])

  /** Confirmar = crear la transacción real (nunca se carga sola) y recién ahí cerrar el pendiente. */
  const confirmar = async (pendiente, { medio, alicuota, tipoComprobante }) => {
    const tx = await registrarCobro({
      localId, medio,
      monto: Number(pendiente.monto),
      descripcion: pendiente.descripcion || `Mercado Pago (${pendiente.origen})`,
      alicuota, tipoComprobante,
    })
    await marcarConfirmado(pendiente.id, tx.id)
    await cargar()
    return tx
  }

  const descartar = async (pendienteId) => {
    await descartarPendiente(pendienteId)
    await cargar()
  }

  /** Botón "Sincronizar": pide a Mercado Pago los cobros recientes de la cuenta, sin esperar al cron diario (pages/api/mercadopago-cliente/sincronizar.js — tiene su propio cooldown del lado del servidor). */
  const sincronizar = async () => {
    setSincronizando(true)
    try {
      const resultado = await conToken('/api/mercadopago-cliente/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId }),
      })
      await cargar()
      return resultado
    } finally {
      setSincronizando(false)
    }
  }

  // Autosync: mientras esta pantalla está abierta, pedimos solos lo nuevo cada
  // un rato — así el cajero no tiene que acordarse de tocar "Sincronizar" ni
  // refrescar la página para que aparezca una transferencia. Silencioso: si
  // pega contra el cooldown del servidor (alguien ya sincronizó hace poco,
  // a mano o desde otra pestaña) simplemente no hace nada, no es un error
  // real que el cajero necesite ver.
  useEffect(() => {
    if (!localId) return
    const id = setInterval(() => {
      conToken('/api/mercadopago-cliente/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId }),
      }).then(cargar).catch(() => {})
    }, INTERVALO_AUTOSYNC_MS)
    return () => clearInterval(id)
  }, [localId, cargar])

  return { pendientes, loading, confirmar, descartar, sincronizar, sincronizando, recargar: cargar }
}

/** Transferencias (y algún Point sin resolver) de la CUENTA que todavía no tienen local — nivel Admin, no dashboard. */
export function usePendientesSinAsignar(ownerId) {
  const [pendientes, setPendientes] = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!ownerId) return
    setLoading(true)
    try {
      setPendientes(await listarPendientesSinAsignar(ownerId))
    } catch (err) {
      console.error('[usePendientesSinAsignar]', err)
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  useEffect(() => { cargar() }, [cargar])

  const asignar = async (pendienteId, localId) => {
    await asignarLocal(pendienteId, localId)
    await cargar()
  }

  return { pendientes, loading, asignar, recargar: cargar }
}
