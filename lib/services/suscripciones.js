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

/**
 * Para el panel de super admin: cada suscripción con el nombre del local y el
 * email del owner. Sin `!inner` en miembros_locales: si algún local se quedó sin
 * owner (removido, migración vieja), la suscripción igual tiene que aparecer en
 * la lista de cobros en vez de desaparecer silenciosamente.
 */
export const listarSuscripcionesConOwner = (limite = 200) =>
  supabase.from('suscripciones')
    .select('*, locales (nombre, rubro), miembros_locales (user_id, rol, perfiles (email, nombre))')
    .order('fecha_vencimiento', { ascending: true })
    .limit(limite)
    .then(unwrap)
    .then(subs => subs.map(sub => {
      const owner = sub.miembros_locales?.find(m => m.rol === 'owner')
      return { ...sub, ownerEmail: owner?.perfiles?.email || 'Sin email' }
    }))

export const cambiarEstadoSuscripcion = (localId, estado) =>
  supabase.from('suscripciones').update({ estado, actualizado_en: new Date().toISOString() })
    .eq('local_id', localId).then(unwrap)
