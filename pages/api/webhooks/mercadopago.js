import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { obtenerPago, obtenerPreapproval } from '../../../lib/server/mercadopago'
import { validarFirmaWebhook, decidirAccionDePago, decidirAccionDePreapproval } from '../../../lib/domain/mercadopago'
import { activarPlanPago, cambiarEstadoCuenta, registrarPagoSuscripcion } from '../../../lib/server/suscripcionesAdmin'
import { logEvento } from '../../../lib/server/logger'

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

  const inicio = Date.now()
  logEvento({ operacion: 'webhook_mp_suscripcion', resultado: 'recibido', detalles: { type, dataId } })

  if (!validarFirmaWebhook(xSignature, xRequestId, dataId, secret)) {
    logEvento({ operacion: 'webhook_mp_suscripcion', resultado: 'rechazado', detalles: { type, dataId, motivo: 'firma inválida' } })
    return res.status(401).json({ error: 'Firma inválida' })
  }

  const notificationId = req.body?.id ? `${type}:${req.body.id}` : `${type}:${dataId}`

  const debeProcesar = await debeProcesarse(notificationId)
  if (!debeProcesar) return res.status(200).json({ ok: true, duplicado: true })

  try {
    if (type === 'payment') {
      await procesarNotificacionDePago(dataId)
    } else if (type === 'preapproval' || type === 'subscription_preapproval') {
      await procesarNotificacionDePreapproval(dataId)
    }
    await marcarResultado(notificationId, true)
    logEvento({ operacion: 'webhook_mp_suscripcion', resultado: 'procesado', duracionMs: Date.now() - inicio, detalles: { type, dataId } })
  } catch (err) {
    logEvento({ operacion: 'webhook_mp_suscripcion', resultado: 'fallido', duracionMs: Date.now() - inicio, error: err, detalles: { type, dataId } })
    await marcarResultado(notificationId, false, err.message)
  }

  return res.status(200).json({ ok: true })
}

/**
 * true si hay que procesar esta notificación: es nueva, o ya se había
 * recibido pero el procesamiento anterior falló (nunca se marcó completada).
 * false solo si ya se completó con éxito antes — un duplicado real.
 * `registrar_intento_webhook_mp` es un UPSERT atómico en la base: si dos
 * reintentos de MP llegan casi al mismo tiempo, solo uno gana la carrera.
 */
async function debeProcesarse(notificationId) {
  try {
    const { data, error } = await supabaseAdmin.rpc('registrar_intento_webhook_mp', { p_id: notificationId })
    if (error) {
      console.error('No se pudo registrar el intento de webhook de MP (se procesa igual)', error)
      return true
    }
    return data === true
  } catch (err) {
    console.error('Error de idempotencia del webhook de MP (se procesa igual)', err)
    return true
  }
}

async function marcarResultado(notificationId, exito, error = null) {
  try {
    await supabaseAdmin.rpc('marcar_webhook_mp_resultado', { p_id: notificationId, p_exito: exito, p_error: error })
  } catch (err) {
    console.error('No se pudo actualizar el estado del webhook de MP', err)
  }
}

async function procesarNotificacionDePago(paymentId) {
  const pago = await obtenerPago(paymentId)
  const decision = decidirAccionDePago(pago)

  if (decision.accion === 'sin_referencia') {
    console.error('Pago de Mercado Pago sin external_reference reconocible', pago.id)
  } else if (decision.accion === 'activar_plan') {
    await activarPlanPago(decision.ownerId, {
      segmento: decision.segmento, ciclo: decision.ciclo, monto: decision.monto,
      fechaVencimiento: decision.fechaVencimiento,
      mpPreapprovalId: decision.mpPreapprovalId, mpPayerEmail: decision.mpPayerEmail,
    })
    if (decision.monto != null) {
      await registrarPagoSuscripcion({
        ownerId: decision.ownerId, segmento: decision.segmento, ciclo: decision.ciclo,
        monto: decision.monto, mpPaymentId: decision.mpPaymentId,
      }).catch((err) => console.error('No se pudo registrar el pago en el historial de cashflow (el plan sí se activó)', err))
    }
  } else if (decision.accion === 'restringir') {
    await cambiarEstadoCuenta(decision.ownerId, 'restricted')
  }
  // 'ignorar': status intermedio (pending, in_process, authorized, etc.) — no es un error.
}

async function procesarNotificacionDePreapproval(preapprovalId) {
  const preapproval = await obtenerPreapproval(preapprovalId)
  const decision = decidirAccionDePreapproval(preapproval)

  if (decision.accion === 'sin_referencia') {
    console.error('Preapproval de Mercado Pago sin external_reference reconocible', preapproval.id)
  } else if (decision.accion === 'restringir') {
    await cambiarEstadoCuenta(decision.ownerId, 'restricted')
  }
}
