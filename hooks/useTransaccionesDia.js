import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { listarTransaccionesDia } from '../lib/services/transacciones'
import { calcularTotalesDia } from '../lib/domain/transacciones'
import { hoyISO } from '../lib/dates'

const VACIO = {
  totales: { cobros: 0, gastos: 0, efectivoEnCaja: 0, disponibleHoy: 0, pendienteAcreditacion: 0, comisiones: 0, netoReal: 0 },
  cobros: [], gastos: [], acreditacionesHoy: [], desgloseMedios: [],
}

/** Transacciones del día + totales calculados. Toda la aritmética vive en lib/domain. */
export function useTransaccionesDia(localId, diaISO = hoyISO()) {
  const [datos, setDatos] = useState(VACIO)
  const [transacciones, setTransacciones] = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!localId) return
    setLoading(true)
    try {
      const filas = await listarTransaccionesDia(localId, diaISO)
      setTransacciones(filas)
      setDatos(calcularTotalesDia(filas, diaISO))
    } catch (err) {
      console.error('[useTransaccionesDia]', err)
      toast.error('No se pudieron cargar los movimientos del día')
      setDatos(VACIO)
    } finally { setLoading(false) }
  }, [localId, diaISO])

  useEffect(() => { cargar() }, [cargar])

  return { ...datos, transacciones, loading, recargar: cargar }
}
