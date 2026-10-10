/**
 * Análisis más profundo para vender consultoría a los owners: no repite lo
 * que ya ven en Caja, busca algo que no sepan de su propio negocio (costo
 * real de comisiones, patrones horarios, caídas de ventas vs. su propio
 * historial). Puro, sin React ni Supabase — opera sobre una lista de
 * transacciones ya traída (de un local, de un owner, o de toda la
 * plataforma: el que llama decide el alcance filtrando antes).
 *
 * Igual que lib/domain/analyticsSuperadmin.js: reversas y transacciones
 * `revertida` no suman a ningún total.
 */

import { TIPO_TX } from '../constants/transacciones'

/**
 * Comisión real pagada (el `comision_monto` fijado en cada cobro — CLAUDE.md:
 * cambiar la comisión de un medio de pago no reescribe transacciones pasadas,
 * así que esto es lo que de verdad se pagó, no lo que costaría hoy).
 */
export const resumenComisiones = (transacciones) => {
  let volumenCobrado = 0
  let comisionPagada = 0
  for (const t of transacciones) {
    if (t.es_reversa || t.revertida || t.tipo !== TIPO_TX.COBRO) continue
    volumenCobrado += Number(t.monto) || 0
    comisionPagada += Number(t.comision_monto) || 0
  }
  return { volumenCobrado, comisionPagada, pctComision: volumenCobrado ? comisionPagada / volumenCobrado : 0 }
}

/**
 * Lo mismo pero por tipo de medio de pago — para poder decirle al owner
 * "empujá más transferencia, te está costando X% más que efectivo".
 * Requiere el join a medios_pago (ver lib/services/transacciones.js).
 */
export const comisionesPorTipoMedioPago = (transacciones) => {
  const porTipo = new Map()
  for (const t of transacciones) {
    if (t.es_reversa || t.revertida || t.tipo !== TIPO_TX.COBRO) continue
    const tipo = t.medios_pago?.tipo || 'sin_medio'
    if (!porTipo.has(tipo)) porTipo.set(tipo, { tipo, volumen: 0, comision: 0, movimientos: 0 })
    const acc = porTipo.get(tipo)
    acc.volumen += Number(t.monto) || 0
    acc.comision += Number(t.comision_monto) || 0
    acc.movimientos += 1
  }
  return Array.from(porTipo.values())
    .map((acc) => ({ ...acc, pctComision: acc.volumen ? acc.comision / acc.volumen : 0 }))
    .sort((a, b) => b.comision - a.comision)
}

/**
 * Matriz de actividad por día de semana (0=domingo..6=sábado) × hora local
 * (0-23). Usa la hora del navegador para leer `creado_en`, igual criterio
 * que lib/dates.js: quien mira esto está en Argentina.
 */
export const heatmapHoraDia = (transacciones) => {
  const celdas = new Map()
  for (const t of transacciones) {
    if (t.es_reversa || t.revertida || t.tipo !== TIPO_TX.COBRO) continue
    const fecha = new Date(t.creado_en)
    const dia = fecha.getDay()
    const hora = fecha.getHours()
    const key = `${dia}-${hora}`
    if (!celdas.has(key)) celdas.set(key, { dia, hora, movimientos: 0, volumen: 0 })
    const acc = celdas.get(key)
    acc.movimientos += 1
    acc.volumen += Number(t.monto) || 0
  }
  return Array.from(celdas.values()).map((c) => ({ ...c, ticketPromedio: c.movimientos ? c.volumen / c.movimientos : 0 }))
}

const inicioDeSemana = (fecha) => {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  const diff = (d.getDay() + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - diff)
  return d
}
const claveSemanal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Agrupa cobros y gastos por semana calendario (lunes a domingo, hora
 * local), ordenado cronológicamente. Base para la alerta de caída y la
 * comparación ventas-vs-gastos.
 */
export const serieSemanal = (transacciones) => {
  const porSemana = new Map()
  for (const t of transacciones) {
    if (t.es_reversa || t.revertida) continue
    const key = claveSemanal(inicioDeSemana(new Date(t.creado_en)))
    if (!porSemana.has(key)) porSemana.set(key, { semana: key, volumenCobrado: 0, volumenGastado: 0, movimientos: 0 })
    const acc = porSemana.get(key)
    const monto = Number(t.monto) || 0
    if (t.tipo === TIPO_TX.COBRO) acc.volumenCobrado += monto
    else if (t.tipo === TIPO_TX.GASTO) acc.volumenGastado += monto
    acc.movimientos += 1
  }
  return Array.from(porSemana.values()).sort((a, b) => a.semana.localeCompare(b.semana))
}

/**
 * Compara la última semana de la serie contra el promedio móvil de las
 * `semanasPromedio` previas. Devuelve `null` en vez de alertar con poca
 * historia (mejor no decir nada que inventar una caída con 2 semanas de
 * datos) — hace falta al menos 2 semanas de referencia además de la actual.
 */
export const alertaCaidaVentas = (serie, semanasPromedio = 8, umbralCaidaPct = 0.15) => {
  if (serie.length < 3) return null
  const actual = serie[serie.length - 1]
  const anteriores = serie.slice(Math.max(0, serie.length - 1 - semanasPromedio), serie.length - 1)
  if (anteriores.length < 2) return null
  const promedio = anteriores.reduce((s, w) => s + w.volumenCobrado, 0) / anteriores.length
  if (promedio <= 0) return null
  const variacionPct = (actual.volumenCobrado - promedio) / promedio
  return {
    semana: actual.semana,
    volumenActual: actual.volumenCobrado,
    promedioMovil: promedio,
    semanasDeReferencia: anteriores.length,
    variacionPct,
    caida: variacionPct <= -umbralCaidaPct,
  }
}

/**
 * Tasa de variación entre la primera y la última semana de la serie, para
 * ventas y gastos por separado. Si los gastos crecen más rápido que las
 * ventas el margen se achica aunque la caja "cierre bien" todos los días.
 * `null` si no hay al menos 2 semanas para comparar.
 */
export const crecimientoVentasVsGastos = (serie) => {
  if (serie.length < 2) return null
  const primera = serie[0]
  const ultima = serie[serie.length - 1]
  const crecVentas = primera.volumenCobrado ? (ultima.volumenCobrado - primera.volumenCobrado) / primera.volumenCobrado : null
  const crecGastos = primera.volumenGastado ? (ultima.volumenGastado - primera.volumenGastado) / primera.volumenGastado : null
  return {
    crecVentas,
    crecGastos,
    gastosCrecenMasRapido: crecVentas != null && crecGastos != null && crecGastos > crecVentas,
  }
}
