import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { generarPkce, generarState, construirUrlAutorizacion } from '../../../lib/domain/mercadopagoCliente'

const COOKIE_NAME = 'mp_cliente_oauth'
// El `code` de Mercado Pago vale 10 minutos — la cookie no tiene sentido que
// dure más que eso, así que 10 minutos justos (nada de margen extra).
const COOKIE_MAX_AGE_SEGUNDOS = 10 * 60

/**
 * Arma la URL de autorización de OAuth para que el DUEÑO conecte SU cuenta
 * de Mercado Pago. Guarda code_verifier (PKCE) + state en una cookie
 * httpOnly de corta duración — no hay tabla para este estado transitorio,
 * y no hace falta crear una solo para esto.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'No autenticado' })

  const clientId = process.env.MERCADOPAGO_MARKETPLACE_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!clientId || !appUrl) return res.status(500).json({ error: 'Falta configurar la conexión con Mercado Pago' })

  const { codeVerifier, codeChallenge } = generarPkce()
  const state = generarState()
  const redirectUri = `${appUrl}/api/mercadopago-cliente/callback`

  const cookieValue = encodeURIComponent(JSON.stringify({ ownerId: user.id, codeVerifier, state }))
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${cookieValue}; Max-Age=${COOKIE_MAX_AGE_SEGUNDOS}; Path=/api/mercadopago-cliente; HttpOnly; SameSite=Lax${secure}`
  )

  const url = construirUrlAutorizacion({ clientId, redirectUri, state, codeChallenge })
  return res.status(200).json({ url })
}
