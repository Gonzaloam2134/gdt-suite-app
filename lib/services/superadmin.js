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

export const listarUsuarios = (limite = 500) =>
  supabase.from('perfiles').select('*').order('creado_en', { ascending: false }).limit(limite).then(unwrap)

/**
 * Locales con sus miembros y perfiles, para el panel de super admin.
 * Sin `!inner`: un local recién creado (todavía sin miembros_locales, caso raro
 * pero posible si el alta falló a mitad de camino) antes desaparecía de la
 * lista entera en vez de mostrarse sin miembros.
 */
/** Historial real de pagos aprobados — para el cashflow con detalle. */
export const listarPagosSuscripcion = (limite = 500) =>
  supabase.from('pagos_suscripcion').select('*')
    .order('procesado_en', { ascending: false }).limit(limite).then(unwrap)

export const listarLocalesConMiembros = (limite = 200) =>
  supabase.from('locales')
    .select('id, nombre, rubro, condicion_fiscal, activo, creado_en, miembros_locales (user_id, rol, activo, perfiles (email, nombre))')
    .order('creado_en', { ascending: false })
    .limit(limite)
    .then(unwrap)

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
