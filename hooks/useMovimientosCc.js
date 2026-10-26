import { useState, useEffect, useCallback } from 'react'
import { listarMovimientosCc, registrarConsumoCc, registrarPagoCc, anularMovimientoCc } from '../lib/services/cuentaCorriente'
import { calcularSaldo } from '../lib/domain/cuentaCorriente'

/** Movimientos de UN cliente, con su saldo y las acciones para operarlo. */
export function useMovimientosCc(clienteId) {
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(() => {
    if (!clienteId) return Promise.resolve()
    return listarMovimientosCc(clienteId).then(setMovimientos)
  }, [clienteId])

  useEffect(() => {
    setCargando(true)
    recargar().finally(() => setCargando(false))
  }, [recargar])

  const anotarConsumo = async ({ localId, monto, descripcion, creadoPor }) => {
    const fila = await registrarConsumoCc({ clienteId, localId, monto, descripcion, creadoPor })
    await recargar()
    return fila
  }

  const registrarPago = async ({ localId, medioPagoId, monto, descripcion, creadoPor }) => {
    const fila = await registrarPagoCc({ clienteId, localId, medioPagoId, monto, descripcion, creadoPor })
    await recargar()
    return fila
  }

  const anular = async (movimiento, motivo) => {
    const fila = await anularMovimientoCc(movimiento, motivo)
    await recargar()
    return fila
  }

  return { movimientos, saldo: calcularSaldo(movimientos), cargando, anotarConsumo, registrarPago, anular, recargar }
}
