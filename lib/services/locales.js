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

/** Suspender/reactivar: solo locales.activo. No toca miembros_locales. */
export const setLocalActivo = (id, activo) =>
  supabase.from('locales').update({ activo }).eq('id', id).then(unwrap)

export const contarLocales = () =>
  supabase.from('locales').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0)
