import { supabaseAdmin } from '../../lib/server/supabaseAdmin'

/**
 * Registra que la persona ya vio el mensaje de bienvenida. Pasa por Service
 * Role por el mismo motivo que /api/aceptar-terminos: el cliente anon no
 * tiene permiso de RLS para actualizar su propia fila de `perfiles` desde el
 * navegador, y ese `update()` no tira error — solo afecta 0 filas en
 * silencio — así que el mensaje volvía a aparecer en la siguiente sesión
 * aunque ya se hubiera cerrado una vez.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: { user: quienLlama }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !quienLlama) return res.status(401).json({ error: 'No autenticado' })

  const { error } = await supabaseAdmin
    .from('perfiles')
    .update({ bienvenida_vista_en: new Date().toISOString() })
    .eq('id', quienLlama.id)

  if (error) {
    console.error('[api/marcar-bienvenida]', error)
    return res.status(400).json({ error: 'No se pudo registrar' })
  }

  return res.status(200).json({ ok: true })
}
