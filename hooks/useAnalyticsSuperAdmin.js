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
  ownerPorLocal,
} from '../lib/domain/analyticsSuperadmin'
import {
  resumenComisiones,
  comisionesPorTipoMedioPago,
  heatmapHoraDia,
  serieSemanal,
  alertaCaidaVentas,
  crecimientoVentasVsGastos,
} from '../lib/domain/analyticsAvanzado'

/**
 * Datos del tab de Análisis del superadmin. `locales` y `suscripciones` ya
 * están cargados por useSuperAdminData — este hook solo trae las
 * transacciones del período elegido (no las trae ese hook, porque en una
 * plataforma con muchos locales y mucho historial sería pesado pedirlas
 * siempre, aunque nadie abra este tab).
 *
 * `scope` acota TODO el análisis (ranking, comisiones, heatmap, alertas) a
 * un owner o un local puntual — pensado para sostener una conversación de
 * consultoría con un dueño sin que se le mezclen los números de otros.
 * `scope.tipo === 'todos'` es la única vista que mira la plataforma entera.
 */
export function useAnalyticsSuperAdmin(locales, suscripciones) {
  const [periodo, setPeriodo] = useState('ultimos-30')
  const [transacciones, setTransacciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState({ tipo: 'todos', id: null })

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

  const ownerMap = useMemo(() => ownerPorLocal(locales), [locales])

  const transaccionesScope = useMemo(() => {
    if (scope.tipo === 'local') return transacciones.filter((t) => t.local_id === scope.id)
    if (scope.tipo === 'owner') return transacciones.filter((t) => ownerMap.get(t.local_id)?.ownerId === scope.id)
    return transacciones
  }, [transacciones, scope, ownerMap])

  // Ranking / overview — ya acotados por `scope` (en 'todos' es la plataforma entera).
  const statsPorLocal = useMemo(() => agruparTransaccionesPorLocal(transaccionesScope), [transaccionesScope])
  const statsPorOwner = useMemo(() => agruparPorOwner(statsPorLocal, locales), [statsPorLocal, locales])
  const statsPorMedioPago = useMemo(() => agruparPorTipoMedioPago(transaccionesScope), [transaccionesScope])
  const inactivos = useMemo(() => localesInactivos(statsPorLocal, 14), [statsPorLocal])

  const ownerIdDelScope = useMemo(() => {
    if (scope.tipo === 'owner') return scope.id
    if (scope.tipo === 'local') return ownerMap.get(scope.id)?.ownerId || null
    return null
  }, [scope, ownerMap])

  const suscripcionesScope = useMemo(
    () => (ownerIdDelScope ? suscripciones.filter((s) => s.owner_id === ownerIdDelScope) : suscripciones),
    [suscripciones, ownerIdDelScope]
  )
  const porVencer = useMemo(() => suscripcionesPorVencerPronto(suscripcionesScope, 7), [suscripcionesScope])

  // Detalle profundo — mismo `transaccionesScope` de arriba.
  const comisiones = useMemo(() => resumenComisiones(transaccionesScope), [transaccionesScope])
  const comisionesPorMedio = useMemo(() => comisionesPorTipoMedioPago(transaccionesScope), [transaccionesScope])
  const heatmap = useMemo(() => heatmapHoraDia(transaccionesScope), [transaccionesScope])
  const serie = useMemo(() => serieSemanal(transaccionesScope), [transaccionesScope])
  const alertaCaida = useMemo(() => alertaCaidaVentas(serie), [serie])
  const crecimiento = useMemo(() => crecimientoVentasVsGastos(serie), [serie])

  return {
    periodo, setPeriodo,
    statsPorLocal, statsPorOwner, statsPorMedioPago, inactivos, porVencer,
    scope, setScope,
    comisiones, comisionesPorMedio, heatmap, serie, alertaCaida, crecimiento,
    loading, recargar: cargar,
  }
}
