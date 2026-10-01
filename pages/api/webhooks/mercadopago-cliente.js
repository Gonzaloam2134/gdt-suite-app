import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { validarFirmaWebhook } from '../../../lib/domain/mercadopagoCliente'
import { procesarOrderDeWebhook } from '../../../lib/server/mercadopagoClienteSync'

/**
 * Webhook de la app de Mercado Pago del CLIENTE (ruta separada de
 * pages/api/webhooks/mercadopago.js, que es la de suscripciones — secreto
 * propio, `MERCADOPAGO_MARKETPLACE_WEBHOOK_SECRET`). Solo escucha el tópico
 * `order` (QR y Point) — confirmado en la sección 3 del plan, no hay que
 * suscribir `payment` acá.
 *
 * Igual que el webhook de suscripciones: MP reintenta agresivo si no
 * contestamos 200, así que una vez que la firma valida y quedó registrado el
 * intento, esta ruta SIEMPRE responde 200 — el procesamiento de negocio
 * nunca debe tirar una excepción sin capturar.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  const dataId = req.query['data.id'] || req.query.id || req.body?.data?.id
  const type = req.body?.type || req.query.type
  // Para una app de marketplace/OAuth, MP manda el user_id del comerciante
  // conectado en el propio body del webhook — es lo único que permite saber
  // a QUÉ cuenta (y por lo tanto qué access_token) corresponde este order.
  const mpUserId = req.body?.user_id != null ? String(req.body.user_id) : null
  const xSignature = req.headers['x-signature']
  const xRequestId = req.headers['x-request-id']
  const secret = process.env.MERCADOPAGO_MARKETPLACE_WEBHOOK_SECRET

  if (!validarFirmaWebhook(xSignature, xRequestId, dataId, secret)) {
    console.error('Webhook de Mercado Pago (cliente) con firma inválida', { dataId, type })
    return res.status(401).json({ error: 'Firma inválida' })
  }

  const notificationId = `mp-cliente:${type}:${req.body?.id ?? dataId}`
  const debeProcesar = await debeProcesarse(notificationId)
  if (!debeProcesar) return res.status(200).json({ ok: true, duplicado: true })

  try {
    if (type === 'order') await procesarNotificacionDeOrder(dataId, mpUserId)
    await marcarResultado(notificationId, true)
  } catch (err) {
    console.error('Error procesando webhook de Mercado Pago (cliente)', { type, dataId }, err)
    await marcarResultado(notificationId, false, err.message)
  }

  return res.status(200).json({ ok: true })
}

/**
 * true si hay que procesar esta notificación: es nueva, o ya se había
 * recibido pero el procesamiento anterior falló (nunca se marcó completada).
 * false solo si ya se completó con éxito antes — un duplicado real.
 */
async function debeProcesarse(notificationId) {
  try {
    const { data, error } = await supabaseAdmin.rpc('registrar_intento_webhook_mp', { p_id: notificationId })
    if (error) {
      console.error('No se pudo registrar el intento de webhook de MP-cliente (se procesa igual)', error)
      return true
    }
    return data === true
  } catch (err) {
    console.error('Error de idempotencia del webhook de MP-cliente (se procesa igual)', err)
    return true
  }
}

async function marcarResultado(notificationId, exito, error = null) {
  try {
    await supabaseAdmin.rpc('marcar_webhook_mp_resultado', { p_id: notificationId, p_exito: exito, p_error: error })
  } catch (err) {
    console.error('No se pudo actualizar el estado del webhook de MP-cliente', err)
  }
}

async function procesarNotificacionDeOrder(orderId, mpUserId) {
  if (!orderId) return
  if (!mpUserId) {
    console.error('Webhook de order de Mercado Pago sin user_id — no se puede identificar la cuenta conectada')
    return
  }

  const { data: conexion } = await supabaseAdmin
    .from('conexiones_mercadopago').select('*').eq('mp_user_id', mpUserId).is('desconectado_en', null).maybeSingle()
  if (!conexion) {
    console.error('Webhook de order para una cuenta de Mercado Pago sin conexión activa', mpUserId)
    return
  }

  await procesarOrderDeWebhook(supabaseAdmin, orderId, conexion)
}
