import { supabase } from '../supabaseClient'
import { unwrap } from './_base'
import { registrarReversa } from './transacciones'
import { rangoEntre } from '../dates'
import { TIPO_MOVIMIENTO_CC } from '../constants/cuentaCorriente'

const CAMPOS_CLIENTE = 'id, local_id, nombre, identificador, activo, creado_en'

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export const listarClientesCc = (localId, { soloActivos = false } = {}) => {
  let q = supabase.from('clientes_cc').select(CAMPOS_CLIENTE).eq('local_id', localId).order('nombre', { ascending: true })
  if (soloActivos) q = q.eq('activo', true)
  return q.then(unwrap)
}

export const crearClienteCc = ({ localId, nombre, identificador = null, creadoPor }) =>
  supabase.from('clientes_cc').insert([{
    local_id: localId, nombre: nombre.trim(), identificador, creado_por: creadoPor,
  }]).select(CAMPOS_CLIENTE).single().then(unwrap)

export const actualizarClienteCc = (id, cambios) =>
  supabase.from('clientes_cc').update(cambios).eq('id', id).then(unwrap)

/** Dar de baja, nunca borrar: el historial de movimientos queda igual. */
export const setClienteCcActivo = (id, activo) => actualizarClienteCc(id, { activo })

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------

const JOIN_TX = 'transacciones (id, monto, medio_pago_id, revertida)'

export const listarMovimientosCc = (clienteId) =>
  supabase.from('movimientos_cc').select(`*, ${JOIN_TX}`).eq('cliente_id', clienteId)
    .order('creado_en', { ascending: false }).then(unwrap)

/**
 * Todos los movimientos del local en un rango — para el resumen de saldos
 * de todos los clientes de una (ver lib/domain/cuentaCorriente.js#clientesConSaldo).
 */
export const listarMovimientosCcDeLocal = (localId) =>
  supabase.from('movimientos_cc').select('*').eq('local_id', localId)
    .order('creado_en', { ascending: false }).then(unwrap)

/**
 * Pagos de cuenta corriente de uno o varios locales en un período — para la
 * sección "Cobrado por cuenta corriente" de Reportes. Esa plata ya está
 * contada en los totales normales (es un cobro real en `transacciones`);
 * esto es solo para ver cuánto de lo cobrado vino de gente pagando su cuenta
 * corriente en vez de una venta del momento.
 */
export const listarPagosCcPeriodo = (localIds, desdeISO, hastaISO) => {
  if (!localIds?.length) return Promise.resolve([])
  const { inicio, fin } = rangoEntre(desdeISO, hastaISO)
  return supabase.from('movimientos_cc')
    .select('*, clientes_cc (nombre)')
    .in('local_id', localIds).eq('tipo', TIPO_MOVIMIENTO_CC.PAGO)
    .gte('creado_en', inicio).lte('creado_en', fin)
    .order('creado_en', { ascending: false }).then(unwrap)
}

/**
 * Anota un consumo: pura deuda, no toca `transacciones` ni el arqueo del
 * día — es la razón de ser de esta tabla separada (ver cabecera de
 * MIGRACION_CUENTA_CORRIENTE.sql).
 */
export const registrarConsumoCc = ({ clienteId, localId, monto, descripcion, creadoPor }) =>
  supabase.from('movimientos_cc').insert([{
    cliente_id: clienteId, local_id: localId, tipo: TIPO_MOVIMIENTO_CC.CONSUMO,
    monto, descripcion: descripcion || 'Consumo', creado_por: creadoPor,
  }]).select().single().then(unwrap)

/**
 * Registra el pago del padre: es plata real, así que genera el cobro normal
 * en `transacciones` (mismo motor de comisión/IVA que cualquier venta) y el
 * movimiento 'pago' que lo vincula y baja el saldo del cliente.
 *
 * Los dos inserts corren en una sola transacción de base (función
 * registrar_pago_cc, ver MIGRACION_CUENTA_CORRIENTE_HARDENING.sql): si algo
 * falla, no queda un cobro en caja sin vínculo a ningún cliente.
 */
export const registrarPagoCc = ({ clienteId, localId, medioPagoId, monto, descripcion, creadoPor, alicuota = 21 }) =>
  supabase.rpc('registrar_pago_cc', {
    p_cliente_id: clienteId,
    p_local_id: localId,
    p_medio_pago_id: medioPagoId,
    p_monto: monto,
    p_descripcion: descripcion || 'Pago cuenta corriente',
    p_creado_por: creadoPor,
    p_alicuota: alicuota,
  }).then(unwrap)

/**
 * Anula un movimiento (consumo o pago) con una reversa — nunca update ni
 * delete, igual que en `transacciones`. Si es un 'pago' vinculado a un
 * cobro real, también revierte ESE cobro (misma lógica de ReversaModal
 * para transacciones normales), para que la plata vuelva a salir del
 * arqueo del día.
 *
 * La reversa del lado de movimientos_cc la genera un trigger en la base
 * (trg_sincronizar_reversa_cc, ver MIGRACION_CUENTA_CORRIENTE_HARDENING.sql)
 * al insertar la reversa en `transacciones` — no se inserta a mano acá para
 * no competir con ese trigger, y porque así el saldo del cliente también
 * queda bien si el cobro se anula desde la pantalla normal de Caja, no solo
 * desde este modal.
 */
export const anularMovimientoCc = async (movimiento, motivo) => {
  if (movimiento.tipo === TIPO_MOVIMIENTO_CC.PAGO && movimiento.transaccion_id) {
    // Fila completa (medio_pago_id, comisión, IVA, etc.) — getTransaccion()
    // de transacciones.js solo trae id/revertida/es_reversa, no alcanza
    // para armar la reversa (registrarReversa necesita los montos reales).
    const transaccion = await supabase.from('transacciones').select('*')
      .eq('id', movimiento.transaccion_id).single().then(unwrap)
    if (transaccion && !transaccion.revertida) {
      await registrarReversa(transaccion, motivo)
    }
    return supabase.from('movimientos_cc').select('*').eq('reversa_de', movimiento.id).maybeSingle().then(unwrap)
  }
  return supabase.from('movimientos_cc').insert([{
    cliente_id: movimiento.cliente_id, local_id: movimiento.local_id, tipo: movimiento.tipo,
    monto: -Number(movimiento.monto || 0),
    descripcion: `[REVERSA] ${movimiento.descripcion || 'Movimiento'}`,
    es_reversa: true, reversa_de: movimiento.id,
  }]).select().single().then(unwrap)
}
