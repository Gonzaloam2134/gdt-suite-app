/**
 * Lógica compartida para meter cobros de Mercado Pago en la cola de
 * "por confirmar" (movimientos_mp_pendientes). La usan tres caminos:
 *  - el webhook (pages/api/webhooks/mercadopago-cliente.js), en tiempo real,
 *    un order a la vez;
 *  - el backfill al vincular un local por primera vez (pages/api/mercadopago-
 *    cliente/vincular-local.js);
 *  - el cron periódico (pages/api/cron/mercadopago-cliente-sync.js), que
 *    concilia lo reciente y busca transferencias (que no tienen webhook).
 * Todo pasa por crearPendiente, que es idempotente — no hay riesgo de
 * duplicar un cobro por correr el backfill y el cron sobre el mismo rango.
 */
import { obtenerOrder, buscarOrders, buscarPagos } from './mercadopagoCliente'
import { tokenVigente } from './mercadopagoClienteAuth'
import { listarMapeosDeOwner } from '../services/mapeoLocalesMp'
import { crearPendiente } from '../services/movimientosMpPendientes'
import { extraerDatosOrder, resolverLocalId, esTransferencia, extraerDatosTransferencia } from '../domain/mercadopagoCliente'

export const DIAS_BACKFILL_INICIAL = 30

// Ventana del botón "Sincronizar" del dashboard: alcanza con cubrir el
// hueco máximo que puede dejar el cron diario (ver pages/api/cron/
// mercadopago-cliente-sync.js) — no hace falta más, y mantiene la consulta
// a la API de Mercado Pago liviana.
export const VENTANA_SINCRONIZACION_MANUAL_HORAS = 26

const encolarOrder = async (cliente, order, { ownerId, mapeos }) => {
  const datos = extraerDatosOrder(order)
  if (!datos) return
  const localId = resolverLocalId({ origen: datos.origen, externalPosId: datos.externalPosId, mapeos })
  await crearPendiente(cliente, {
    ownerId, localId,
    mpPaymentId: datos.mpPaymentId, origen: datos.origen,
    monto: datos.monto, descripcion: datos.descripcion, fechaMp: datos.fechaMp,
  })
}

/** Procesa el order de UN webhook (ya viene con el detalle completo, pedido por obtenerOrder). */
export async function procesarOrderDeWebhook(cliente, orderId, conexion) {
  const accessToken = await tokenVigente(cliente, conexion)
  const order = await obtenerOrder(orderId, accessToken)
  const mapeos = await listarMapeosDeOwner(cliente, conexion.owner_id)
  await encolarOrder(cliente, order, { ownerId: conexion.owner_id, mapeos })
}

/**
 * Backfill/conciliación de una cuenta en un rango de fechas: re-consulta
 * orders de QR y Point (por si algún webhook no llegó, o para el backfill
 * inicial) y busca transferencias entre los pagos de la cuenta (que no
 * tienen webhook — solo se detectan así, por polling).
 */
export async function sincronizarCuenta(cliente, conexion, { desde, hasta }) {
  const accessToken = await tokenVigente(cliente, conexion)
  const mapeos = await listarMapeosDeOwner(cliente, conexion.owner_id)
  const ownerId = conexion.owner_id

  let orders = 0
  for (const type of ['qr', 'point']) {
    const resultado = await buscarOrders({ accessToken, type, beginDate: desde, endDate: hasta })
    const lista = resultado?.results ?? resultado?.elements ?? []
    for (const order of lista) {
      await encolarOrder(cliente, order, { ownerId, mapeos })
      orders += 1
    }
  }

  let transferencias = 0
  const pagos = await buscarPagos({ accessToken, operationType: 'money_transfer', beginDate: desde, endDate: hasta })
  for (const payment of pagos?.results ?? []) {
    if (!esTransferencia(payment)) continue
    const datos = extraerDatosTransferencia(payment)
    if (!datos) continue
    const localId = resolverLocalId({ origen: 'transferencia', externalPosId: null, mapeos })
    await crearPendiente(cliente, {
      ownerId, localId,
      mpPaymentId: datos.mpPaymentId, origen: 'transferencia',
      monto: datos.monto, descripcion: datos.descripcion, fechaMp: datos.fechaMp,
    })
    transferencias += 1
  }

  return { orders, transferencias }
}
