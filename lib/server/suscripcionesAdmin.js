/**
 * Mismas escrituras que lib/services/suscripciones.js, pero con la Service
 * Role: el webhook de Mercado Pago no tiene sesión de usuario, así que la
 * RLS normal (pensada para el dueño autenticado) lo bloquearía.
 */
import { supabaseAdmin } from './supabaseAdmin'
import { unwrap } from '../services/_base'

export const activarPlanPago = (ownerId, { segmento, ciclo, monto, fechaVencimiento, mpPreapprovalId, mpPayerEmail }) =>
  supabaseAdmin.from('suscripciones_cuenta').update({
    plan: 'pago', estado: 'active', segmento, ciclo,
    // El monto real del pago aprobado, no el de la tabla `planes` en este
    // instante — si el precio cambia después, esta fila no se mueve sola.
    ...(monto != null ? { monto } : {}),
    fecha_vencimiento: fechaVencimiento,
    mp_preapproval_id: mpPreapprovalId ?? null,
    mp_payer_email: mpPayerEmail ?? null,
    actualizado_en: new Date().toISOString(),
  }).eq('owner_id', ownerId).then(unwrap)

/** Un renglón por cada pago real aprobado — es lo que arma el historial
 *  del cashflow. `activarPlanPago` actualiza el estado ACTUAL; esto guarda
 *  el registro de que ese cobro puntual pasó, para no perderlo cuando la
 *  suscripción se renueve y la fila de arriba se pise a sí misma. */
/**
 * `mp_payment_id` es único en la base (ver MIGRACION_EVITAR_PAGOS_DUPLICADOS):
 * si Mercado Pago llegara a mandar dos notificaciones distintas para el
 * mismo pago real, el segundo insert no duplica el historial — se ignora
 * en silencio, no hace falta que el webhook trate esto como un error.
 */
export const registrarPagoSuscripcion = async ({ ownerId, segmento, ciclo, monto, mpPaymentId }) => {
  const { error } = await supabaseAdmin.from('pagos_suscripcion').insert({
    owner_id: ownerId, segmento, ciclo, monto,
    mp_payment_id: mpPaymentId ?? null,
  })
  if (error && error.code !== '23505') throw error   // 23505 = clave duplicada: ya estaba registrado, no es un error real
}

export const cambiarEstadoCuenta = (ownerId, estado) =>
  supabaseAdmin.from('suscripciones_cuenta')
    .update({ estado, actualizado_en: new Date().toISOString() })
    .eq('owner_id', ownerId).then(unwrap)
