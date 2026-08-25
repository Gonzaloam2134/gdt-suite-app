import { supabase } from '../supabaseClient'
import { unwrap } from './_base'
import { rangoDia } from '../dates'

export const getCajaAbiertaHoy = (localId) => {
  const { inicio, fin } = rangoDia()
  return supabase.from('cierres_caja').select('*')
    .eq('local_id', localId).eq('estado', 'abierta')
    .gte('fecha_apertura', inicio).lte('fecha_apertura', fin)
    .maybeSingle().then(unwrap)
}

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

export const listarCierres = (localIds, { inicio = null, fin = null, limite = 50 } = {}) => {
  let q = supabase.from('cierres_caja').select('*').in('local_id', [].concat(localIds))
    .eq('estado', 'cerrada').order('fecha_cierre', { ascending: false }).limit(limite)
  if (inicio) q = q.gte('fecha_cierre', inicio)
  if (fin) q = q.lte('fecha_cierre', fin)
  return q.then(unwrap)
}
