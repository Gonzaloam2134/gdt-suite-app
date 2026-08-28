import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { getMembresias } from '../lib/services/miembros'
import { getLocales } from '../lib/services/locales'
import { listarTransaccionesPeriodo } from '../lib/services/transacciones'
import { listarCierres } from '../lib/services/cierresCaja'
import { calcularResumenPeriodo } from '../lib/domain/transacciones'
import { agruparPorAlicuota, agruparPorMedio, agruparPorDia, evaluarCalidad, conciliarCierres } from '../lib/domain/reportes'
import { rangoEntre, periodoRapido } from '../lib/dates'
import { discriminaIva } from '../lib/constants/transacciones'

/** Datos del reporte contable para un local (o todos) en un período. */
export function useReportes(userId) {
  const [locales, setLocales] = useState([])
  const [localId, setLocalId] = useState('todos')
  const [periodo, setPeriodo] = useState(() => ({ ...periodoRapido('este-mes'), preset: 'este-mes' }))
  const [transacciones, setTransacciones] = useState([])
  const [cierres, setCierres] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    getMembresias(userId)
      .then(async (membresias) => {
        if (!membresias?.length) { setLocales([]); return }
        setLocales(await getLocales(membresias.map(m => m.local_id)))
      })
      .catch(() => toast.error('No se pudieron cargar tus locales'))
  }, [userId])

  const localIds = useMemo(
    () => (localId === 'todos' ? locales.map(l => l.id) : [localId]),
    [localId, locales],
  )

  // Evita que la respuesta de un período/local viejo pise a la del que el
  // usuario eligió después (si cambia de preset rápido y las respuestas llegan
  // fuera de orden).
  const peticionActual = useRef(0)

  const cargar = useCallback(async () => {
    if (!localIds.length) { setLoading(false); return }
    const idPeticion = ++peticionActual.current
    setLoading(true)
    try {
      const { inicio, fin } = rangoEntre(periodo.desde, periodo.hasta)
      const [tx, cj] = await Promise.all([
        listarTransaccionesPeriodo(localIds, periodo.desde, periodo.hasta),
        listarCierres(localIds, { inicio, fin, limite: 200 }),
      ])
      if (idPeticion !== peticionActual.current) return
      setTransacciones(tx)
      setCierres(cj)
    } catch (err) {
      if (idPeticion !== peticionActual.current) return
      toast.error(`No se pudo generar el reporte: ${err.message}`)
      setTransacciones([])
      setCierres([])
    } finally {
      if (idPeticion === peticionActual.current) setLoading(false)
    }
  }, [localIds, periodo])

  useEffect(() => { cargar() }, [cargar])

  /**
   * Consolidado: si son varios locales con condiciones fiscales distintas,
   * solo se discrimina IVA cuando TODOS lo discriminan; si no, los totales
   * mezclarían criterios y el número no significaría nada.
   */
  const localActual = localId === 'todos'
    ? { id: 'todos', nombre: 'Todos los locales', condicion_fiscal: locales.length > 0 && locales.every(l => discriminaIva(l.condicion_fiscal)) ? 'Responsable Inscripto' : 'Mixto' }
    : locales.find(l => l.id === localId)

  const datos = useMemo(() => {
    const conIva = discriminaIva(localActual?.condicion_fiscal)
    const { resumen, libroVentas, libroCompras } = calcularResumenPeriodo(transacciones, { discriminaIva: conIva })
    return {
      resumen, libroVentas, libroCompras, discriminaIva: conIva,
      porAlicuotaVentas: agruparPorAlicuota(libroVentas),
      porAlicuotaCompras: agruparPorAlicuota(libroCompras),
      porMedio: agruparPorMedio(transacciones),
      porDia: agruparPorDia(transacciones),
      calidad: evaluarCalidad(transacciones),
      conciliacion: conciliarCierres(cierres),
    }
  }, [transacciones, cierres, localActual?.condicion_fiscal])

  return {
    locales, localId, setLocalId, localActual, periodo, cierres, loading,
    aplicarPreset: (preset) => setPeriodo({ ...periodoRapido(preset), preset }),
    aplicarFechas: (desde, hasta) => setPeriodo({ desde, hasta, preset: 'personalizado' }),
    ...datos,
  }
}
