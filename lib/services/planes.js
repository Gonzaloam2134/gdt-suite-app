import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

/** Precios vigentes, por segmento y ciclo. Vive en la base para poder ajustarse sin redeploy. */
export const listarPlanes = () =>
  supabase.from('planes').select('*').eq('activo', true).then(unwrap)

/**
 * Solo super admin: la política planes_write de la base ya exige
 * es_super_user(), así que esto no necesita la Service Role — un usuario
 * cualquiera que intente esto se lo rechaza la RLS, no hace falta
 * duplicar el chequeo acá.
 */
export const actualizarPrecioPlan = (segmento, ciclo, precio) =>
  supabase.from('planes')
    .update({ precio, actualizado_en: new Date().toISOString() })
    .eq('segmento', segmento).eq('ciclo', ciclo)
    .then(unwrap)
