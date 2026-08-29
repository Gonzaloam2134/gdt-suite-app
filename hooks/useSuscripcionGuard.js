import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { getSuscripcion } from '../lib/services/suscripciones'
import { estadoEfectivo } from '../lib/domain/suscripciones'

const MENSAJE_SUSPENDIDO = 'Local suspendido. Regularizá el pago para acceder.'
const MENSAJE_PRUEBA_VENCIDA = 'Tu prueba de 30 días terminó. Podés seguir viendo tus reportes; escribinos para seguir usando la caja.'
const MENSAJE_RESTRINGIDO = 'Acceso restringido: solo podés ver Reportes.'

/**
 * Bloquea el acceso a una pantalla de UN local según `suscripciones.estado`,
 * sin importar cómo se llegó (selector, un link/refresh directo con el local
 * ya elegido en localStorage). Antes esto solo se chequeaba en `/locales` al
 * elegir el local desde la tarjeta: entrando directo a `/dashboard` o
 * `/admin` con ese local ya activo, la app funcionaba normal aunque estuviera
 * suspendido — el bloqueo dependía de por dónde entrabas, no de si podías.
 *
 * `getSuscripcion` sin fila → 'active' (mismo criterio que ya usa `/locales`:
 * un local sin suscripción registrada no está bloqueado).
 *
 * @param {string} localId
 * @param {'total'|'solo-reportes'} modo  'solo-reportes' no redirige en
 *   'restricted' (para /reportes, que es justamente el destino permitido
 *   cuando el acceso está restringido).
 */
export function useSuscripcionGuard(localId, modo = 'total') {
  const router = useRouter()
  const [estado, setEstado] = useState(null)
  const [vencioPrueba, setVencioPrueba] = useState(false)
  const [checking, setChecking] = useState(true)
  const montado = useRef(true)
  useEffect(() => { montado.current = true; return () => { montado.current = false } }, [])

  const verificar = useCallback(async () => {
    if (!localId) { if (montado.current) { setEstado(null); setChecking(false) }; return }
    setChecking(true)
    let valor = 'active'
    let venciendo = false
    try {
      const sub = await getSuscripcion(localId)
      const efectivo = estadoEfectivo(sub)
      valor = efectivo.estado
      venciendo = efectivo.vencioPrueba
    } catch (err) {
      console.error('[useSuscripcionGuard]', err)
    }
    if (!montado.current) return
    setEstado(valor)
    setVencioPrueba(venciendo)
    if (valor === 'suspended') {
      toast.error(MENSAJE_SUSPENDIDO)
      router.replace('/locales')
    } else if (valor === 'restricted' && modo === 'total') {
      toast(venciendo ? MENSAJE_PRUEBA_VENCIDA : MENSAJE_RESTRINGIDO, { icon: '⚠️' })
      router.replace('/reportes')
    }
    setChecking(false)
  }, [localId, modo, router])

  useEffect(() => { verificar() }, [verificar])

  const debeRedirigir = estado === 'suspended' || (estado === 'restricted' && modo === 'total')

  return { estado, checking, debeRedirigir, vencioPrueba }
}
