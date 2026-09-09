/**
 * Lógica pura de la conexión con la cuenta de Mercado Pago del comerciante
 * (OAuth + Store/POS). Nada de esto hace fetch ni toca Supabase — eso vive
 * en lib/server/mercadopagoCliente.js y en pages/api/mercadopago-cliente/*.
 *
 * Proyecto DISTINTO al de suscripciones (lib/domain/mercadopago.js): esa
 * cuenta es la de GDT Suite, esta es la del comerciante. Comparten el
 * mecanismo de firma de webhook, así que ese se reutiliza de ahí — el resto
 * no tiene nada en común.
 */
import crypto from 'crypto'

const MP_AUTHORIZE_URL = 'https://auth.mercadopago.com/authorization'

/** code_verifier (43-128 chars, RFC 7636) + su code_challenge S256, para PKCE. */
export const generarPkce = () => {
  const codeVerifier = crypto.randomBytes(48).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

/** Valor random para el parámetro `state` del OAuth, contra CSRF. */
export const generarState = () => crypto.randomBytes(24).toString('base64url')

/** URL de autorización de Mercado Pago (el dueño la visita para conectar su cuenta). */
export const construirUrlAutorizacion = ({ clientId, redirectUri, state, codeChallenge }) => {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    state,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${MP_AUTHORIZE_URL}?${params.toString()}`
}

const LIMITE_EXTERNAL_ID_STORE = 60
const LIMITE_EXTERNAL_ID_POS = 40

const sinGuiones = (localId) => localId.replace(/-/g, '')

/** external_id de la Store en Mercado Pago: el local_id sin guiones (alfanumérico). */
export const derivarExternalStoreId = (localId) => {
  const id = sinGuiones(localId)
  if (id.length > LIMITE_EXTERNAL_ID_STORE) {
    throw new Error(`external_id de Store supera los ${LIMITE_EXTERNAL_ID_STORE} caracteres`)
  }
  return id
}

/**
 * external_id del POS: el mismo id de Store + sufijo "POS<n>", SIN guion —
 * CONFIRMADO que el external_id de POS solo admite alfanumérico. `numeroPos`
 * es 1-based (primera caja del local = 1).
 */
export const derivarExternalPosId = (localId, numeroPos = 1) => {
  const id = `${derivarExternalStoreId(localId)}POS${numeroPos}`
  if (id.length > LIMITE_EXTERNAL_ID_POS) {
    throw new Error(`external_id de POS supera los ${LIMITE_EXTERNAL_ID_POS} caracteres`)
  }
  return id
}

export { validarFirmaWebhook } from './mercadopago'
