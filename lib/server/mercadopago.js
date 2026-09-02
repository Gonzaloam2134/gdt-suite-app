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

export const obtenerPago = (paymentId) => llamarMP(`/v1/payments/${paymentId}`)

export const obtenerPreapproval = (preapprovalId) => llamarMP(`/preapproval/${preapprovalId}`)
