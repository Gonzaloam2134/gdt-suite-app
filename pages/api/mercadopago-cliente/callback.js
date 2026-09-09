import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { intercambiarCodePorTokens } from '../../../lib/server/mercadopagoCliente'
import { guardarConexion } from '../../../lib/services/conexionesMercadopago'

const COOKIE_NAME = 'mp_cliente_oauth'
// Por si la respuesta de MP no trae expires_in: el access_token dura 180 días (confirmado en el plan).
const VENCIMIENTO_MS_POR_DEFECTO = 180 * 24 * 60 * 60 * 1000

const leerCookie = (req) => {
  const raw = req.cookies?.[COOKIE_NAME]
  if (!raw) return null
  try {
    return JSON.parse(decodeURIComponent(raw))
  } catch {
    return null
  }
}

const limpiarCookie = (res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Max-Age=0; Path=/api/mercadopago-cliente; HttpOnly; SameSite=Lax`)
}

/**
 * MP redirige acá después de que el dueño autoriza (o cancela) la conexión.
 * Intercambia el `code` por tokens y guarda la conexión — después vuelve a
 * Admin, que lee el query param para mostrar el resultado.
 */
export default async function handler(req, res) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const irA = (resultado) => res.redirect(302, `${appUrl}/admin?tab=mercadopago&mp_cliente=${resultado}`)

  const { code, state: stateRecibido, error: errorMp } = req.query
  const guardado = leerCookie(req)
  limpiarCookie(res)

  if (errorMp) return irA('cancelado')
  if (!code || !stateRecibido || !guardado) return irA('error')
  if (stateRecibido !== guardado.state) {
    console.error('State de OAuth de Mercado Pago (cuenta del cliente) no coincide — posible CSRF o cookie vencida')
    return irA('error')
  }

  try {
    const redirectUri = `${appUrl}/api/mercadopago-cliente/callback`
    const tokens = await intercambiarCodePorTokens({ code, codeVerifier: guardado.codeVerifier, redirectUri })
    const venceEn = new Date(
      Date.now() + (tokens.expires_in ? tokens.expires_in * 1000 : VENCIMIENTO_MS_POR_DEFECTO)
    ).toISOString()

    await guardarConexion(supabaseAdmin, {
      ownerId: guardado.ownerId,
      mpUserId: String(tokens.user_id),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      venceEn,
    })

    return irA('conectado')
  } catch (err) {
    console.error('Error en el callback de OAuth de Mercado Pago (cuenta del cliente)', err)
    return irA('error')
  }
}
