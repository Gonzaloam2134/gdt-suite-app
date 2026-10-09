import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export const getUser = async () => (await getSession())?.user ?? null

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email: email.trim(), password }).then(unwrap)

export const signOut = () => supabase.auth.signOut()

export const getPerfil = (userId) =>
  supabase.from('perfiles').select('id, email, nombre, rol_global, bienvenida_vista_en, terminos_version').eq('id', userId).maybeSingle().then(unwrap)

/** Solo lo necesario para el guard de términos — se consulta en cada página protegida. */
export const getTerminosVersion = (userId) =>
  supabase.from('perfiles').select('terminos_version').eq('id', userId).maybeSingle().then(unwrap)

/**
 * Sobreescribe la última aceptación — no se guarda historial de versiones
 * previas. Pasa por una API route con Service Role en vez de escribir
 * directo con el cliente anon: RLS no deja que un usuario actualice su
 * propia fila de `perfiles` desde el navegador, y ese `update()` fallaba en
 * silencio (0 filas afectadas, sin error) en vez de avisar. `userId` y
 * `version` se mantienen en la firma por compatibilidad con los llamadores
 * existentes, pero el servidor resuelve ambos de forma autoritativa — nunca
 * confía en lo que mande el cliente.
 */
export const aceptarTerminos = async (_userId, _version) => {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/aceptar-terminos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'No se pudo registrar la aceptación de los Términos')
  return data
}

export const getPerfiles = (ids) =>
  supabase.from('perfiles').select('id, email, nombre, rol_global').in('id', ids).then(unwrap)

/**
 * Marca que ya vio el mensaje de bienvenida — vive en la cuenta, no en el
 * dispositivo, para que no vuelva a aparecer si entra desde otro celular.
 * Pasa por una API route con Service Role en vez de escribir directo con el
 * cliente anon: mismo motivo que `aceptarTerminos` — RLS bloqueaba ese
 * `update()` en silencio. `userId` se mantiene en la firma por compatibilidad
 * con el llamador existente (pages/dashboard.jsx), pero el servidor usa el id
 * del token, no el del cliente.
 */
export const marcarBienvenidaVista = async (_userId) => {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/marcar-bienvenida', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'No se pudo registrar la bienvenida')
  return data
}

export const actualizarPerfil = (userId, { nombre, email }) =>
  supabase.from('perfiles').update({ nombre, email }).eq('id', userId).then(unwrap)
