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
  supabase.from('perfiles').select('id, email, nombre, rol_global, bienvenida_vista_en').eq('id', userId).maybeSingle().then(unwrap)

export const getPerfiles = (ids) =>
  supabase.from('perfiles').select('id, email, nombre, rol_global').in('id', ids).then(unwrap)

/** Marca que ya vio el mensaje de bienvenida — vive en la cuenta, no en el
 *  dispositivo, para que no vuelva a aparecer si entra desde otro celular. */
export const marcarBienvenidaVista = (userId) =>
  supabase.from('perfiles').update({ bienvenida_vista_en: new Date().toISOString() }).eq('id', userId).then(unwrap)

export const actualizarPerfil = (userId, { nombre, email }) =>
  supabase.from('perfiles').update({ nombre, email }).eq('id', userId).then(unwrap)
