/**
 * Único lugar que habla HTTP con la API de Mercado Pago. Usa el Access
 * Token de servidor — nunca importar desde una página ni desde código que
 * se empaquete para el cliente.
 */
const MP_API = 'https://api.mercadopago.com'

const accessToken = () => {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new Error('Falta MERCADOPAGO_ACCESS_TOKEN')
  return token
}

const llamarMP = async (path, options = {}) => {
  const res = await fetch(`${MP_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || `Mercado Pago respondió ${res.status}`)
  return data
}

/** Crea una suscripción recurrente sin plan asociado (monto inline). Devuelve { id, init_point, status, ... }. */
export const crearPreapproval = ({ reason, externalReference, payerEmail, backUrl, frequencyType, transactionAmount }) =>
  llamarMP('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason,
      external_reference: externalReference,
      payer_email: payerEmail,
      back_url: backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: frequencyType,
        transaction_amount: transactionAmount,
        currency_id: 'ARS',
      },
      status: 'pending',
    }),
  })

/**
 * Busca una suscripción pendiente o ya autorizada con esta external_reference
 * (owner+segmento+ciclo) antes de crear una nueva — evita que un doble click,
 * un retry del navegador, o un timeout+reintento generen dos preapprovals
 * recurrentes distintos para la misma cuenta y el mismo plan.
 *
 * OJO: probado contra la cuenta real, `/preapproval/search` IGNORA el filtro
 * `external_reference` (devuelve todos los preapproval de la cuenta sin
 * importar qué se mande ahí) — por eso el filtrado se hace acá, en JS,
 * paginando todos los resultados en vez de confiar en el query param.
 */
export const buscarPreapprovalEquivalente = async (externalReference) => {
  const LIMITE = 50
  let offset = 0
  for (;;) {
    const data = await llamarMP(`/preapproval/search?limit=${LIMITE}&offset=${offset}`)
    const resultados = data?.results || []
    const match = resultados.find((p) => p.external_reference === externalReference && (p.status === 'pending' || p.status === 'authorized'))
    if (match) return match
    offset += resultados.length
    const total = data?.paging?.total ?? offset
    if (resultados.length === 0 || offset >= total) return null
  }
}

export const obtenerPago = (paymentId) => llamarMP(`/v1/payments/${paymentId}`)

export const obtenerPreapproval = (preapprovalId) => llamarMP(`/preapproval/${preapprovalId}`)

/** Cancela la suscripción recurrente de verdad, del lado de Mercado Pago —
 *  sin esto, "cancelar" en nuestra base no detiene el cobro real. */
export const cancelarPreapproval = (preapprovalId) =>
  llamarMP(`/preapproval/${preapprovalId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  })
