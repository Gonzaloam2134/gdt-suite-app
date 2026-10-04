import { useState, useEffect } from 'react'
import { resumenHoyPorLocal } from '../lib/services/transacciones'
import { cajasAbiertasHoy, getCajaAbiertaLocal } from '../lib/services/cierresCaja'
import { esCajaDeHoy } from '../lib/domain/cajas'

/** Ventas del día y estado de caja de cada local, para la pantalla de inicio. */
export function useResumenLocales(locales) {
  const [resumen, setResumen] = useState({})
  const [abiertas, setAbiertas] = useState(new Set())
  const [sinCerrar, setSinCerrar] = useState(new Set())   // locales con una caja de un día anterior que nunca se cerró
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    const ids = locales.map(l => l.id)
    if (!ids.length) { setCargado(true); return }
    let cancelado = false
    const buscarSinCerrar = () => Promise.all(ids.map(id =>
      getCajaAbiertaLocal(id).then(c => (c && !esCajaDeHoy(c) ? id : null)).catch(() => null)))
    Promise.all([resumenHoyPorLocal(ids), cajasAbiertasHoy(ids), buscarSinCerrar()])
      .then(([r, a, viejas]) => { if (!cancelado) { setResumen(r); setAbiertas(a); setSinCerrar(new Set(viejas.filter(Boolean))) } })
      .catch(err => console.error('[useResumenLocales]', err))
      .finally(() => { if (!cancelado) setCargado(true) })
    return () => { cancelado = true }
  }, [locales])

  const totales = Object.values(resumen).reduce(
    (acc, r) => ({ ventas: acc.ventas + r.ventas, gastos: acc.gastos + r.gastos, movimientos: acc.movimientos + r.movimientos }),
    { ventas: 0, gastos: 0, movimientos: 0 },
  )

  return { resumen, abiertas, sinCerrar, totales, cargado }
}
