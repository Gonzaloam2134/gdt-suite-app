import { supabase } from '../supabaseClient'
import { unwrap } from './_base'
import { rangoDia } from '../dates'

/**
 * Cualquier caja abierta del local, sin filtrar por fecha. Antes esto filtraba
 * por `fecha_apertura` de HOY: una caja abierta un viernes y nunca cerrada
 * quedaba invisible para toda la app (no aparecía acá, y `listarCierres`
 * filtra `estado='cerrada'`, así que tampoco aparecía en el historial), aunque
 * siguiera bloqueando la apertura de la de hoy por el índice único de "una
 * sola caja abierta por local".
 */
export const getCajaAbiertaLocal = (localId) =>
  supabase.from('cierres_caja').select('*')
    .eq('local_id', localId).eq('estado', 'abierta')
    .order('fecha_apertura', { ascending: false })
    .limit(1).maybeSingle().then(unwrap)

export const abrirCaja = ({ localId, userId, montoInicial }) =>
  supabase.from('cierres_caja').insert([{
    local_id: localId, user_id: userId, monto_inicial_efectivo: montoInicial,
    estado: 'abierta', fecha_apertura: new Date().toISOString(),
  }]).select().single().then(unwrap)

export const cerrarCaja = (cajaId, { totalCobrado, totalGastado, cantidadTransacciones, efectivoFisico, diferencia, observaciones }) =>
  supabase.from('cierres_caja').update({
    estado: 'cerrada', fecha_cierre: new Date().toISOString(),
    total_cobrado: totalCobrado, total_gastado: totalGastado,
    cantidad_transacciones: cantidadTransacciones,
    efectivo_fisico: efectivoFisico, diferencia_efectivo: diferencia,
    observaciones: observaciones || null,
  }).eq('id', cajaId).then(unwrap)

/**
 * Corrige el monto inicial de una caja YA ABIERTA (típicamente un error de
 * tipeo al abrir). Solo tiene sentido mientras sigue abierta: una vez cerrada,
 * el cierre ya quedó calculado y conciliado contra el monto original.
 */
export const corregirMontoInicial = (cajaId, nuevoMonto) =>
  supabase.from('cierres_caja').update({ monto_inicial_efectivo: nuevoMonto }).eq('id', cajaId).then(unwrap)

export const listarCierres = (localIds, { inicio = null, fin = null, limite = 50 } = {}) => {
  let q = supabase.from('cierres_caja').select('*').in('local_id', [].concat(localIds))
    .eq('estado', 'cerrada').order('fecha_cierre', { ascending: false }).limit(limite)
  if (inicio) q = q.gte('fecha_cierre', inicio)
  if (fin) q = q.lte('fecha_cierre', fin)
  return q.then(unwrap)
}

/** Qué locales tienen la caja abierta hoy, para el resumen de inicio. */
export const cajasAbiertasHoy = async (localIds) => {
  if (!localIds?.length) return new Set()
  const { inicio, fin } = rangoDia()
  const filas = await supabase.from('cierres_caja').select('local_id')
    .in('local_id', localIds).eq('estado', 'abierta')
    .gte('fecha_apertura', inicio).lte('fecha_apertura', fin)
    .then(unwrap)
  return new Set(filas.map(f => f.local_id))
}
