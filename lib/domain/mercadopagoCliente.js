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

// ---------------------------------------------------------------------------
// Fase B — parseo del `order` que llega por webhook (topic `order`, QR/Point)
// ---------------------------------------------------------------------------

const ORIGEN_POR_TIPO_ORDER = { qr: 'qr', point: 'point' }

/**
 * Extrae los datos de un `order` de Mercado Pago (GET /v1/orders/{id}) que
 * hacen falta para encolarlo en movimientos_mp_pendientes. Devuelve null si
 * todavía no corresponde procesarlo (no acreditó, o no es QR/Point — un
 * order de Checkout Pro con type "online" nunca es un cobro del comercio en
 * caja física, está fuera del alcance de esta integración).
 *
 * CONFIRMADO contra la documentación pública de Mercado Pago (2026-09-08):
 * el order de QR trae `config.qr.external_pos_id` (el mismo string que
 * generamos en derivarExternalPosId). El de Point NO trae store_id/pos_id,
 * solo `config.point.terminal_id` (el ID del lector físico) — no alcanza
 * para resolver el local acá, ver resolverLocalId.
 */
export const extraerDatosOrder = (order) => {
  if (!order || order.status !== 'processed') return null
  const origen = ORIGEN_POR_TIPO_ORDER[order.type]
  if (!origen) return null

  const monto = Number(order.total_amount)
  if (!Number.isFinite(monto) || monto <= 0) return null

  return {
    mpPaymentId: String(order.id),
    origen,
    monto,
    descripcion: order.description ?? null,
    fechaMp: order.created_date || new Date().toISOString(),
    externalPosId: order.config?.qr?.external_pos_id ?? null,
  }
}

/**
 * A qué local corresponde un cobro, dado lo que se pudo identificar y el
 * mapeo de locales vinculados de la cuenta. `mapeos` es la lista de
 * { local_id } de TODOS los locales que el dueño ya vinculó.
 *
 * - QR: se resuelve siempre, comparando el external_pos_id del order contra
 *   el que le corresponde a cada local (derivarExternalPosId).
 * - Point y transferencias: no traen ninguna forma de identificar el local
 *   (Point solo trae el terminal_id del lector físico, una transferencia no
 *   trae nada). Si el dueño tiene un solo local vinculado no hay ambigüedad
 *   posible y se autocompleta igual que decidió la Fase A para
 *   transferencias; con más de uno, queda sin asignar para que lo resuelva
 *   a mano — nunca se adivina "a ojo" del lado del código (ver sección 4
 *   del plan, "Lo que NO hacer").
 */
export const resolverLocalId = ({ origen, externalPosId, mapeos }) => {
  if (!mapeos?.length) return null

  if (origen === 'qr' && externalPosId) {
    const match = mapeos.find((m) => derivarExternalPosId(m.local_id, 1) === externalPosId)
    if (match) return match.local_id
  }

  if (mapeos.length === 1) return mapeos[0].local_id
  return null
}

// ---------------------------------------------------------------------------
// Fase C — detectar transferencias comunes entre los pagos de la cuenta
// ---------------------------------------------------------------------------

/**
 * Basado en la documentación de Postman de Mercado Pago (no
 * developers.mercadopago.com) — no es la fuente oficial, es lo mejor que
 * se encontró: `operation_type: "money_transfer"` sería dinero recibido
 * por transferencia entre usuarios (CVU/alias), a diferencia de los
 * cobros de QR/Point, que vienen con `operation_type: "pos_payment"`.
 * PENDIENTE DE VERIFICACIÓN con una transferencia real antes de confiar
 * en esto para un comerciante real — ver PLAN_MP_CLIENTE_PARA_CODE.md
 * sección 5.
 */
export const esTransferencia = (payment) =>
  payment?.operation_type === 'money_transfer' && payment?.status === 'approved'

// ---------------------------------------------------------------------------
// Sincronización manual ("Sincronizar" del dashboard) — cooldown server-side
// ---------------------------------------------------------------------------

export const COOLDOWN_SINCRONIZACION_MANUAL_SEGUNDOS = 60

/**
 * Cuántos segundos faltan para poder volver a pedir una sincronización
 * manual (0 = ya se puede). `ultimaSincronizacion` es el timestamp guardado
 * en conexiones_mercadopago.ultima_sincronizacion_manual (string ISO o
 * null si nunca se usó el botón).
 */
export const segundosParaProximaSincronizacionManual = (ultimaSincronizacion, ahora = new Date()) => {
  if (!ultimaSincronizacion) return 0
  const transcurridos = (ahora.getTime() - new Date(ultimaSincronizacion).getTime()) / 1000
  const restantes = COOLDOWN_SINCRONIZACION_MANUAL_SEGUNDOS - transcurridos
  return restantes > 0 ? Math.ceil(restantes) : 0
}

export const extraerDatosTransferencia = (payment) => {
  const monto = Number(payment?.transaction_amount)
  if (!Number.isFinite(monto) || monto <= 0) return null
  return {
    mpPaymentId: String(payment.id),
    monto,
    descripcion: payment.description ?? null,
    fechaMp: payment.date_approved || payment.date_created || new Date().toISOString(),
  }
}
