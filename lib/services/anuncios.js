import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

export const listarAnuncios = ({ soloActivos = true } = {}) => {
  let q = supabase.from('anuncios').select('*').order('creado_en', { ascending: false })
  if (soloActivos) q = q.eq('activo', true)
  return q.then(unwrap)
}

export const crearAnuncio = ({ titulo, mensaje, tipo = 'info', creadoPor }) =>
  supabase.from('anuncios').insert([{ titulo: titulo.trim(), mensaje: mensaje.trim(), tipo, creado_por: creadoPor }]).then(unwrap)

/** Leídos en DB (tabla anuncios_leidos), ya no en localStorage */
export const listarLeidos = (userId) =>
  supabase.from('anuncios_leidos').select('anuncio_id').eq('user_id', userId)
    .then(unwrap).then(rows => rows.map(r => r.anuncio_id))

export const marcarLeidos = (userId, anuncioIds) =>
  supabase.from('anuncios_leidos')
    .upsert(anuncioIds.map(id => ({ anuncio_id: id, user_id: userId })), { onConflict: 'anuncio_id,user_id' })
    .then(unwrap)
