import { useState, useEffect, useCallback } from 'react'
import { listarClientesCc, crearClienteCc, setClienteCcActivo, listarMovimientosCcDeLocal } from '../lib/services/cuentaCorriente'
import { clientesConSaldo, totalAdeudado } from '../lib/domain/cuentaCorriente'

/**
 * Clientes con cuenta corriente de un local, con el saldo de cada uno ya
 * calculado — para la pantalla principal de /cuenta-corriente.
 */
export function useCuentaCorriente(localId) {
  const [clientes, setClientes] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(() => {
    if (!localId) return Promise.resolve()
    return Promise.all([
      listarClientesCc(localId),
      listarMovimientosCcDeLocal(localId),
    ]).then(([c, m]) => { setClientes(c); setMovimientos(m) })
  }, [localId])

  useEffect(() => {
    setCargando(true)
    recargar().finally(() => setCargando(false))
  }, [recargar])

  const movimientosPorCliente = {}
  for (const m of movimientos) (movimientosPorCliente[m.cliente_id] ??= []).push(m)

  const activos = clientes.filter(c => c.activo)
  const lista = clientesConSaldo(activos, movimientosPorCliente)

  const crear = async (nombre, identificador, creadoPor) => {
    await crearClienteCc({ localId, nombre, identificador: identificador || null, creadoPor })
    await recargar()
  }

  const darDeBaja = async (id) => {
    await setClienteCcActivo(id, false)
    await recargar()
  }

  return {
    clientes: lista,
    totalAdeudado: totalAdeudado(lista),
    cargando,
    crear,
    darDeBaja,
    recargar,
  }
}
