import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

/** Precios vigentes, por segmento y ciclo. Vive en la base para poder ajustarse sin redeploy. */
export const listarPlanes = () =>
  supabase.from('planes').select('*').eq('activo', true).then(unwrap)
