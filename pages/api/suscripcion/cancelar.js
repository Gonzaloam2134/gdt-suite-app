import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { cancelarPreapproval } from '../../../lib/server/mercadopago'

/**
 * Cancela la suscripción REAL en Mercado Pago (no solo en nuestra base).
 * Solo cancela la propia cuenta de quien llama — nunca recibe un ownerId
 * por parámetro, así no hay forma de que alguien cancele la de otro.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'No autenticado' })

  const { data: cuenta } = await supabaseAdmin
    .from('suscripciones_cuenta').select('mp_preapproval_id, plan, estado').eq('owner_id', user.id).maybeSingle()

  if (!cuenta?.mp_preapproval_id) {
    return res.status(400).json({ error: 'No hay ninguna suscripción paga activa para cancelar' })
  }
  if (cuenta.estado === 'restricted' || cuenta.estado === 'suspended') {
    return res.status(400).json({ error: 'Esta suscripción ya no está activa' })
  }

  try {
    await cancelarPreapproval(cuenta.mp_preapproval_id)
  } catch (err) {
    return res.status(502).json({ error: `Mercado Pago no confirmó la cancelación: ${err.message}` })
  }

  // Recién acá, con la cancelación real ya confirmada por Mercado Pago,
  // se actualiza la base — nunca al revés. El webhook de "preapproval
  // cancelled" también va a llegar después y hace lo mismo: es redundante
  // pero no rompe nada (el estado ya va a decir 'restricted').
  await supabaseAdmin
    .from('suscripciones_cuenta')
    .update({ estado: 'restricted', actualizado_en: new Date().toISOString() })
    .eq('owner_id', user.id)

  return res.status(200).json({ ok: true })
}
