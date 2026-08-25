import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

/**
 * Registra una acción. No lanza: un fallo de auditoría no debe romper la operación principal.
 * user_id lo exige la RLS (logs_insert: user_id = auth.uid()).
 */
export const registrarAccion = async ({ localId, userId, accion, detalles = {}, tabla = null, registroId = null }) => {
  const { error } = await supabase.from('logs_auditoria').insert([{
    local_id: localId, user_id: userId, accion, detalles,
    tabla_afectada: tabla, registro_id: registroId,
  }])
  if (error) console.error('[auditoria] no se pudo registrar', accion, error.message)
}

export const listarLogs = ({ localId, inicio, fin, userId = null, limite = 50 }) => {
  let q = supabase.from('logs_auditoria').select('*').eq('local_id', localId)
    .order('creado_en', { ascending: false }).limit(limite)
  if (inicio) q = q.gte('creado_en', inicio)
  if (fin) q = q.lte('creado_en', fin)
  if (userId) q = q.eq('user_id', userId)
  return q.then(unwrap)
}
