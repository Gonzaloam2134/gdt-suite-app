import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

export const listarAnuncios = ({ soloActivos = true } = {}) => {
  let q = supabase.from('anuncios').select('*').order('creado_en', { ascending: false })
  if (soloActivos) q = q.eq('activo', true)
  return q.then(unwrap)
}

export const crearAnuncio = ({ titulo, mensaje, tipo = 'info', creadoPor }) =>
  supabase.from('anuncios').insert([{ titulo: titulo.trim(), mensaje: mensaje.trim(), tipo, creado_por: creadoPor }]).then(unwrap)

export const actualizarAnuncio = (id, { titulo, mensaje, tipo }) =>
  supabase.from('anuncios')
    .update({ titulo: titulo.trim(), mensaje: mensaje.trim(), tipo, actualizado_en: new Date().toISOString() })
    .eq('id', id).then(unwrap)

/** Ocultarlo sin borrar el historial: deja de aparecer, pero se puede reactivar. */
export const cambiarActivoAnuncio = (id, activo) =>
  supabase.from('anuncios').update({ activo, actualizado_en: new Date().toISOString() }).eq('id', id).then(unwrap)

/** Borrado definitivo — para limpiar anuncios de prueba antes de un lanzamiento real. */
export const eliminarAnuncio = (id) =>
  supabase.from('anuncios').delete().eq('id', id).then(unwrap)

/** Leídos en DB (tabla anuncios_leidos), ya no en localStorage */
export const listarLeidos = (userId) =>
  supabase.from('anuncios_leidos').select('anuncio_id').eq('user_id', userId)
    .then(unwrap).then(rows => rows.map(r => r.anuncio_id))

export const marcarLeidos = (userId, anuncioIds) =>
  supabase.from('anuncios_leidos')
    .upsert(anuncioIds.map(id => ({ anuncio_id: id, user_id: userId })), { onConflict: 'anuncio_id,user_id' })
    .then(unwrap)

export const desmarcarLeido = (userId, anuncioId) =>
  supabase.from('anuncios_leidos').delete().eq('user_id', userId).eq('anuncio_id', anuncioId).then(unwrap)
