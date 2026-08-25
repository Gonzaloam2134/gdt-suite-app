import { supabase } from '../supabaseClient'
import { unwrap } from './_base'
import { getPerfiles } from './auth'

export const getMembresias = (userId) =>
  supabase.from('miembros_locales').select('local_id, rol').eq('user_id', userId).eq('activo', true).then(unwrap)

export const getRolEnLocal = async (userId, localId) => {
  const data = await supabase.from('miembros_locales').select('rol')
    .eq('local_id', localId).eq('user_id', userId).eq('activo', true).maybeSingle().then(unwrap)
  return data?.rol ?? null
}

/** Miembros activos del local con su perfil embebido */
export const listarMiembros = async (localId) => {
  const miembros = await supabase.from('miembros_locales').select('*')
    .eq('local_id', localId).eq('activo', true).then(unwrap)
  if (!miembros?.length) return []
  const perfiles = await getPerfiles(miembros.map(m => m.user_id))
  return miembros.map(m => ({ ...m, perfil: perfiles.find(p => p.id === m.user_id) || null }))
}

export const agregarOwner = (localId, userId) =>
  supabase.from('miembros_locales').insert([{
    local_id: localId, user_id: userId, rol: 'owner', activo: true, aceptado_en: new Date().toISOString(),
  }]).then(unwrap)

/** Cambia SOLO el rol por local. Nunca toca perfiles.rol_global. */
export const cambiarRol = (miembroId, rol) =>
  supabase.from('miembros_locales').update({ rol }).eq('id', miembroId).then(unwrap)

export const quitarMiembro = (miembroId) =>
  supabase.from('miembros_locales').update({ activo: false }).eq('id', miembroId).then(unwrap)

/** OJO: la tabla invitaciones no tiene columna nombre_invitado (admin.jsx la mandaba y el insert fallaba). */
export const crearInvitacion = ({ localId, email, rol, invitadoPor }) =>
  supabase.from('invitaciones').insert([{
    local_id: localId, email_invitado: email.trim().toLowerCase(), rol, invitado_por: invitadoPor,
    token: crypto.randomUUID(), estado: 'pendiente',
    expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }]).then(unwrap)

export const listarInvitaciones = (localId) =>
  supabase.from('invitaciones').select('*').eq('local_id', localId)
    .order('creado_en', { ascending: false }).then(unwrap)
