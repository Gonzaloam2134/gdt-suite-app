import * as XLSX from 'xlsx'
import { formatFecha } from '../format'
import { LABEL_TIPO_MEDIO } from '../constants/mediosPago'

const TIPO_LABEL = { A: 'Factura A', B: 'Factura B', C: 'Factura C', M: 'Factura M', TICKET: 'Ticket', SIN_COMPROBANTE: 'Sin comprobante' }
const n = (v) => Number(v) || 0

/** Los nombres de hoja de Excel no admiten : \ / ? * [ ] ni más de 31 caracteres. */
const hoja = (wb, nombre, filas, anchos) => {
  const ws = XLSX.utils.aoa_to_sheet(filas)
  if (anchos) ws['!cols'] = anchos.map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31))
}

/**
 * Libro de trabajo para el contador. Cada hoja es autoexplicativa y los montos
 * van como números (no como texto con símbolo), para que se puedan sumar.
 */
export const generarExcel = ({ local, periodo, resumen, libroVentas, libroCompras, porAlicuotaVentas, porAlicuotaCompras, porMedio, porDia, cierres, conciliacion, calidad }) => {
  const wb = XLSX.utils.book_new()
  const titulo = `${local.nombre} — ${formatFecha(periodo.desde + 'T12:00:00')} al ${formatFecha(periodo.hasta + 'T12:00:00')}`

  hoja(wb, 'Resumen', [
    [titulo], [],
    ['Condición fiscal', local.condicion_fiscal || 'No especificada'],
    ['Generado', formatFecha(new Date())],
    [],
    ['RESULTADO DEL PERÍODO'],
    ['Concepto', 'Importe'],
    ['Total facturado (bruto)', n(resumen.totalFacturado)],
    ['(-) IVA débito fiscal', -n(resumen.ivaDebitoFiscal)],
    ['Neto gravado', n(resumen.netoGravado)],
    ['(-) Comisiones de medios de pago', -n(resumen.comisiones)],
    ['Ingreso neto real', n(resumen.ingresoNetoReal)],
    ['(-) Gastos operativos', -n(resumen.gastosOperativos)],
    ['(+) IVA crédito fiscal', n(resumen.ivaCreditoFiscal)],
    ['RESULTADO', n(resumen.resultadoEjercicio)],
    [],
    ['POSICIÓN IVA'],
    ['IVA débito fiscal (ventas)', n(resumen.ivaDebitoFiscal)],
    ['IVA crédito fiscal (compras)', n(resumen.ivaCreditoFiscal)],
    ['Saldo', n(resumen.ivaAPagar)],
    [],
    ['CANTIDADES'],
    ['Ventas', calidad.cobros],
    ['Gastos', resumen.cantidadGastos],
    ['Anulados (excluidos)', calidad.anuladas],
    [],
    ['ADVERTENCIAS SOBRE EL DATO'],
    ...(calidad.avisos.length ? calidad.avisos.map(a => [a.texto]) : [['Sin observaciones.']]),
  ], [45, 18])

  hoja(wb, 'IVA Ventas', [
    ['LIBRO IVA VENTAS'], [titulo], [],
    ['Fecha', 'Comprobante', 'Punto de venta', 'Número', 'Medio de pago', 'Neto', 'Alícuota %', 'IVA', 'Total', 'Comisión'],
    ...libroVentas.map(v => [
      formatFecha(v.fecha), TIPO_LABEL[v.tipo] || v.tipo,
      v.punto_venta ?? '', v.numero ?? '', v.medio || '',
      n(v.neto), n(v.alicuota), n(v.iva), n(v.total), n(v.comision),
    ]),
    [], ['TOTALES', '', '', '', '', n(resumen.netoGravado), '', n(resumen.ivaDebitoFiscal), n(resumen.totalFacturado), n(resumen.comisiones)],
  ], [12, 16, 14, 12, 18, 14, 10, 14, 14, 12])

  hoja(wb, 'IVA Compras', [
    ['LIBRO IVA COMPRAS'], [titulo], [],
    ['Fecha', 'Comprobante', 'Punto de venta', 'Número', 'Proveedor / concepto', 'Neto', 'Alícuota %', 'IVA', 'Total'],
    ...libroCompras.map(c => [
      formatFecha(c.fecha), TIPO_LABEL[c.tipo] || c.tipo,
      c.punto_venta ?? '', c.numero ?? '', c.proveedor || '',
      n(c.neto), n(c.alicuota), n(c.iva), n(c.total),
    ]),
    [], ['TOTALES', '', '', '', '', '', '', n(resumen.ivaCreditoFiscal), n(resumen.gastosOperativos)],
  ], [12, 16, 14, 12, 28, 14, 10, 14, 14])

  hoja(wb, 'Resumen IVA', [
    ['RESUMEN POR ALÍCUOTA'], [titulo], [],
    ['VENTAS'], ['Alícuota %', 'Cantidad', 'Neto', 'IVA', 'Total'],
    ...porAlicuotaVentas.map(a => [n(a.alicuota), a.cantidad, n(a.neto), n(a.iva), n(a.total)]),
    [], ['COMPRAS'], ['Alícuota %', 'Cantidad', 'Neto', 'IVA', 'Total'],
    ...porAlicuotaCompras.map(a => [n(a.alicuota), a.cantidad, n(a.neto), n(a.iva), n(a.total)]),
  ], [12, 12, 16, 16, 16])

  hoja(wb, 'Medios de pago', [
    ['COBROS POR MEDIO DE PAGO'], [titulo], [],
    ['Medio', 'Tipo', 'Cantidad', 'Total cobrado', 'Comisión', 'Neto acreditado', '% del total'],
    ...porMedio.map(m => [
      m.nombre, LABEL_TIPO_MEDIO[m.tipo] || m.tipo, m.cantidad,
      n(m.total), n(m.comisiones), n(m.neto),
      resumen.totalFacturado ? Math.round((m.total / resumen.totalFacturado) * 1000) / 10 : 0,
    ]),
  ], [22, 18, 10, 16, 14, 16, 12])

  hoja(wb, 'Libro caja', [
    ['MOVIMIENTOS POR DÍA'], [titulo], [],
    ['Fecha', 'Movimientos', 'Ventas', 'Gastos', 'Resultado'],
    ...porDia.map(d => [formatFecha(d.fecha + 'T12:00:00'), d.cantidad, n(d.ventas), n(d.gastos), n(d.resultado)]),
  ], [14, 12, 16, 16, 16])

  hoja(wb, 'Conciliación', [
    ['CONCILIACIÓN DE CAJA'], [titulo], [],
    ['Cierres registrados', conciliacion.cierres],
    ['Cierres sin conteo de efectivo', conciliacion.sinContar],
    ['Días que cuadraron', conciliacion.cuadrados],
    ['Días con faltante', conciliacion.diasFaltante],
    ['Días con sobrante', conciliacion.diasSobrante],
    ['Diferencia acumulada', n(conciliacion.totalDiferencia)],
    [],
    ['Fecha cierre', 'Inicial', 'Cobrado', 'Gastado', 'Efectivo contado', 'Diferencia', 'Observaciones'],
    ...cierres.map(c => [
      formatFecha(c.fecha_cierre), n(c.monto_inicial_efectivo), n(c.total_cobrado), n(c.total_gastado),
      c.efectivo_fisico == null ? 'No contado' : n(c.efectivo_fisico),
      c.diferencia_efectivo == null ? '' : n(c.diferencia_efectivo),
      c.observaciones || '',
    ]),
  ], [16, 14, 14, 14, 16, 14, 30])

  const nombre = `${local.nombre.replace(/[^\w\s-]/g, '').trim()} ${periodo.desde} a ${periodo.hasta}.xlsx`
  XLSX.writeFile(wb, nombre)
}
