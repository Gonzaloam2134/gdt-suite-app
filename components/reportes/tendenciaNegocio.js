import { aFechaISO, desdeFechaISO, hoyISO, sumarDias } from '../../lib/dates'

/**
 * Datos de la tarjeta "Cómo viene el negocio". Funciones puras, sin React,
 * para poder testearlas. (Si se aprueba, lo natural es moverlas a lib/domain.)
 *
 * Reglas para no inventar nada:
 *  - La serie son las ventas por día CALENDARIO del período, hasta ayer. Hoy
 *    queda afuera porque está incompleto y haría ver una caída falsa.
 *  - Un día sin movimientos cargados vale 0 (es lo que dice el dato).
 *  - Solo hay insight si el período tiene al menos 14 días completos, al menos
 *    7 con ventas y la semana de comparación vendió algo.
 */
export const MIN_DIAS_PERIODO = 14
export const MIN_DIAS_CON_VENTAS = 7

/** porDia viene de agruparPorDia (solo días con movimientos): se completa el calendario. */
export const serieDiaria = (porDia, desde, hasta, hoy = hoyISO()) => {
  const ayer = aFechaISO(sumarDias(desdeFechaISO(hoy), -1))
  const fin = hasta < ayer ? hasta : ayer
  const ventas = new Map(porDia.map(d => [d.fecha, d.ventas]))
  const serie = []
  for (let d = desdeFechaISO(desde); aFechaISO(d) <= fin; d = sumarDias(d, 1)) {
    const fecha = aFechaISO(d)
    serie.push({ fecha, ventas: ventas.get(fecha) || 0 })
  }
  return serie
}

const sumar = (dias) => dias.reduce((s, d) => s + d.ventas, 0)

/** Últimos 7 días completos vs. los 7 anteriores. */
export const calcularTendencia = (serie) => {
  if (serie.length < MIN_DIAS_PERIODO) {
    return { estado: 'insuficiente', motivo: `El período tiene ${serie.length} día${serie.length === 1 ? '' : 's'} completo${serie.length === 1 ? '' : 's'} y hacen falta al menos ${MIN_DIAS_PERIODO} para comparar semanas.` }
  }
  const conVentas = serie.filter(d => d.ventas > 0).length
  if (conVentas < MIN_DIAS_CON_VENTAS) {
    return { estado: 'insuficiente', motivo: `Solo hay ${conVentas} día${conVentas === 1 ? '' : 's'} con ventas y hacen falta al menos ${MIN_DIAS_CON_VENTAS}.` }
  }
  const ultimos = sumar(serie.slice(-7))
  const anteriores = sumar(serie.slice(-14, -7))
  if (anteriores === 0) {
    return { estado: 'insuficiente', motivo: 'La semana anterior no tiene ventas cargadas, no hay con qué comparar.' }
  }
  return { estado: 'ok', ultimos, anteriores, porcentaje: ((ultimos - anteriores) / anteriores) * 100 }
}
