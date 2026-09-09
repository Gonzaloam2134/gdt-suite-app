/**
 * Único lugar que habla HTTP con la API de Mercado Pago para la conexión
 * con la cuenta del COMERCIANTE (OAuth + Store/POS). Credenciales propias,
 * separadas de las de suscripciones (lib/server/mercadopago.js) — nunca
 * mezclar `MERCADOPAGO_MARKETPLACE_*` con `MERCADOPAGO_ACCESS_TOKEN`.
 *
 * A diferencia de lib/server/mercadopago.js (token fijo de GDT Suite), acá
 * el access_token es el del comerciante conectado y viaja por parámetro en
 * cada llamada — nunca de una variable de entorno.
 */
const MP_API = 'https://api.mercadopago.com'

const credencialesApp = () => {
  const clientId = process.env.MERCADOPAGO_MARKETPLACE_CLIENT_ID
  const clientSecret = process.env.MERCADOPAGO_MARKETPLACE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Faltan MERCADOPAGO_MARKETPLACE_CLIENT_ID / MERCADOPAGO_MARKETPLACE_CLIENT_SECRET')
  }
  return { clientId, clientSecret }
}

const llamarMP = async (path, { accessToken, ...options } = {}) => {
  const res = await fetch(`${MP_API}${path}`, {
    ...options,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || `Mercado Pago respondió ${res.status}`)
  return data
}

/** Intercambia el `code` de la autorización (vale 10 min) por tokens. PKCE: manda el code_verifier, no un client_secret de la sesión del navegador. */
export const intercambiarCodePorTokens = ({ code, codeVerifier, redirectUri }) => {
  const { clientId, clientSecret } = credencialesApp()
  return llamarMP('/oauth/token', {
    method: 'POST',
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })
}

/** Cada renovación devuelve un refresh_token NUEVO — hay que volver a guardarlo, el viejo deja de servir. */
export const refrescarTokens = (refreshToken) => {
  const { clientId, clientSecret } = credencialesApp()
  return llamarMP('/oauth/token', {
    method: 'POST',
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
}

export const buscarStore = (mpUserId, accessToken, externalId) =>
  llamarMP(`/users/${mpUserId}/stores/search?external_id=${encodeURIComponent(externalId)}`, { accessToken })

export const crearStore = (mpUserId, accessToken, { name, externalId, location }) =>
  llamarMP(`/users/${mpUserId}/stores`, {
    accessToken,
    method: 'POST',
    body: JSON.stringify({ name, external_id: externalId, location }),
  })

export const buscarPos = (accessToken, externalId) =>
  llamarMP(`/pos?external_id=${encodeURIComponent(externalId)}`, { accessToken })

/** fixed_amount: true = quién escribe el monto es GDT Suite (el cajero) al crear cada Order, no el cliente escaneando un QR abierto. Ver Fase A del plan. */
export const crearPos = (accessToken, { name, storeId, externalStoreId, externalId, fixedAmount = true }) =>
  llamarMP('/pos', {
    accessToken,
    method: 'POST',
    body: JSON.stringify({
      name,
      fixed_amount: fixedAmount,
      store_id: storeId,
      external_store_id: externalStoreId,
      external_id: externalId,
    }),
  })
