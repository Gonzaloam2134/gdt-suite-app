import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { getConexionDeOwner } from '../../../lib/services/conexionesMercadopago'

/**
 * `conexiones_mercadopago` no se puede leer desde el navegador (RLS lo
 * bloquea a propósito, son credenciales de una cuenta ajena) — esta ruta es
 * la única forma de que la UI sepa si el dueño ya conectó su cuenta.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'No autenticado' })

  const conexion = await getConexionDeOwner(user.id, supabaseAdmin)
  return res.status(200).json({ conectado: !!conexion, mpUserId: conexion?.mp_user_id ?? null })
}
