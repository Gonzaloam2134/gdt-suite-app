/**
 * Lógica de negocio pura sobre transacciones.
 * Sin React, sin Supabase. Todo lo que está acá se puede testear con datos en memoria.
 */
import { TIPO_TX } from '../constants/transacciones'
import { esEfectivo } from '../constants/mediosPago'
import { aFechaISO, sumarDias } from '../dates'

const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v))
const redondear = (v) => Math.round(v * 100) / 100

// ---------------------------------------------------------------------------
// Cálculos unitarios
// ---------------------------------------------------------------------------

/** Comisión del medio de pago sobre un monto bruto */
export const calcularComision = (monto, comisionPorcentaje) =>
  redondear(num(monto) * num(comisionPorcentaje) / 100)

/**
 * Descompone un monto BRUTO (IVA incluido) en neto + IVA según la alícuota.
 * calcularIva(1210, 21) → { neto: 1000, iva: 210 }
 */
export const calcularIva = (montoBruto, alicuota = 21) => {
  const bruto = num(montoBruto)
  const factor = 1 + num(alicuota) / 100
  const neto = redondear(bruto / factor)
  return { neto, iva: redondear(bruto - neto) }
}

/** Fecha estimada en que el dinero se acredita: creado_en + plazo del medio */
export const fechaAcreditacion = (creadoEn, plazoDias = 0) =>
  sumarDias(new Date(creadoEn), num(plazoDias))

/**
 * Una transacción "cuenta" si no es una reversa y no fue revertida.
 * (Antes se filtraba solo es_reversa y las anuladas seguían sumando.)
 */
export const esValida = (t) => !t.es_reversa && !t.revertida

export const esCobro = (t) => t.tipo === TIPO_TX.COBRO
export const esGasto = (t) => t.tipo === TIPO_TX.GASTO

/** Comisión efectiva: la guardada en DB, o calculada desde el medio si es 0/null */
export const comisionDe = (t) => {
  const guardada = num(t.comision_monto)
  if (guardada > 0) return guardada
  return calcularComision(t.monto, t.medios_pago?.comision_porcentaje)
}

/** Fecha de acreditación efectiva: la guardada en DB, o calculada desde el medio */
export const fechaAcreditacionDe = (t) => {
  if (t.fecha_acreditacion_estimada) return new Date(t.fecha_acreditacion_estimada)
  return fechaAcreditacion(t.creado_en, t.medios_pago?.plazo_acreditacion_dias)
}

// ---------------------------------------------------------------------------
// Totales del día (dashboard / caja)
// ---------------------------------------------------------------------------

/**
 * @param {Array} transacciones  filas de `transacciones` con join `medios_pago(nombre,tipo,comision_porcentaje,plazo_acreditacion_dias)`
 *                               ya filtradas al rango del día por la query
 * @param {string} diaISO        'YYYY-MM-DD' del día que se está mirando (hora local)
 */
export const calcularTotalesDia = (transacciones, diaISO) => {
  const totales = {
    cobros: 0,
    gastos: 0,
    efectivoEnCaja: 0,
    disponibleHoy: 0,       // cobros no-efectivo que se acreditan hoy, neto de comisión
    pendienteAcreditacion: 0,
    comisiones: 0,
    netoReal: 0,
  }
  const porMedio = {}
  const acreditacionesHoy = []
  const cobros = []
  const gastos = []

  for (const t of transacciones) {
    if (!esValida(t)) continue
    const monto = num(t.monto)
    const medio = t.medios_pago || {}

    if (esGasto(t)) {
      totales.gastos += monto
      gastos.push(t)
      continue
    }
    if (!esCobro(t)) continue

    const comision = comisionDe(t)
    const neto = monto - comision
    const acreditaISO = aFechaISO(fechaAcreditacionDe(t))

    totales.cobros += monto
    totales.comisiones += comision
    cobros.push({ ...t, comision, neto })

    if (esEfectivo(medio)) {
      totales.efectivoEnCaja += monto
    } else if (acreditaISO === diaISO) {
      totales.disponibleHoy += neto
      acreditacionesHoy.push({ ...t, comision, neto })
    } else {
      totales.pendienteAcreditacion += neto
    }

    const key = medio.nombre || 'Sin medio'
    porMedio[key] ??= { nombre: key, tipo: medio.tipo || 'otro', total: 0, cantidad: 0, comisiones: 0 }
    porMedio[key].total += monto
    porMedio[key].cantidad += 1
    porMedio[key].comisiones += comision
  }

  totales.netoReal = totales.cobros - totales.comisiones - totales.gastos
  for (const k of Object.keys(totales)) totales[k] = redondear(totales[k])

  return {
    totales,
    cobros,
    gastos,
    acreditacionesHoy: acreditacionesHoy.sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en)),
    desgloseMedios: Object.values(porMedio)
      .map(m => ({ ...m, total: redondear(m.total), comisiones: redondear(m.comisiones) }))
      .sort((a, b) => b.total - a.total),
  }
}

/** Efectivo que debería haber al cerrar: monto inicial + cobros en efectivo del día */
export const efectivoEsperado = (montoInicial, totales) =>
  redondear(num(montoInicial) + num(totales?.efectivoEnCaja))

// ---------------------------------------------------------------------------
// Resumen de período (reportes)
// ---------------------------------------------------------------------------

/**
 * Lee monto_iva / monto_neto / alicuota_iva guardados en la transacción.
 * Si la fila es vieja y no los tiene, los deriva de la alícuota (default 21).
 */
const descomponer = (t) => {
  const monto = num(t.monto)
  if (num(t.monto_neto) > 0 || num(t.monto_iva) > 0) {
    return { neto: num(t.monto_neto), iva: num(t.monto_iva) }
  }
  return calcularIva(monto, t.alicuota_iva ?? 21)
}

/**
 * @param {Array}  transacciones  rango completo del período, con join medios_pago(nombre,tipo,comision_porcentaje)
 * @param {object} opts
 * @param {boolean} opts.discriminaIva  false para Monotributo/Exento: no separa IVA
 */
export const calcularResumenPeriodo = (transacciones, { discriminaIva = true } = {}) => {
  const r = {
    totalFacturado: 0, ivaDebitoFiscal: 0, netoGravado: 0, comisiones: 0,
    ingresoNetoReal: 0, gastosOperativos: 0, ivaCreditoFiscal: 0,
    resultadoEjercicio: 0, ivaAPagar: 0, cantidadVentas: 0, cantidadGastos: 0,
    pendienteAcreditacion: 0,
  }
  const libroVentas = []
  const libroCompras = []
  const hoyISO = aFechaISO(new Date())

  for (const t of transacciones) {
    if (!esValida(t)) continue
    const monto = num(t.monto)
    const medio = t.medios_pago || {}
    const { neto, iva } = discriminaIva ? descomponer(t) : { neto: monto, iva: 0 }
    const fila = {
      id: t.id,
      fecha: t.creado_en,
      tipo: t.tipo_comprobante || 'SIN_COMPROBANTE',
      punto_venta: t.punto_venta ?? null,
      numero: t.nro_comprobante ?? null,
      alicuota: t.alicuota_iva ?? (discriminaIva ? 21 : 0),
      descripcion: t.descripcion || '',
      total: monto, iva, neto,
    }

    if (esCobro(t)) {
      const comision = comisionDe(t)
      r.totalFacturado += monto
      r.ivaDebitoFiscal += iva
      r.netoGravado += neto
      r.comisiones += comision
      r.cantidadVentas += 1
      if (!esEfectivo(medio) && aFechaISO(fechaAcreditacionDe(t)) > hoyISO) {
        r.pendienteAcreditacion += monto - comision
      }
      libroVentas.push({ ...fila, medio: medio.nombre || '-', comision })
    } else if (esGasto(t)) {
      r.gastosOperativos += monto
      r.ivaCreditoFiscal += iva
      r.cantidadGastos += 1
      libroCompras.push({ ...fila, proveedor: t.descripcion || 'Proveedor' })
    }
  }

  r.ingresoNetoReal = r.totalFacturado - r.comisiones
  r.resultadoEjercicio = r.ingresoNetoReal - r.gastosOperativos
  r.ivaAPagar = r.ivaDebitoFiscal - r.ivaCreditoFiscal
  for (const k of Object.keys(r)) r[k] = redondear(r[k])

  const porFecha = (a, b) => new Date(b.fecha) - new Date(a.fecha)
  return {
    resumen: r,
    libroVentas: libroVentas.sort(porFecha),
    libroCompras: libroCompras.sort(porFecha),
  }
}
