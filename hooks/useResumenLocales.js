import { useState, useEffect } from 'react'
import { resumenHoyPorLocal } from '../lib/services/transacciones'
import { cajasAbiertasHoy } from '../lib/services/cierresCaja'

/** Ventas del día y estado de caja de cada local, para la pantalla de inicio. */
export function useResumenLocales(locales) {
  const [resumen, setResumen] = useState({})
  const [abiertas, setAbiertas] = useState(new Set())
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    const ids = locales.map(l => l.id)
    if (!ids.length) { setCargado(true); return }
    let cancelado = false
    Promise.all([resumenHoyPorLocal(ids), cajasAbiertasHoy(ids)])
      .then(([r, a]) => { if (!cancelado) { setResumen(r); setAbiertas(a) } })
      .catch(err => console.error('[useResumenLocales]', err))
      .finally(() => { if (!cancelado) setCargado(true) })
    return () => { cancelado = true }
  }, [locales])

  const totales = Object.values(resumen).reduce(
    (acc, r) => ({ ventas: acc.ventas + r.ventas, gastos: acc.gastos + r.gastos, movimientos: acc.movimientos + r.movimientos }),
    { ventas: 0, gastos: 0, movimientos: 0 },
  )

  return { resumen, abiertas, totales, cargado }
}
