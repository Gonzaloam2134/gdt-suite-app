import { supabase } from '../supabaseClient'
import { unwrap } from './_base'
import { getPerfiles } from './auth'
import { getLocales } from './locales'

export const crearContacto = (payload) =>
  supabase.from('contactos').insert([payload]).then(unwrap)

export const listarContactos = () =>
  supabase.from('contactos').select('*').order('creado_en', { ascending: false }).then(unwrap)

/**
 * 'resuelto' (no 'respondido'): es el valor que ya usa el panel de super admin
 * para filtrar y contar consultas. Antes esta función guardaba un estado que
 * la UI no reconocía, así que una consulta respondida por acá quedaba sin
 * contar ni como pendiente ni como resuelta en ningún filtro.
 */
export const responderContacto = (id, respuesta) =>
  supabase.from('contactos').update({
    respuesta, estado: 'resuelto', respondido_en: new Date().toISOString(),
  }).eq('id', id).then(unwrap)

/** Contactos con el perfil de quien consultó y el nombre del local, para el panel de super admin. */
export const listarContactosConDetalle = async () => {
  const contactos = await listarContactos()
  if (!contactos.length) return []

  const userIds = [...new Set(contactos.map(c => c.user_id).filter(Boolean))]
  const localIds = [...new Set(contactos.map(c => c.local_id).filter(Boolean))]
  const [perfiles, locales] = await Promise.all([
    userIds.length ? getPerfiles(userIds) : Promise.resolve([]),
    localIds.length ? getLocales(localIds) : Promise.resolve([]),
  ])
  const perfilPorId = new Map(perfiles.map(p => [p.id, p]))
  const localPorId = new Map(locales.map(l => [l.id, l]))

  return contactos.map(c => ({
    ...c,
    perfil: perfilPorId.get(c.user_id) || null,
    local: c.local_id ? (localPorId.get(c.local_id) || null) : null,
  }))
}
