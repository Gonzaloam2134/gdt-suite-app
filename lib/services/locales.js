import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

export const getLocal = (id) =>
  supabase.from('locales').select('*').eq('id', id).maybeSingle().then(unwrap)

export const getLocales = (ids) =>
  supabase.from('locales').select('id, nombre, rubro, condicion_fiscal, activo').in('id', ids).then(unwrap)

export const listarTodosLosLocales = () =>
  supabase.from('locales').select('id, nombre, rubro, creado_en, creado_por, activo')
    .order('creado_en', { ascending: false }).then(unwrap)

export const crearLocal = ({ nombre, rubro, condicionFiscal, creadoPor }) =>
  supabase.from('locales').insert([{
    nombre, rubro, condicion_fiscal: condicionFiscal, creado_por: creadoPor,
  }]).select().single().then(unwrap)

/**
 * `locales.activo` es un archivado que decide el propio dueño (no está expuesto
 * en la UI todavía) — NO es el bloqueo por falta de pago. Ese es
 * `suscripciones.estado` (ver services/suscripciones.js), el único que revisan
 * `/locales` y `useSuscripcionGuard` para decidir el acceso. No usar esto para
 * suspender por pago: dos mecanismos para lo mismo es como quedaba un local
 * "suspendido" que la app seguía dejando usar igual.
 */
export const setLocalActivo = (id, activo) =>
  supabase.from('locales').update({ activo }).eq('id', id).then(unwrap)

export const contarLocales = () =>
  supabase.from('locales').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0)
