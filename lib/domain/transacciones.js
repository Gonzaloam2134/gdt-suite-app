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
 * Una transacción SUMA si no es una reversa y no fue revertida.
 * Las anuladas se siguen mostrando en la caja (marcadas), pero no cuentan.
 */
export const esValida = (t) => !t.es_reversa && !t.revertida

/** El asiento inverso: plomería contable, no se muestra como movimiento propio. */
export const esAsientoInverso = (t) => !!t.es_reversa

/** La original que fue anulada: se muestra tachada, no suma. */
export const estaAnulada = (t) => !!t.revertida

export const esCobro = (t) => t.tipo === TIPO_TX.COBRO
export const esGasto = (t) => t.tipo === TIPO_TX.GASTO

/**
 * Comisión efectiva: la guardada en DB, o calculada desde el medio si la fila
 * es vieja y no tiene el dato guardado.
 *
 * El chequeo es "¿hay algo guardado?" (`!= null`), NO "¿es mayor a cero?".
 * Un cobro con 0% de comisión en su momento (Efectivo, Transferencia, o
 * cualquier medio que después se le sube el % desde el panel) guarda
 * `comision_monto: 0` — eso es un dato real, no "falta el dato". Si acá se
 * tratara igual que "no hay nada guardado", esa venta empezaría a mostrar
 * comisión retroactivamente apenas alguien editara el % del medio en
 * EditarMedioPagoModal, contradiciendo la garantía de que "los cobros ya
 * registrados no cambian" — que es justo lo que ese modal le promete al usuario.
 */
export const comisionDe = (t) => {
  if (t.comision_monto !== null && t.comision_monto !== undefined) return num(t.comision_monto)
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
 *
 * OJO con `totales.pendienteAcreditacion`: es "todavía no acreditó, relativo a
 * `diaISO`" — NO "relativo a hoy". Si `diaISO` es el día real de hoy (el uso
 * normal, dashboard), da lo mismo. Pero esta función también se reusa para
 * calcular los totales de una caja "huérfana" de un día viejo (ver
 * `hooks/useCaja.js#cerrarHuerfana`), y ahí `diaISO` NO es hoy: el número que
 * sale acá es "cuánto de las ventas de ESE día seguía sin acreditar EL MISMO
 * día", no "cuánto sigue pendiente HOY". Para esa segunda pregunta (la que
 * responde `calcularResumenPeriodo`) hay que comparar contra la fecha real
 * actual, no contra `diaISO` — son cálculos distintos aunque compartan nombre.
 * Hoy nadie muestra este campo para una caja huérfana (el modal de cierre no
 * lo usa), pero si en el futuro alguien lo agrega, que no asuma que significa
 * "pendiente a día de hoy".
 */
export const calcularTotalesDia = (transacciones, diaISO) => {
  const totales = {
    cobros: 0,
    gastos: 0,
    efectivoEnCaja: 0,
    disponibleHoy: 0,       // se completa aparte con calcularAcreditacionesDia: ver nota abajo
    pendienteAcreditacion: 0,
    comisiones: 0,
    netoReal: 0,
  }
  const porMedio = {}
  const cobros = []
  const gastos = []

  for (const t of transacciones) {
    if (esAsientoInverso(t)) continue          // el contrasiento no se lista
    const monto = num(t.monto)
    const medio = t.medios_pago || {}

    // Las anuladas se listan marcadas pero no entran en ningún total
    if (estaAnulada(t)) {
      const fila = { ...t, anulada: true, comision: 0, neto: 0 }
      if (esGasto(t)) gastos.push(fila)
      else if (esCobro(t)) cobros.push(fila)
      continue
    }

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
    } else if (acreditaISO !== diaISO) {
      // Si acredita en diaISO no es "pendiente": es "disponible" (ver
      // calcularAcreditacionesDia). "Pendiente" acá es relativo a diaISO, NO a
      // hoy real — ver la nota grande en el JSDoc de la función.
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
    acreditacionesHoy: [],   // lo completa calcularAcreditacionesDia
    desgloseMedios: Object.values(porMedio)
      .map(m => ({ ...m, total: redondear(m.total), comisiones: redondear(m.comisiones) }))
      .sort((a, b) => b.total - a.total),
  }
}

/**
 * "Disponible hoy" y "Acreditaciones del día" (KPI de caja): cobros no-efectivo
 * cuya FECHA DE ACREDITACIÓN cae en el día que se está mirando, sin importar
 * cuándo se generó la venta.
 *
 * Bug que corrige esto: `calcularTotalesDia` solo procesa las transacciones
 * CREADAS hoy, así que una venta con tarjeta de crédito de hace 2 días que recién
 * acredita hoy nunca aparecía en "Disponible" — la tarjeta mostraba $0 aunque
 * esa plata sí entrara ese día. Por eso `transacciones` acá viene de una consulta
 * aparte (`listarAcreditacionesDia`), filtrada por fecha de acreditación en la
 * base, no por fecha de creación.
 *
 * @param {Array} transacciones  cobros (de cualquier fecha de creación) cuya
 *                                fecha_acreditacion_estimada es el día consultado
 */
export const calcularAcreditacionesDia = (transacciones) => {
  const acreditaciones = transacciones
    .filter(t => esValida(t) && esCobro(t) && !esEfectivo(t.medios_pago || {}))
    .map(t => {
      const comision = comisionDe(t)
      return { ...t, comision, neto: redondear(num(t.monto) - comision) }
    })
    .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))

  return {
    disponibleHoy: redondear(acreditaciones.reduce((s, a) => s + a.neto, 0)),
    acreditacionesHoy: acreditaciones,
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
