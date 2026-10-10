import ExcelJS from 'exceljs'
import { formatFecha } from '../format'
import { HEX, FMT, nombreArchivo } from './estilos'
import {
  borde, fondo, letraColumna, encabezado, cabecera, cuerpo, totales, anchos, tituloSeccion,
} from './excel'

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const suma = (filas, campo) => filas.reduce((acc, f) => acc + n(f[campo]), 0)

// ---------------------------------------------------------------------------
// Hojas
// ---------------------------------------------------------------------------

const hojaResumen = (wb, ctx) => {
  const { alcanceLabel, periodoLabel, rankingLocales, porOwner, comisiones, alertaCaida, crecimiento } = ctx
  const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] })
  anchos(ws, [38, 20, 20])

  let f = encabezado(ws, {
    titulo: 'Panel de análisis — GDT Suite',
    subtitulo: `${alcanceLabel} · ${periodoLabel}`,
    columnas: 3,
  })

  const meta = [
    ['Alcance', alcanceLabel],
    ['Período', periodoLabel],
    ['Generado', formatFecha(new Date())],
    ['Locales con movimientos', rankingLocales.length],
    ['Owners con movimientos', porOwner.length],
  ]
  for (const [label, valor] of meta) {
    const row = ws.getRow(f)
    ws.mergeCells(`A${f}:B${f}`)
    row.getCell(1).value = label
    row.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: HEX.gris } }
    row.getCell(1).alignment = { indent: 1 }
    row.getCell(3).value = valor
    row.getCell(3).font = { name: 'Calibri', size: 10, bold: true }
    row.getCell(3).alignment = { horizontal: 'right' }
    row.height = 16
    f += 1
  }
  f += 1

  f = tituloSeccion(ws, f, 'VOLUMEN Y COMISIONES', 3)
  const kpis = [
    ['Volumen cobrado', comisiones.volumenCobrado, FMT.moneda],
    ['Volumen gastado', suma(rankingLocales, 'volumenGastado'), FMT.moneda],
    ['Comisión pagada (real, al momento de cada cobro)', comisiones.comisionPagada, FMT.moneda],
    ['% de comisión sobre lo cobrado', comisiones.pctComision * 100, FMT.porcentaje],
  ]
  for (const [label, valor, formato] of kpis) {
    const row = ws.getRow(f)
    ws.mergeCells(`A${f}:B${f}`)
    row.getCell(1).value = label
    row.getCell(1).font = { name: 'Calibri', size: 10 }
    row.getCell(1).alignment = { indent: 1, wrapText: true }
    row.getCell(1).border = borde()
    row.getCell(3).value = valor
    row.getCell(3).numFmt = formato
    row.getCell(3).font = { name: 'Calibri', size: 10, bold: true, color: { argb: HEX.azul } }
    row.getCell(3).alignment = { horizontal: 'right' }
    row.getCell(3).border = borde()
    row.height = 17
    f += 1
  }
  f += 1

  if (alertaCaida?.caida || crecimiento?.gastosCrecenMasRapido) {
    f = tituloSeccion(ws, f, 'SEÑALES A REVISAR', 3, HEX.ambar, HEX.ambarClaro)
    const avisos = []
    if (alertaCaida?.caida) {
      avisos.push(`Caída de ventas: la semana de ${alertaCaida.semana} cobró un ${(Math.abs(alertaCaida.variacionPct) * 100).toFixed(1)}% menos que su propio promedio de las ${alertaCaida.semanasDeReferencia} semanas anteriores.`)
    }
    if (crecimiento?.gastosCrecenMasRapido) {
      avisos.push(`Los gastos crecieron más rápido que las ventas en el período (gastos ${((crecimiento.crecGastos ?? 0) * 100).toFixed(1)}% vs. ventas ${((crecimiento.crecVentas ?? 0) * 100).toFixed(1)}%).`)
    }
    for (const texto of avisos) {
      ws.mergeCells(`A${f}:C${f}`)
      const c = ws.getCell(`A${f}`)
      c.value = `• ${texto}`
      c.font = { name: 'Calibri', size: 10 }
      c.alignment = { indent: 1, wrapText: true }
      ws.getRow(f).height = 30
      f += 1
    }
  }
}

const hojaRankingLocales = (wb, ctx) => {
  const ws = wb.addWorksheet('Ranking de locales', { views: [{ showGridLines: false }] })
  anchos(ws, [26, 13, 18, 16, 12, 16, 20])
  let f = encabezado(ws, { titulo: 'Ranking de locales', subtitulo: `${ctx.alcanceLabel} · ${ctx.periodoLabel}`, columnas: 7 })
  f = cabecera(ws, f, ['Local', 'Movimientos', 'Volumen cobrado', 'Ticket promedio', '% reversas', '% sin comprobante', 'Última actividad'])
  const filaInicial = f

  const filas = ctx.rankingLocales.map((s) => [
    s.nombre, s.movimientos, n(s.volumenCobrado), n(s.ticketPromedioCobro),
    n(s.pctReversas) * 100, n(s.pctSinComprobante) * 100,
    s.ultimaActividad ? new Date(s.ultimaActividad) : null,
  ])
  f = cuerpo(ws, f, filas, [null, FMT.entero, FMT.moneda, FMT.moneda, FMT.porcentaje, FMT.porcentaje, FMT.fechaHora])

  f = totales(ws, f, [
    `TOTALES (${ctx.rankingLocales.length})`, suma(ctx.rankingLocales, 'movimientos'), suma(ctx.rankingLocales, 'volumenCobrado'), '', '', '', '',
  ], [null, FMT.entero, FMT.moneda])

  ws.autoFilter = { from: { row: filaInicial - 1, column: 1 }, to: { row: filaInicial - 1, column: 7 } }
  ws.views = [{ state: 'frozen', ySplit: filaInicial - 1, showGridLines: false }]
}

const hojaPorOwner = (wb, ctx) => {
  const ws = wb.addWorksheet('Por owner', { views: [{ showGridLines: false }] })
  anchos(ws, [30, 10, 13, 18, 18])
  let f = encabezado(ws, { titulo: 'Por owner', subtitulo: `${ctx.alcanceLabel} · ${ctx.periodoLabel}`, columnas: 5 })
  f = cabecera(ws, f, ['Owner', 'Locales', 'Movimientos', 'Volumen cobrado', 'Volumen gastado'])
  const filaInicial = f

  const filas = ctx.porOwner.map((o) => [o.ownerLabel, o.cantidadLocales, o.movimientos, n(o.volumenCobrado), n(o.volumenGastado)])
  f = cuerpo(ws, f, filas, [null, FMT.entero, FMT.entero, FMT.moneda, FMT.moneda])

  f = totales(ws, f, [
    `TOTALES (${ctx.porOwner.length})`, '', suma(ctx.porOwner, 'movimientos'), suma(ctx.porOwner, 'volumenCobrado'), suma(ctx.porOwner, 'volumenGastado'),
  ], [null, null, FMT.entero, FMT.moneda, FMT.moneda])

  ws.autoFilter = { from: { row: filaInicial - 1, column: 1 }, to: { row: filaInicial - 1, column: 5 } }
  ws.views = [{ state: 'frozen', ySplit: filaInicial - 1, showGridLines: false }]
}

const hojaPorMedioPago = (wb, ctx) => {
  const ws = wb.addWorksheet('Por medio de pago', { views: [{ showGridLines: false }] })
  anchos(ws, [22, 13, 18, 16, 14])
  let f = encabezado(ws, { titulo: 'Por medio de pago', subtitulo: `${ctx.alcanceLabel} · ${ctx.periodoLabel}`, columnas: 5 })
  f = cabecera(ws, f, ['Medio', 'Movimientos', 'Volumen', 'Comisión pagada', '% comisión'])
  const filaInicial = f

  const filas = ctx.porMedioPago.map((m) => [m.label, m.movimientos, n(m.volumen), n(m.comision), n(m.pctComision) * 100])
  f = cuerpo(ws, f, filas, [null, FMT.entero, FMT.moneda, FMT.moneda, FMT.porcentaje])

  f = totales(ws, f, [
    `TOTALES (${ctx.porMedioPago.length})`, suma(ctx.porMedioPago, 'movimientos'), suma(ctx.porMedioPago, 'volumen'), suma(ctx.porMedioPago, 'comision'), '',
  ], [null, FMT.entero, FMT.moneda, FMT.moneda])

  ws.autoFilter = { from: { row: filaInicial - 1, column: 1 }, to: { row: filaInicial - 1, column: 5 } }
  ws.views = [{ state: 'frozen', ySplit: filaInicial - 1, showGridLines: false }]
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/** Grilla día×hora con escala de color nativa de Excel (un solo tono, el de marca). */
const hojaPatronHorario = (wb, ctx) => {
  const { heatmap } = ctx
  const ws = wb.addWorksheet('Patrón horario', { views: [{ showGridLines: false }] })
  anchos(ws, [12, ...Array.from({ length: 24 }, () => 7)])

  let f = encabezado(ws, { titulo: 'Cuándo vende — volumen por día y hora', subtitulo: `${ctx.alcanceLabel} · ${ctx.periodoLabel}`, columnas: 25 })
  f = cabecera(ws, f, ['Día', ...Array.from({ length: 24 }, (_, h) => `${h}hs`)])
  const filaInicial = f

  const porCelda = new Map(heatmap.map((c) => [`${c.dia}-${c.hora}`, c]))
  DIAS.forEach((label, dia) => {
    const row = ws.getRow(f)
    row.getCell(1).value = label
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: true }
    row.getCell(1).border = borde()
    row.getCell(1).alignment = { horizontal: 'left' }
    for (let hora = 0; hora < 24; hora++) {
      const c = porCelda.get(`${dia}-${hora}`)
      const cell = row.getCell(hora + 2)
      cell.value = c ? n(c.volumen) : 0
      cell.numFmt = FMT.monedaSinDecimales
      cell.font = { name: 'Calibri', size: 9 }
      cell.border = borde()
      cell.alignment = { horizontal: 'center' }
    }
    row.height = 17
    f += 1
  })

  // Escala de color nativa (2 colores): blanco → verde de marca, según volumen.
  ws.addConditionalFormatting({
    ref: `B${filaInicial}:Y${filaInicial + DIAS.length - 1}`,
    rules: [{
      type: 'colorScale',
      priority: 1,
      cfvo: [{ type: 'min' }, { type: 'max' }],
      color: [{ argb: 'FFFFFFFF' }, { argb: HEX.verde }],
    }],
  })

  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: filaInicial - 1, showGridLines: false }]
}

const hojaSerieSemanal = (wb, ctx) => {
  const { serie } = ctx
  const ws = wb.addWorksheet('Serie semanal', { views: [{ showGridLines: false }] })
  anchos(ws, [16, 18, 18, 14])
  let f = encabezado(ws, { titulo: 'Serie semanal', subtitulo: `${ctx.alcanceLabel} · ${ctx.periodoLabel}`, columnas: 4 })
  f = cabecera(ws, f, ['Semana de', 'Cobrado', 'Gastado', 'Movimientos'])
  const filaInicial = f

  const filas = serie.map((s) => [s.semana, n(s.volumenCobrado), n(s.volumenGastado), s.movimientos])
  f = cuerpo(ws, f, filas, [null, FMT.moneda, FMT.moneda, FMT.entero])

  f = totales(ws, f, [
    `TOTALES (${serie.length} semanas)`, suma(serie, 'volumenCobrado'), suma(serie, 'volumenGastado'), suma(serie, 'movimientos'),
  ], [null, FMT.moneda, FMT.moneda, FMT.entero])

  ws.autoFilter = { from: { row: filaInicial - 1, column: 1 }, to: { row: filaInicial - 1, column: 4 } }
  ws.views = [{ state: 'frozen', ySplit: filaInicial - 1, showGridLines: false }]
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

/**
 * Arma el libro de análisis para superadmin: resumen ejecutivo, ranking de
 * locales, por owner, por medio de pago, patrón horario y serie semanal.
 * Todo ya viene agregado por lib/domain/analyticsSuperadmin.js y
 * lib/domain/analyticsAvanzado.js a partir del `scope` elegido en la UI —
 * este módulo solo lo vuelca a hojas. Separado de la descarga para poder
 * testearlo, igual que lib/export/excel.js.
 */
export const construirLibroAnalytics = (ctx) => {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'GDT Suite'
  wb.created = new Date()

  hojaResumen(wb, ctx)
  hojaRankingLocales(wb, ctx)
  hojaPorOwner(wb, ctx)
  hojaPorMedioPago(wb, ctx)
  if (ctx.heatmap.length > 0) hojaPatronHorario(wb, ctx)
  if (ctx.serie.length > 0) hojaSerieSemanal(wb, ctx)

  return wb
}

/** Arma el libro y dispara la descarga en el navegador. */
export const generarExcelAnalytics = async (ctx) => {
  const wb = await construirLibroAnalytics(ctx)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo({ nombre: `analisis_${ctx.alcanceArchivo || 'plataforma'}` }, ctx.periodo, 'xlsx')
  a.click()
  URL.revokeObjectURL(url)
}
