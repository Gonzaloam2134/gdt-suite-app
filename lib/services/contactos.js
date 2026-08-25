import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

export const crearContacto = (payload) =>
  supabase.from('contactos').insert([payload]).then(unwrap)

export const listarContactos = () =>
  supabase.from('contactos').select('*').order('creado_en', { ascending: false }).then(unwrap)

export const responderContacto = (id, respuesta) =>
  supabase.from('contactos').update({
    respuesta, estado: 'respondido', respondido_en: new Date().toISOString(),
  }).eq('id', id).then(unwrap)
