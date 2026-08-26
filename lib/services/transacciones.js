import { supabase } from '../supabaseClient'
import { unwrap } from './_base'
import { rangoDia, rangoEntre } from '../dates'
import { calcularIva, calcularComision, fechaAcreditacion } from '../domain/transacciones'
import { TIPO_TX } from '../constants/transacciones'

const JOIN_MEDIO = 'medios_pago (nombre, tipo, icono, comision_porcentaje, plazo_acreditacion_dias)'

export const listarTransaccionesDia = (localId, diaISO) => {
  const { inicio, fin } = rangoDia(diaISO)
  return supabase.from('transacciones').select(`*, ${JOIN_MEDIO}`)
    .eq('local_id', localId).gte('creado_en', inicio).lte('creado_en', fin)
    .order('creado_en', { ascending: false }).then(unwrap)
}

export const listarTransaccionesPeriodo = (localIds, desdeISO, hastaISO) => {
  const { inicio, fin } = rangoEntre(desdeISO, hastaISO)
  return supabase.from('transacciones').select(`*, ${JOIN_MEDIO}`)
    .in('local_id', localIds).gte('creado_en', inicio).lte('creado_en', fin)
    .order('creado_en', { ascending: false }).then(unwrap)
}

export const contarTransacciones = (localId = null) => {
  let q = supabase.from('transacciones').select('*', { count: 'exact', head: true })
  if (localId) q = q.eq('local_id', localId)
  return q.then(r => r.count ?? 0)
}

/**
 * Registra un cobro. Calcula y persiste IVA, comisión y fecha de acreditación,
 * así los reportes leen lo guardado en vez de recalcular.
 * @param {object} medio  fila de medios_pago (comision_porcentaje, plazo_acreditacion_dias)
 */
export const registrarCobro = ({ localId, medio, monto, descripcion, alicuota = 21, tipoComprobante = null, puntoVenta = null, nroComprobante = null }) => {
  const ahora = new Date()
  const { neto, iva } = calcularIva(monto, alicuota)
  return supabase.from('transacciones').insert([{
    local_id: localId,
    tipo: TIPO_TX.COBRO,
    medio_pago_id: medio.id,
    monto, monto_neto: neto, monto_iva: iva, alicuota_iva: alicuota,
    comision_monto: calcularComision(monto, medio.comision_porcentaje),
    fecha_acreditacion_estimada: fechaAcreditacion(ahora, medio.plazo_acreditacion_dias).toISOString().slice(0, 10),
    tipo_comprobante: tipoComprobante, punto_venta: puntoVenta, nro_comprobante: nroComprobante,
    descripcion: descripcion || 'Cobro',
    creado_en: ahora.toISOString(),
    es_reversa: false,
  }]).select().single().then(unwrap)
}

export const registrarGasto = ({ localId, medio, monto, descripcion, alicuota = 21, tipoComprobante = null, categoria = null }) => {
  const { neto, iva } = calcularIva(monto, alicuota)
  return supabase.from('transacciones').insert([{
    local_id: localId,
    tipo: TIPO_TX.GASTO,
    medio_pago_id: medio?.id ?? null,
    monto, monto_neto: neto, monto_iva: iva, alicuota_iva: alicuota,
    tipo_comprobante: tipoComprobante, categoria,
    descripcion: descripcion || 'Gasto',
    creado_en: new Date().toISOString(),
    es_reversa: false,
  }]).select().single().then(unwrap)
}

/** La original queda marcada `revertida` por el trigger trg_marcar_revertida. */
export const registrarReversa = (original, motivo) =>
  supabase.from('transacciones').insert([{
    local_id: original.local_id,
    tipo: original.tipo,
    medio_pago_id: original.medio_pago_id,
    monto: -Number(original.monto || 0),
    monto_neto: -Number(original.monto_neto || 0),
    monto_iva: -Number(original.monto_iva || 0),
    alicuota_iva: original.alicuota_iva,
    comision_monto: -Number(original.comision_monto || 0),
    descripcion: `[REVERSA] ${original.descripcion || 'Transacción'}`,
    es_reversa: true,
    reversa_de: original.id,
    motivo_reversa: motivo.trim(),
  }]).select().single().then(unwrap)

/** Totales del día por local, para el resumen de la pantalla de inicio. */
export const resumenHoyPorLocal = async (localIds) => {
  if (!localIds?.length) return {}
  const { inicio, fin } = rangoDia()
  const filas = await supabase.from('transacciones')
    .select('local_id, tipo, monto, es_reversa, revertida')
    .in('local_id', localIds).gte('creado_en', inicio).lte('creado_en', fin)
    .then(unwrap)

  const porLocal = {}
  for (const id of localIds) porLocal[id] = { ventas: 0, gastos: 0, movimientos: 0 }
  for (const t of filas) {
    if (t.es_reversa || t.revertida) continue
    const acc = porLocal[t.local_id]
    if (!acc) continue
    if (t.tipo === TIPO_TX.COBRO) acc.ventas += Number(t.monto) || 0
    else if (t.tipo === TIPO_TX.GASTO) acc.gastos += Number(t.monto) || 0
    acc.movimientos += 1
  }
  return porLocal
}
