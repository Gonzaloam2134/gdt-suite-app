import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

/**
 * Cola de "por confirmar" de Mercado Pago (ver Fase B/C/D del plan). No hay
 * política de INSERT para `authenticated` a propósito — solo el webhook y el
 * cron (Service Role) insertan acá. El dueño/cajero solo puede leer y
 * actualizar (asignar local, confirmar, descartar) sus propias filas, y eso
 * sí lo cubre la RLS normal.
 */

/** Inserta un pendiente. Si ya existía (mismo owner_id + mp_payment_id), no hace nada — es el mecanismo de idempotencia, no un error. */
export const crearPendiente = async (cliente, { ownerId, localId, mpPaymentId, origen, monto, descripcion, fechaMp }) => {
  const { data, error } = await cliente.from('movimientos_mp_pendientes').insert({
    owner_id: ownerId,
    local_id: localId,
    mp_payment_id: mpPaymentId,
    origen, monto,
    descripcion: descripcion ?? null,
    fecha_mp: fechaMp,
  }).select().single()
  if (!error) return data
  if (error.code === '23505') return null // ya estaba encolado — no es un error real
  throw new Error(error.message || 'Error de base de datos')
}

/** Pendientes de ESTE local — lo que ve la pantalla "Por confirmar" del dashboard. */
export const listarPendientesDeLocal = (localId) =>
  supabase.from('movimientos_mp_pendientes').select('*')
    .eq('local_id', localId).eq('estado', 'pendiente')
    .order('fecha_mp', { ascending: false }).then(unwrap)

/** Transferencias (u órdenes de Point) de la CUENTA que todavía no se pudieron asignar a ningún local. */
export const listarPendientesSinAsignar = (ownerId) =>
  supabase.from('movimientos_mp_pendientes').select('*')
    .eq('owner_id', ownerId).is('local_id', null).eq('estado', 'pendiente')
    .order('fecha_mp', { ascending: false }).then(unwrap)

/** El dueño elige a mano a qué local corresponde (transferencia o Point sin resolver). */
export const asignarLocal = (pendienteId, localId) =>
  supabase.from('movimientos_mp_pendientes').update({ local_id: localId })
    .eq('id', pendienteId).eq('estado', 'pendiente').select().single().then(unwrap)

/** Vincula el pendiente con la transacción real ya creada — nunca al revés (ver registrarCobro en lib/services/transacciones). */
export const marcarConfirmado = (pendienteId, transaccionId) =>
  supabase.from('movimientos_mp_pendientes').update({ estado: 'confirmado', transaccion_id: transaccionId })
    .eq('id', pendienteId).eq('estado', 'pendiente').select().single().then(unwrap)

export const descartarPendiente = (pendienteId) =>
  supabase.from('movimientos_mp_pendientes').update({ estado: 'descartado' })
    .eq('id', pendienteId).eq('estado', 'pendiente').then(unwrap)
