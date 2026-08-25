import { supabase } from '../supabaseClient'
import { unwrap } from './_base'
import { contarLocales } from './locales'
import { contarTransacciones } from './transacciones'

export const getStatsGlobales = async () => {
  const [locales, transacciones, usuarios] = await Promise.all([
    contarLocales(),
    contarTransacciones(),
    supabase.from('perfiles').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0),
  ])
  return { locales, transacciones, usuarios }
}

export const listarUsuarios = () =>
  supabase.from('perfiles').select('*').order('creado_en', { ascending: false }).then(unwrap)

/** Solo super_user puede cambiar rol_global (trigger proteger_rol_global) */
export const actualizarUsuario = (id, { rol_global, email }) => {
  const cambios = {}
  if (rol_global) cambios.rol_global = rol_global
  if (email) cambios.email = email
  return supabase.from('perfiles').update(cambios).eq('id', id).then(unwrap)
}

export const getConfigGlobal = () =>
  supabase.from('configuracion_global').select('*').eq('id', 1).maybeSingle().then(unwrap)

export const guardarConfigGlobal = (config) =>
  supabase.from('configuracion_global').upsert({ id: 1, ...config, actualizado_en: new Date().toISOString() }).then(unwrap)
