import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { crearPreapproval } from '../../../lib/server/mercadopago'
import { construirExternalReference, frequencyTypeDeCiclo } from '../../../lib/domain/mercadopago'
import { SEGMENTO, CICLO } from '../../../lib/constants/planes'

/**
 * Crea la suscripción recurrente en Mercado Pago para la cuenta del que
 * llama (nunca para un ownerId que mande el body — si no, cualquiera
 * podría "pagar" la suscripción de otra cuenta).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'No autenticado' })

  const { segmento, ciclo } = req.body || {}
  if (!Object.values(SEGMENTO).includes(segmento) || !Object.values(CICLO).includes(ciclo)) {
    return res.status(400).json({ error: 'Plan inválido' })
  }

  const { data: plan, error: planError } = await supabaseAdmin
    .from('planes').select('precio').eq('segmento', segmento).eq('ciclo', ciclo).eq('activo', true).maybeSingle()
  if (planError || !plan) return res.status(400).json({ error: 'Ese plan no está disponible' })

  const { data: perfil } = await supabaseAdmin.from('perfiles').select('email').eq('id', user.id).maybeSingle()
  const payerEmail = perfil?.email || user.email
  if (!payerEmail) return res.status(400).json({ error: 'No se encontró un email para esta cuenta' })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return res.status(500).json({ error: 'Falta configurar NEXT_PUBLIC_APP_URL' })

  try {
    const preapproval = await crearPreapproval({
      reason: `GDT Suite — Plan ${segmento} (${ciclo})`,
      externalReference: construirExternalReference(user.id, segmento, ciclo),
      payerEmail,
      backUrl: `${appUrl}/planes/confirmacion`,
      frequencyType: frequencyTypeDeCiclo(ciclo),
      transactionAmount: Number(plan.precio),
    })
    return res.status(200).json({ initPoint: preapproval.init_point })
  } catch (err) {
    console.error('Error creando preapproval de Mercado Pago', err)
    return res.status(502).json({ error: 'No se pudo iniciar el pago. Probá de nuevo en un momento.' })
  }
}
