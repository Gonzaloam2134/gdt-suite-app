import { useState, useCallback, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { listarTransaccionesDia, listarAcreditacionesDia } from '../lib/services/transacciones'
import { calcularTotalesDia, calcularAcreditacionesDia } from '../lib/domain/transacciones'
import { hoyISO } from '../lib/dates'

const VACIO = {
  totales: { cobros: 0, gastos: 0, efectivoCobrado: 0, efectivoGastado: 0, disponibleHoy: 0, pendienteAcreditacion: 0, comisiones: 0, netoReal: 0 },
  cobros: [], gastos: [], acreditacionesHoy: [], desgloseMedios: [],
}

/**
 * Transacciones del día + totales calculados. Toda la aritmética vive en lib/domain.
 *
 * "Disponible hoy" y "Acreditaciones del día" salen de una consulta aparte
 * (`listarAcreditacionesDia`, filtrada por fecha de acreditación) porque esa
 * plata puede venir de ventas de días anteriores, no solo de las de hoy.
 */
export function useTransaccionesDia(localId, diaISO = hoyISO()) {
  const [datos, setDatos] = useState(VACIO)
  const [transacciones, setTransacciones] = useState([])
  const [loading, setLoading] = useState(true)
  const montado = useRef(true)
  useEffect(() => { montado.current = true; return () => { montado.current = false } }, [])

  const cargar = useCallback(async () => {
    if (!localId) return
    setLoading(true)
    try {
      const [filas, acreditan] = await Promise.all([
        listarTransaccionesDia(localId, diaISO),
        listarAcreditacionesDia(localId, diaISO),
      ])
      if (!montado.current) return
      const base = calcularTotalesDia(filas, diaISO)
      const { disponibleHoy, acreditacionesHoy } = calcularAcreditacionesDia(acreditan)
      setTransacciones(filas)
      setDatos({ ...base, totales: { ...base.totales, disponibleHoy }, acreditacionesHoy })
    } catch (err) {
      if (!montado.current) return
      console.error('[useTransaccionesDia]', err)
      toast.error('No se pudieron cargar los movimientos del día')
      setDatos(VACIO)
    } finally {
      if (montado.current) setLoading(false)
    }
  }, [localId, diaISO])

  useEffect(() => { cargar() }, [cargar])

  return { ...datos, transacciones, loading, recargar: cargar }
}
