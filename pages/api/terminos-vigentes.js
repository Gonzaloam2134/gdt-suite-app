import { supabaseAdmin } from '../../lib/server/supabaseAdmin'
import { resolverTerminosVigentes } from '../../lib/domain/terminos'
import { TERMINOS_TEXTO_DEFAULT, VERSION_TERMINOS_DEFAULT } from '../../lib/constants/legal'

/**
 * Público (sin auth): hace falta leer los Términos vigentes antes de tener
 * cuenta (/registro, /terminos) y para el guard que corre en cada pantalla
 * protegida. Usa Service Role porque `configuracion_global` es, por lo
 * demás, una tabla de administración — su RLS no tiene por qué dejar pasar
 * a un visitante anónimo, y este endpoint solo expone estos dos campos (no
 * el resto de la config global).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' })

  const { data, error } = await supabaseAdmin
    .from('configuracion_global')
    .select('terminos_texto, terminos_version')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    console.error('[api/terminos-vigentes]', error)
    // Fail-open hacia el texto hardcodeado — nunca dejar a alguien sin poder
    // leer los términos, ni bloquear el registro, por un problema de la tabla.
    return res.status(200).json({ texto: TERMINOS_TEXTO_DEFAULT, version: VERSION_TERMINOS_DEFAULT })
  }

  return res.status(200).json(
    resolverTerminosVigentes(data, { texto: TERMINOS_TEXTO_DEFAULT, version: VERSION_TERMINOS_DEFAULT })
  )
}
