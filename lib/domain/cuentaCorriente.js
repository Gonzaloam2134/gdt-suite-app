/**
 * Lógica de negocio pura sobre cuentas corrientes (kiosko escolar y
 * similares). Sin React, sin Supabase — todo testeable con datos en memoria.
 *
 * El consumo es deuda (nunca suma al arqueo de caja); el pago es plata real
 * que ya se registró como un cobro normal en `transacciones` — acá solo se
 * calcula el saldo del cliente, no nada financiero (eso lo hace
 * lib/domain/transacciones.js sobre la fila de `transacciones` vinculada).
 */
import { TIPO_MOVIMIENTO_CC } from '../constants/cuentaCorriente'

const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v))
const redondear = (v) => Math.round(v * 100) / 100

export const esConsumo = (m) => m.tipo === TIPO_MOVIMIENTO_CC.CONSUMO
export const esPago = (m) => m.tipo === TIPO_MOVIMIENTO_CC.PAGO

/**
 * Un movimiento SUMA si no es una reversa y no fue revertido — mismo
 * criterio que `esValida` en lib/domain/transacciones.js.
 */
export const esValido = (m) => !m.es_reversa && !m.revertida
export const esAsientoInverso = (m) => !!m.es_reversa
export const estaAnulado = (m) => !!m.revertida

/**
 * Saldo pendiente del cliente: lo que consumió menos lo que ya pagó, sobre
 * los movimientos válidos (ignora reversas y anulados, igual que los
 * totales de caja).
 * @param {Array} movimientos  filas de movimientos_cc de UN cliente
 * @returns {number} positivo = debe; 0 = al día; nunca se muestra negativo
 *                    como deuda (ver `saldoAFavor` para el excedente)
 */
export const calcularSaldo = (movimientos) => {
  const total = (movimientos || []).filter(esValido).reduce((acc, m) => {
    if (esConsumo(m)) return acc + num(m.monto)
    if (esPago(m)) return acc - num(m.monto)
    return acc
  }, 0)
  return redondear(total)
}

/** Lo que el cliente tiene a favor, si pagó de más (saldo negativo en valor absoluto). */
export const saldoAFavor = (movimientos) => Math.max(0, redondear(-calcularSaldo(movimientos)))

/** Deuda a mostrar (nunca negativa): 0 si está al día o tiene saldo a favor. */
export const deudaPendiente = (movimientos) => Math.max(0, calcularSaldo(movimientos))

/**
 * Lista de clientes con su saldo ya calculado, para la pantalla principal.
 * @param {Array} clientes            filas de clientes_cc
 * @param {Object} movimientosPorCliente  { [cliente_id]: Array<movimiento> }
 */
export const clientesConSaldo = (clientes, movimientosPorCliente) =>
  (clientes || []).map(c => ({
    ...c,
    saldo: calcularSaldo(movimientosPorCliente[c.id] || []),
  }))

/** Total adeudado entre todos los clientes de un local — para un resumen rápido. */
export const totalAdeudado = (clientesConSaldoCalculado) =>
  redondear((clientesConSaldoCalculado || []).reduce((acc, c) => acc + Math.max(0, num(c.saldo)), 0))

/**
 * ¿Un pago de `monto` tiene sentido dado el saldo actual? No lo bloquea
 * (los pagos parciales están permitidos, y también puede pagar de más si
 * quiere dejar saldo a favor) — solo informa si excede la deuda, para que
 * la pantalla pueda avisar antes de confirmar.
 */
export const excedeSaldo = (monto, saldo) => num(monto) > num(saldo) && num(saldo) > 0
