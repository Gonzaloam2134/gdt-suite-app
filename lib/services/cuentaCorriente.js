import { supabase } from '../supabaseClient'
import { unwrap } from './_base'
import { registrarCobro, registrarReversa } from './transacciones'
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
 * Registra el pago del padre: es plata real, así que primero genera un
 * cobro normal en `transacciones` (mismo motor de comisión/IVA que
 * cualquier venta — entra al arqueo del día como corresponde) y después
 * el movimiento 'pago' que lo vincula y baja el saldo del cliente.
 *
 * Si el cobro se crea pero el insert en movimientos_cc falla, el dinero
 * ya quedó registrado en la caja (correcto, es real) pero sin bajar el
 * saldo del cliente — se vuelve a intentar completar el vínculo, nunca
 * se revierte el cobro solo por este error secundario.
 */
export const registrarPagoCc = async ({ clienteId, localId, medioPagoId, monto, descripcion, creadoPor, alicuota = 21 }) => {
  const cobro = await registrarCobro({
    localId, medioPagoId, monto,
    descripcion: descripcion || 'Pago cuenta corriente',
    alicuota,
  })
  return supabase.from('movimientos_cc').insert([{
    cliente_id: clienteId, local_id: localId, tipo: TIPO_MOVIMIENTO_CC.PAGO,
    monto, descripcion: descripcion || 'Pago cuenta corriente',
    transaccion_id: cobro.id, creado_por: creadoPor,
  }]).select().single().then(unwrap)
}

/**
 * Anula un movimiento (consumo o pago) con una reversa — nunca update ni
 * delete, igual que en `transacciones`. Si es un 'pago' vinculado a un
 * cobro real, también revierte ESE cobro (misma lógica de ReversaModal
 * para transacciones normales), para que la plata vuelva a salir del
 * arqueo del día.
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
  }
  return supabase.from('movimientos_cc').insert([{
    cliente_id: movimiento.cliente_id, local_id: movimiento.local_id, tipo: movimiento.tipo,
    monto: -Number(movimiento.monto || 0),
    descripcion: `[REVERSA] ${movimiento.descripcion || 'Movimiento'}`,
    es_reversa: true, reversa_de: movimiento.id,
  }]).select().single().then(unwrap)
}
