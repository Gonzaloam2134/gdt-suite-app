import { useState, useCallback, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { getCajaAbiertaLocal, abrirCaja, cerrarCaja, listarCierres } from '../lib/services/cierresCaja'
import { registrarAccion } from '../lib/services/auditoria'
import { ACCIONES } from '../lib/constants/auditoria'
import { efectivoEsperado } from '../lib/domain/transacciones'
import { esCajaDeHoy } from '../lib/domain/cajas'
import { mensajeError } from '../lib/errorMessage'
import { formatFecha } from '../lib/format'

/**
 * Estado y operaciones de la caja: abrir, cerrar, historial, y resolver una
 * caja "huérfana" (abierta un día anterior y nunca cerrada).
 *
 * `cajaAbierta` que devuelve este hook es SIEMPRE la caja operativa de HOY
 * (o null). Si lo que hay abierto es de un día anterior, se expone aparte en
 * `huerfana` — así el resto de la UI (botones de cobro/gasto, "cerrar caja")
 * no la confunde con la caja del día y opera como si no hubiera caja abierta,
 * hasta que la huérfana se resuelva.
 */
export function useCaja({ localId, userId, onCambio }) {
  const [caja, setCaja] = useState(null) // la fila cruda de cierres_caja, de hoy o huérfana
  const [historial, setHistorial] = useState([])
  const [procesando, setProcesando] = useState(false)
  const montado = useRef(true)
  useEffect(() => { montado.current = true; return () => { montado.current = false } }, [])

  const huerfana = caja && !esCajaDeHoy(caja) ? caja : null
  const cajaAbierta = caja && esCajaDeHoy(caja) ? caja : null

  const verificar = useCallback(async () => {
    if (!localId) return
    try {
      const fila = await getCajaAbiertaLocal(localId)
      if (montado.current) setCaja(fila)
    } catch (err) {
      console.error('[useCaja] verificar', err)
    }
  }, [localId])

  useEffect(() => { verificar() }, [verificar])

  const abrir = async (montoInicial) => {
    const monto = parseFloat(montoInicial)
    if (!Number.isFinite(monto) || monto < 0) { toast.error('Ingresá un monto inicial válido'); return false }
    setProcesando(true)
    try {
      // Última chequeada justo antes de escribir: reduce (sin eliminar del todo)
      // la ventana en la que dos personas del mismo local abren caja a la vez.
      const yaAbierta = await getCajaAbiertaLocal(localId)
      if (yaAbierta) {
        if (montado.current) { setCaja(yaAbierta); setProcesando(false) }
        toast.error(esCajaDeHoy(yaAbierta)
          ? 'Ya hay una caja abierta hoy para este local'
          : `Hay una caja sin cerrar del ${formatFecha(yaAbierta.fecha_apertura)}. Cerrala antes de abrir la de hoy.`)
        return false
      }
      const nueva = await abrirCaja({ localId, userId, montoInicial: monto })
      if (!montado.current) return true
      setCaja(nueva)
      await registrarAccion({ localId, userId, accion: ACCIONES.CAJA_ABIERTA, detalles: { monto_inicial: monto } })
      toast.success('Caja abierta')
      await onCambio?.()
      return true
    } catch (err) {
      toast.error(`No se pudo abrir la caja: ${mensajeError(err)}`)
      return false
    } finally { if (montado.current) setProcesando(false) }
  }

  const cerrar = async ({ efectivoFisico, observaciones, totales, cantidadTransacciones }) => {
    if (!cajaAbierta) { toast.error('No hay caja abierta'); return false }
    const fisico = efectivoFisico === '' ? null : parseFloat(efectivoFisico)
    if (fisico !== null && !Number.isFinite(fisico)) { toast.error('Ingresá un monto de efectivo válido'); return false }
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
      if (montado.current) setCaja(null)
      toast.success('Caja cerrada')
      await onCambio?.()
      return true
    } catch (err) {
      toast.error(`No se pudo cerrar la caja: ${mensajeError(err)}`)
      return false
    } finally { if (montado.current) setProcesando(false) }
  }

  /**
   * Cierra la caja huérfana con los totales de SU día (no del actual). No pide
   * efectivo contado: nadie la contó ese día, así que queda `null` y la
   * conciliación la informa como "sin contar" en vez de fingir que cuadró.
   */
  const cerrarHuerfana = async ({ totales, cantidadTransacciones, nota }) => {
    if (!huerfana) return false
    setProcesando(true)
    try {
      const base = `Cerrada tarde: quedó abierta desde el ${formatFecha(huerfana.fecha_apertura)}. El efectivo de ese día no se contó.`
      const observaciones = nota?.trim() ? `${base} ${nota.trim()}` : base
      await cerrarCaja(huerfana.id, {
        totalCobrado: totales.cobros, totalGastado: totales.gastos,
        cantidadTransacciones, efectivoFisico: null, diferencia: null, observaciones,
      })
      await registrarAccion({
        localId, userId, accion: ACCIONES.CAJA_CERRADA,
        detalles: {
          huerfana: true, fecha_apertura: huerfana.fecha_apertura,
          total_cobrado: totales.cobros, total_gastado: totales.gastos,
        },
      })
      if (montado.current) setCaja(null)
      toast.success('Caja anterior cerrada')
      await onCambio?.()
      return true
    } catch (err) {
      toast.error(`No se pudo cerrar la caja anterior: ${mensajeError(err)}`)
      return false
    } finally { if (montado.current) setProcesando(false) }
  }

  const cargarHistorial = async () => {
    try {
      const filas = await listarCierres(localId)
      if (montado.current) setHistorial(filas)
      return true
    } catch (err) {
      toast.error('No se pudo cargar el historial')
      return false
    }
  }

  return { cajaAbierta, huerfana, historial, procesando, abrir, cerrar, cerrarHuerfana, cargarHistorial, verificar }
}
