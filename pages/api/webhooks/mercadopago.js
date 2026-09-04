import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { obtenerPago, obtenerPreapproval } from '../../../lib/server/mercadopago'
import { validarFirmaWebhook, parsearExternalReference, proximoVencimiento } from '../../../lib/domain/mercadopago'
import { activarPlanPago, cambiarEstadoCuenta, registrarPagoSuscripcion } from '../../../lib/server/suscripcionesAdmin'

/**
 * Mercado Pago reintenta agresivamente si no contestamos 200, así que una
 * vez que la firma valida y quedó registrado el intento, esta ruta SIEMPRE
 * responde 200 — incluso si el procesamiento de negocio falla (payload con
 * una forma inesperada, por ejemplo). Nunca dejar que una excepción de
 * negocio tire una excepción sin capturar acá.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  const dataId = req.query['data.id'] || req.query.id || req.body?.data?.id
  const type = req.body?.type || req.query.type
  const xSignature = req.headers['x-signature']
  const xRequestId = req.headers['x-request-id']
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET

  if (!validarFirmaWebhook(xSignature, xRequestId, dataId, secret)) {
    console.error('Webhook de Mercado Pago con firma inválida', { dataId, type })
    return res.status(401).json({ error: 'Firma inválida' })
  }

  const notificationId = req.body?.id ? `${type}:${req.body.id}` : `${type}:${dataId}`

  const yaProcesada = await marcarComoRecibida(notificationId)
  if (yaProcesada) return res.status(200).json({ ok: true, duplicado: true })

  try {
    if (type === 'payment') {
      await procesarNotificacionDePago(dataId)
    } else if (type === 'preapproval' || type === 'subscription_preapproval') {
      await procesarNotificacionDePreapproval(dataId)
    }
  } catch (err) {
    console.error('Error procesando webhook de Mercado Pago', { type, dataId }, err)
  }

  return res.status(200).json({ ok: true })
}

/** true si esta notificación ya se procesó antes (MP reintenta agresivo). */
async function marcarComoRecibida(notificationId) {
  try {
    const { error } = await supabaseAdmin.from('mp_notificaciones_procesadas').insert({ id: notificationId })
    if (!error) return false
    if (error.code === '23505') return true // clave duplicada: ya la habíamos procesado
    console.error('No se pudo registrar la notificación de MP en la tabla de idempotencia (se procesa igual)', error)
    return false
  } catch (err) {
    console.error('Error de idempotencia del webhook de MP (se procesa igual)', err)
    return false
  }
}

async function procesarNotificacionDePago(paymentId) {
  const pago = await obtenerPago(paymentId)
  const ref = parsearExternalReference(pago.external_reference)
  if (!ref) {
    console.error('Pago de Mercado Pago sin external_reference reconocible', pago.id)
    return
  }
  const { ownerId, segmento, ciclo } = ref

  if (pago.status === 'approved') {
    await activarPlanPago(ownerId, {
      segmento, ciclo,
      monto: pago.transaction_amount ?? null,
      fechaVencimiento: proximoVencimiento(ciclo),
      mpPreapprovalId: pago.preapproval_id ?? null,
      mpPayerEmail: pago.payer?.email ?? null,
    })
    if (pago.transaction_amount != null) {
      await registrarPagoSuscripcion({
        ownerId, segmento, ciclo,
        monto: pago.transaction_amount,
        mpPaymentId: String(pago.id),
      }).catch((err) => console.error('No se pudo registrar el pago en el historial de cashflow (el plan sí se activó)', err))
    }
  } else if (pago.status === 'rejected' || pago.status === 'cancelled') {
    await cambiarEstadoCuenta(ownerId, 'restricted')
  }
}

async function procesarNotificacionDePreapproval(preapprovalId) {
  const preapproval = await obtenerPreapproval(preapprovalId)
  const ref = parsearExternalReference(preapproval.external_reference)
  if (!ref) {
    console.error('Preapproval de Mercado Pago sin external_reference reconocible', preapproval.id)
    return
  }

  if (preapproval.status === 'cancelled' || preapproval.status === 'paused') {
    await cambiarEstadoCuenta(ref.ownerId, 'restricted')
  }
}
