import { supabaseAdmin } from '../../lib/server/supabaseAdmin'
import { resolverTerminosVigentes } from '../../lib/domain/terminos'
import { TERMINOS_TEXTO_DEFAULT, VERSION_TERMINOS_DEFAULT } from '../../lib/constants/legal'

/**
 * Registra la aceptación de los Términos y Condiciones vigentes para quien
 * llama. Pasa por Service Role porque el cliente anon (`supabase.from('perfiles')
 * .update(...)` directo desde el navegador) no tiene permiso de RLS para
 * escribir en su propia fila de `perfiles`: el `update()` no tiraba error,
 * solo afectaba 0 filas en silencio, así que el modal se volvía a mostrar en
 * cada pantalla aunque la persona ya hubiera tocado "Acepto" — ver
 * useTerminosGuard.js.
 *
 * La versión que se guarda se resuelve ACÁ, del lado del servidor — nunca se
 * confía en lo que mande el cliente, para que nadie pueda "aceptar" una
 * versión vieja o inventada.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: { user: quienLlama }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !quienLlama) return res.status(401).json({ error: 'No autenticado' })

  const { data: config } = await supabaseAdmin
    .from('configuracion_global').select('terminos_texto, terminos_version').eq('id', 1).maybeSingle()
  const { version } = resolverTerminosVigentes(config, {
    texto: TERMINOS_TEXTO_DEFAULT,
    version: VERSION_TERMINOS_DEFAULT,
  })

  const { error } = await supabaseAdmin
    .from('perfiles')
    .update({ terminos_aceptados_en: new Date().toISOString(), terminos_version: version })
    .eq('id', quienLlama.id)

  if (error) {
    console.error('[api/aceptar-terminos]', error)
    return res.status(400).json({ error: 'No se pudo registrar la aceptación' })
  }

  return res.status(200).json({ ok: true, version })
}
