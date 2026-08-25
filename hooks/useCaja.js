import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getCajaAbiertaHoy, abrirCaja, cerrarCaja, listarCierres } from '../lib/services/cierresCaja'
import { registrarAccion } from '../lib/services/auditoria'
import { ACCIONES } from '../lib/constants/auditoria'
import { efectivoEsperado } from '../lib/domain/transacciones'

/** Estado y operaciones de la caja del día: abrir, cerrar, historial. */
export function useCaja({ localId, userId, onCambio }) {
  const [cajaAbierta, setCajaAbierta] = useState(null)
  const [historial, setHistorial] = useState([])
  const [procesando, setProcesando] = useState(false)

  const verificar = useCallback(async () => {
    if (!localId) return
    try {
      setCajaAbierta(await getCajaAbiertaHoy(localId))
    } catch (err) {
      console.error('[useCaja] verificar', err)
    }
  }, [localId])

  useEffect(() => { verificar() }, [verificar])

  const abrir = async (montoInicial) => {
    const monto = parseFloat(montoInicial)
    if (Number.isNaN(monto) || monto < 0) { toast.error('Ingresá un monto inicial válido'); return false }
    setProcesando(true)
    try {
      const caja = await abrirCaja({ localId, userId, montoInicial: monto })
      setCajaAbierta(caja)
      await registrarAccion({ localId, userId, accion: ACCIONES.CAJA_ABIERTA, detalles: { monto_inicial: monto } })
      toast.success('Caja abierta')
      await onCambio?.()
      return true
    } catch (err) {
      toast.error(`No se pudo abrir la caja: ${err.message}`)
      return false
    } finally { setProcesando(false) }
  }

  const cerrar = async ({ efectivoFisico, observaciones, totales, cantidadTransacciones }) => {
    if (!cajaAbierta) { toast.error('No hay caja abierta'); return false }
    const fisico = efectivoFisico === '' ? null : parseFloat(efectivoFisico)
    const esperado = efectivoEsperado(cajaAbierta.monto_inicial_efectivo, totales)
    const diferencia = fisico === null ? null : Math.round((fisico - esperado) * 100) / 100

    setProcesando(true)
    try {
      await cerrarCaja(cajaAbierta.id, {
        totalCobrado: totales.cobros, totalGastado: totales.gastos,
        cantidadTransacciones, efectivoFisico: fisico, diferencia, observaciones,
      })
      await registrarAccion({
        localId, userId, accion: ACCIONES.CAJA_CERRADA,
        detalles: { total_cobrado: totales.cobros, total_gastado: totales.gastos, efectivo_fisico: fisico, diferencia },
      })
      setCajaAbierta(null)
      toast.success('Caja cerrada')
      await onCambio?.()
      return true
    } catch (err) {
      toast.error(`No se pudo cerrar la caja: ${err.message}`)
      return false
    } finally { setProcesando(false) }
  }

  const cargarHistorial = async () => {
    try {
      setHistorial(await listarCierres(localId))
      return true
    } catch (err) {
      toast.error('No se pudo cargar el historial')
      return false
    }
  }

  return { cajaAbierta, historial, procesando, abrir, cerrar, cargarHistorial, verificar }
}
