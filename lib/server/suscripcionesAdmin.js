/**
 * Mismas escrituras que lib/services/suscripciones.js, pero con la Service
 * Role: el webhook de Mercado Pago no tiene sesión de usuario, así que la
 * RLS normal (pensada para el dueño autenticado) lo bloquearía.
 */
import { supabaseAdmin } from './supabaseAdmin'
import { unwrap } from '../services/_base'

export const activarPlanPago = (ownerId, { segmento, ciclo, fechaVencimiento, mpPreapprovalId, mpPayerEmail }) =>
  supabaseAdmin.from('suscripciones_cuenta').update({
    plan: 'pago', estado: 'active', segmento, ciclo,
    fecha_vencimiento: fechaVencimiento,
    mp_preapproval_id: mpPreapprovalId ?? null,
    mp_payer_email: mpPayerEmail ?? null,
    actualizado_en: new Date().toISOString(),
  }).eq('owner_id', ownerId).then(unwrap)

export const cambiarEstadoCuenta = (ownerId, estado) =>
  supabaseAdmin.from('suscripciones_cuenta')
    .update({ estado, actualizado_en: new Date().toISOString() })
    .eq('owner_id', ownerId).then(unwrap)
