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

const DIAS_VIGENCIA = 7

/** Crea la invitación y devuelve la fila (incluye el token para armar el link). */
export const crearInvitacion = ({ localId, email, nombre, rol, invitadoPor }) =>
  supabase.from('invitaciones').insert([{
    local_id: localId,
    email_invitado: email.trim().toLowerCase(),
    nombre_invitado: nombre?.trim() || null,
    rol, invitado_por: invitadoPor,
    token: crypto.randomUUID(), estado: 'pendiente',
    expira_en: new Date(Date.now() + DIAS_VIGENCIA * 24 * 60 * 60 * 1000).toISOString(),
  }]).select().single().then(unwrap)

export const listarInvitaciones = (localId) =>
  supabase.from('invitaciones').select('*').eq('local_id', localId)
    .order('creado_en', { ascending: false }).then(unwrap)

/** Renueva el token y la vigencia: el link viejo deja de servir. */
export const renovarInvitacion = (id) =>
  supabase.from('invitaciones').update({
    token: crypto.randomUUID(), estado: 'pendiente',
    expira_en: new Date(Date.now() + DIAS_VIGENCIA * 24 * 60 * 60 * 1000).toISOString(),
  }).eq('id', id).select().single().then(unwrap)

export const revocarInvitacion = (id) =>
  supabase.from('invitaciones').update({ estado: 'rechazada' }).eq('id', id).then(unwrap)

/** Datos mínimos de la invitación, sin necesidad de estar logueado. */
export const verInvitacion = (token) =>
  supabase.rpc('ver_invitacion', { p_token: token }).then(unwrap).then(filas => filas?.[0] ?? null)

/** Crea la membresía para el usuario logueado. Devuelve { ok, local_id, rol } o { ok:false, error }. */
export const aceptarInvitacion = (token) =>
  supabase.rpc('aceptar_invitacion', { p_token: token }).then(unwrap)

/** Reactiva a alguien que había sido quitado del local. */
export const reactivarMiembro = (miembroId) =>
  supabase.from('miembros_locales').update({ activo: true }).eq('id', miembroId).then(unwrap)

/** Miembros inactivos: los que fueron quitados y se pueden reincorporar. */
export const listarMiembrosInactivos = async (localId) => {
  const miembros = await supabase.from('miembros_locales').select('*')
    .eq('local_id', localId).eq('activo', false).then(unwrap)
  if (!miembros?.length) return []
  const perfiles = await getPerfiles(miembros.map(m => m.user_id))
  return miembros.map(m => ({ ...m, perfil: perfiles.find(p => p.id === m.user_id) || null }))
}

/**
 * Rol que la persona ya tiene en otro local, si existe.
 * Una persona tiene el mismo rol en todos sus locales, así que conviene avisarlo
 * antes de invitar en vez de que falle después.
 */
export const rolExistenteDe = (email) =>
  supabase.rpc('rol_existente_de', { p_email: email }).then(unwrap)

/** URL que se copia y se manda por WhatsApp. */
export const linkInvitacion = (token) =>
  typeof window === 'undefined' ? '' : `${window.location.origin}/invitacion?token=${token}`
