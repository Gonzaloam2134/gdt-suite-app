/**
 * Agregaciones para los reportes. Funciones puras: sin React, sin Supabase.
 *
 * Regla de este módulo: NO se inventan datos fiscales. Si una transacción no tiene
 * comprobante o alícuota cargada, se informa como tal en vez de asumir "Factura A, 21%".
 * El reporte anterior fabricaba tipo, punto de venta y número a partir del UUID, y eso
 * es lo que un contador termina cargando como si fuera real.
 */
import { esCobro, esGasto, esValida, comisionDe } from './transacciones'
import { aFechaISO } from '../dates'

const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v))
const redondear = (v) => Math.round(v * 100) / 100

/** Ventas y compras agrupadas por alícuota, como las pide el libro IVA. */
export const agruparPorAlicuota = (filas) => {
  const mapa = new Map()
  for (const f of filas) {
    const alicuota = num(f.alicuota)
    const actual = mapa.get(alicuota) || { alicuota, neto: 0, iva: 0, total: 0, cantidad: 0 }
    actual.neto += num(f.neto)
    actual.iva += num(f.iva)
    actual.total += num(f.total)
    actual.cantidad += 1
    mapa.set(alicuota, actual)
  }
  return [...mapa.values()]
    .map(a => ({ ...a, neto: redondear(a.neto), iva: redondear(a.iva), total: redondear(a.total) }))
    .sort((a, b) => b.alicuota - a.alicuota)
}

/** Cobros agrupados por medio de pago, con comisión y neto acreditado. */
export const agruparPorMedio = (transacciones) => {
  const mapa = new Map()
  for (const t of transacciones) {
    if (!esValida(t) || !esCobro(t)) continue
    const nombre = t.medios_pago?.nombre || 'Sin medio'
    const actual = mapa.get(nombre) || { nombre, tipo: t.medios_pago?.tipo || 'otro', total: 0, comisiones: 0, cantidad: 0 }
    actual.total += num(t.monto)
    actual.comisiones += comisionDe(t)
    actual.cantidad += 1
    mapa.set(nombre, actual)
  }
  return [...mapa.values()]
    .map(m => ({ ...m, total: redondear(m.total), comisiones: redondear(m.comisiones), neto: redondear(m.total - m.comisiones) }))
    .sort((a, b) => b.total - a.total)
}

/** Movimientos por día: sirve para el libro caja y para ver estacionalidad. */
export const agruparPorDia = (transacciones) => {
  const mapa = new Map()
  for (const t of transacciones) {
    if (!esValida(t)) continue
    const dia = aFechaISO(new Date(t.creado_en))
    const actual = mapa.get(dia) || { fecha: dia, ventas: 0, gastos: 0, cantidad: 0 }
    if (esCobro(t)) actual.ventas += num(t.monto)
    else if (esGasto(t)) actual.gastos += num(t.monto)
    actual.cantidad += 1
    mapa.set(dia, actual)
  }
  return [...mapa.values()]
    .map(d => ({ ...d, ventas: redondear(d.ventas), gastos: redondear(d.gastos), resultado: redondear(d.ventas - d.gastos) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/**
 * Qué tan confiable es este reporte. Va arriba de todo: si el contador no sabe
 * qué le falta al dato, lo toma como completo.
 */
export const evaluarCalidad = (transacciones) => {
  const validas = transacciones.filter(esValida)
  const cobros = validas.filter(esCobro)
  const sinComprobante = validas.filter(t => !t.tipo_comprobante || t.tipo_comprobante === 'SIN_COMPROBANTE').length
  const sinNumero = validas.filter(t => t.tipo_comprobante && t.tipo_comprobante !== 'SIN_COMPROBANTE' && !t.nro_comprobante).length
  const anuladas = transacciones.filter(t => t.revertida).length
  const sinAlicuota = validas.filter(t => t.alicuota_iva === null || t.alicuota_iva === undefined).length

  const avisos = []
  if (validas.length === 0) avisos.push({ nivel: 'info', texto: 'No hay movimientos en el período seleccionado.' })
  if (sinComprobante > 0) {
    const pct = Math.round((sinComprobante / validas.length) * 100)
    avisos.push({
      nivel: pct > 50 ? 'alto' : 'medio',
      texto: `${sinComprobante} de ${validas.length} movimientos (${pct}%) no tienen comprobante asociado.`,
    })
  }
  if (sinNumero > 0) avisos.push({ nivel: 'medio', texto: `${sinNumero} comprobantes no tienen número cargado.` })
  if (sinAlicuota > 0) avisos.push({ nivel: 'medio', texto: `${sinAlicuota} movimientos no tienen alícuota de IVA definida.` })
  if (anuladas > 0) avisos.push({ nivel: 'info', texto: `${anuladas} movimientos fueron anulados y quedan excluidos de los totales.` })

  return { total: validas.length, cobros: cobros.length, sinComprobante, sinNumero, sinAlicuota, anuladas, avisos }
}

/** Conciliación de los cierres de caja del período: esperado vs contado. */
export const conciliarCierres = (cierres) => {
  const conDiferencia = cierres.filter(c => c.diferencia_efectivo !== null && c.diferencia_efectivo !== undefined)
  const totalDiferencia = conDiferencia.reduce((s, c) => s + num(c.diferencia_efectivo), 0)
  const faltantes = conDiferencia.filter(c => num(c.diferencia_efectivo) < 0)
  const sobrantes = conDiferencia.filter(c => num(c.diferencia_efectivo) > 0)

  return {
    cierres: cierres.length,
    sinContar: cierres.length - conDiferencia.length,
    totalDiferencia: redondear(totalDiferencia),
    diasFaltante: faltantes.length,
    diasSobrante: sobrantes.length,
    cuadrados: conDiferencia.length - faltantes.length - sobrantes.length,
    peorFaltante: faltantes.length ? redondear(Math.min(...faltantes.map(c => num(c.diferencia_efectivo)))) : 0,
  }
}
