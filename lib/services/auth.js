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
  supabase.from('perfiles').select('id, email, nombre, rol_global').eq('id', userId).maybeSingle().then(unwrap)

export const getPerfiles = (ids) =>
  supabase.from('perfiles').select('id, email, nombre, rol_global').in('id', ids).then(unwrap)

export const actualizarPerfil = (userId, { nombre, email }) =>
  supabase.from('perfiles').update({ nombre, email }).eq('id', userId).then(unwrap)
