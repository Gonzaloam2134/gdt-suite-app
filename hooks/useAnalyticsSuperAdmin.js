import { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { listarTransaccionesGlobalesPeriodo } from '../lib/services/transacciones'
import { periodoRapido } from '../lib/dates'
import {
  agruparTransaccionesPorLocal,
  agruparPorOwner,
  agruparPorTipoMedioPago,
  localesInactivos,
  suscripcionesPorVencerPronto,
} from '../lib/domain/analyticsSuperadmin'

/**
 * Datos del tab de Análisis del superadmin. `locales` y `suscripciones` ya
 * están cargados por useSuperAdminData — este hook solo trae las
 * transacciones del período elegido (no las trae ese hook, porque en una
 * plataforma con muchos locales y mucho historial sería pesado pedirlas
 * siempre, aunque nadie abra este tab).
 */
export function useAnalyticsSuperAdmin(locales, suscripciones) {
  const [periodo, setPeriodo] = useState('ultimos-30')
  const [transacciones, setTransacciones] = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { desde, hasta } = periodoRapido(periodo)
      const filas = await listarTransaccionesGlobalesPeriodo(desde, hasta)
      setTransacciones(filas)
    } catch (err) {
      console.error('[useAnalyticsSuperAdmin]', err)
      toast.error('No se pudieron cargar las transacciones del período')
    } finally {
      setLoading(false)
    }
  }, [periodo])

  useEffect(() => { cargar() }, [cargar])

  const statsPorLocal = useMemo(() => agruparTransaccionesPorLocal(transacciones), [transacciones])
  const statsPorOwner = useMemo(() => agruparPorOwner(statsPorLocal, locales), [statsPorLocal, locales])
  const statsPorMedioPago = useMemo(() => agruparPorTipoMedioPago(transacciones), [transacciones])
  const inactivos = useMemo(() => localesInactivos(statsPorLocal, 14), [statsPorLocal])
  const porVencer = useMemo(() => suscripcionesPorVencerPronto(suscripciones, 7), [suscripciones])

  return { periodo, setPeriodo, statsPorLocal, statsPorOwner, statsPorMedioPago, inactivos, porVencer, loading, recargar: cargar }
}
