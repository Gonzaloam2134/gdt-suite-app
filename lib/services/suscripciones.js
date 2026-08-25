import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

export const getSuscripcion = (localId) =>
  supabase.from('suscripciones').select('*').eq('local_id', localId).maybeSingle().then(unwrap)

export const crearSuscripcionFree = (localId) =>
  supabase.from('suscripciones').insert([{
    local_id: localId, plan: 'free', estado: 'active',
    fecha_vencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }]).then(unwrap)

export const listarSuscripciones = () =>
  supabase.from('suscripciones').select('*, locales (id, nombre, rubro)')
    .order('fecha_vencimiento', { ascending: true }).then(unwrap)

export const cambiarEstadoSuscripcion = (localId, estado) =>
  supabase.from('suscripciones').update({ estado, actualizado_en: new Date().toISOString() })
    .eq('local_id', localId).then(unwrap)
