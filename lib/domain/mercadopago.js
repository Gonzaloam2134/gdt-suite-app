/**
 * Lógica pura de la integración con Mercado Pago: nada de esto hace fetch
 * ni toca Supabase. Todo lo que necesita hablar con la API de MP o con la
 * base vive en lib/server/ o en pages/api/.
 */
import crypto from 'crypto'
import { CICLO } from '../constants/planes'
import { aFechaISO } from '../dates'

/** owner_id (perfiles.id) → external_reference, para que el webhook pueda volver de un dataId al dueño. */
export const construirExternalReference = (ownerId, segmento, ciclo) => `${ownerId}:${segmento}:${ciclo}`

export const parsearExternalReference = (ref) => {
  if (typeof ref !== 'string') return null
  const partes = ref.split(':')
  if (partes.length !== 3) return null
  const [ownerId, segmento, ciclo] = partes
  if (!ownerId || !segmento || !ciclo) return null
  return { ownerId, segmento, ciclo }
}

/** auto_recurring.frequency_type que espera la API de Mercado Pago. */
export const frequencyTypeDeCiclo = (ciclo) => (ciclo === CICLO.ANUAL ? 'years' : 'months')

/** Fecha de vencimiento del próximo período (hoy + 1 mes o + 1 año), en hora local. */
export const proximoVencimiento = (ciclo, hoy = aFechaISO()) => {
  const [y, m, d] = hoy.split('-').map(Number)
  const fecha = new Date(y, m - 1, d, 12, 0, 0)
  if (ciclo === CICLO.ANUAL) fecha.setFullYear(fecha.getFullYear() + 1)
  else fecha.setMonth(fecha.getMonth() + 1)
  return aFechaISO(fecha)
}

/**
 * Valida el header x-signature de un webhook de Mercado Pago (formato
 * "ts=...,v1=..."), armando el mismo manifest que firma MP del lado de
 * ellos y comparando el HMAC-SHA256 con el secreto del panel.
 */
export const validarFirmaWebhook = (xSignature, xRequestId, dataId, secret) => {
  if (!xSignature || !dataId || !secret) return false
  const partes = Object.fromEntries(
    xSignature.split(',').map(p => p.trim().split('=').map(s => s.trim()))
  )
  if (!partes.ts || !partes.v1) return false
  const manifest = `id:${dataId};request-id:${xRequestId ?? ''};ts:${partes.ts};`
  const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  return hash === partes.v1
}
