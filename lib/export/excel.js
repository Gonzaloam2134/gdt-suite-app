import ExcelJS from 'exceljs'
import { formatFecha } from '../format'
import { LABEL_TIPO_MEDIO } from '../constants/mediosPago'
import { HEX, FMT, etiquetaComprobante, numeroComprobante, nombreArchivo } from './estilos'

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const periodoTexto = (p) => `${formatFecha(p.desde + 'T12:00:00')} al ${formatFecha(p.hasta + 'T12:00:00')}`

// ---------------------------------------------------------------------------
// Helpers de formato
// ---------------------------------------------------------------------------

const borde = (color = HEX.linea) => ({
  top: { style: 'thin', color: { argb: color } },
  left: { style: 'thin', color: { argb: color } },
  bottom: { style: 'thin', color: { argb: color } },
  right: { style: 'thin', color: { argb: color } },
})

const fondo = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

const letraColumna = (i) => {
  let s = ''
  let x = i
  while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26) }
  return s
}

/** Título de la hoja: qué es y a qué local y período corresponde. */
const encabezado = (ws, { titulo, subtitulo, columnas }) => {
  const ultima = letraColumna(columnas)

  ws.mergeCells(`A1:${ultima}1`)
  const t = ws.getCell('A1')
  t.value = titulo
  t.font = { name: 'Calibri', size: 15, bold: true, color: { argb: HEX.blanco } }
  t.fill = fondo(HEX.azul)
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(1).height = 28

  ws.mergeCells(`A2:${ultima}2`)
  const s = ws.getCell('A2')
  s.value = subtitulo
  s.font = { name: 'Calibri', size: 10, color: { argb: HEX.blanco } }
  s.fill = fondo(HEX.azulMedio)
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(2).height = 18

  ws.getRow(3).height = 6
  return 4
}

const cabecera = (ws, fila, titulos) => {
  const row = ws.getRow(fila)
  titulos.forEach((t, i) => {
    const c = row.getCell(i + 1)
    c.value = t
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: HEX.blanco } }
    c.fill = fondo(HEX.azulMedio)
    c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', wrapText: true }
    c.border = borde(HEX.azul)
  })
  row.height = 22
  return fila + 1
}

/** Cuerpo con cebra, bordes y formato numérico por columna. */
const cuerpo = (ws, filaInicial, filas, formatos) => {
  filas.forEach((datos, idx) => {
    const row = ws.getRow(filaInicial + idx)
    datos.forEach((valor, i) => {
      const c = row.getCell(i + 1)
      c.value = valor
      c.font = { name: 'Calibri', size: 10 }
      c.border = borde()
      if (idx % 2 === 1) c.fill = fondo(HEX.grisClaro)
      const fmt = formatos?.[i]
      if (fmt && typeof valor === 'number') {
        c.numFmt = fmt
        c.alignment = { horizontal: 'right' }
      } else if (i === 0) {
        c.alignment = { horizontal: 'left' }
      } else {
        c.alignment = { horizontal: 'center' }
      }
    })
    row.height = 17
  })
  return filaInicial + filas.length
}

const totales = (ws, fila, datos, formatos) => {
  const row = ws.getRow(fila)
  datos.forEach((valor, i) => {
    const c = row.getCell(i + 1)
    c.value = valor
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: HEX.azul } }
    c.fill = fondo(HEX.azulClaro)
    c.border = { ...borde(HEX.azul), top: { style: 'double', color: { argb: HEX.azul } } }
    const fmt = formatos?.[i]
    if (fmt && typeof valor === 'number') { c.numFmt = fmt; c.alignment = { horizontal: 'right' } }
    else c.alignment = { horizontal: i === 0 ? 'left' : 'center' }
  })
  row.height = 20
  return fila + 1
}

const anchos = (ws, valores) => { ws.columns = valores.map(w => ({ width: w })) }

const tituloSeccion = (ws, fila, texto, columnas, color = HEX.azul, relleno = HEX.azulClaro) => {
  ws.mergeCells(`A${fila}:${letraColumna(columnas)}${fila}`)
  const c = ws.getCell(`A${fila}`)
  c.value = texto
  c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: color } }
  c.fill = fondo(relleno)
  c.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(fila).height = 20
  return fila + 1
}

/** Bloque concepto / importe del resumen. */
const bloqueResumen = (ws, fila, titulo, filas) => {
  let f = tituloSeccion(ws, fila, titulo, 3)

  for (const [label, valor, opciones = {}] of filas) {
    const row = ws.getRow(f)
    ws.mergeCells(`A${f}:B${f}`)
    const l = row.getCell(1)
    l.value = label
    l.font = { name: 'Calibri', size: 10, bold: !!opciones.destacada, color: { argb: opciones.destacada ? HEX.azul : HEX.negro } }
    l.alignment = { indent: opciones.sangria ? 3 : 1 }
    l.border = borde()
    if (opciones.destacada) l.fill = fondo(HEX.azulClaro)

    const v = row.getCell(3)
    v.value = n(valor)
    v.numFmt = FMT.moneda
    v.font = {
      name: 'Calibri', size: opciones.destacada ? 11 : 10, bold: !!opciones.destacada,
      color: { argb: opciones.color || (opciones.destacada ? HEX.azul : HEX.negro) },
    }
    v.alignment = { horizontal: 'right' }
    v.border = borde()
    if (opciones.destacada) v.fill = fondo(HEX.azulClaro)
    row.height = opciones.destacada ? 20 : 17
    f += 1
  }
  return f + 1
}

// ---------------------------------------------------------------------------
// Hojas
// ---------------------------------------------------------------------------

const hojaResumen = (wb, ctx) => {
  const { local, periodo, resumen, calidad, conciliacion, discriminaIva } = ctx
  const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] })
  anchos(ws, [40, 18, 20])

  let f = encabezado(ws, {
    titulo: local.nombre,
    subtitulo: `Reporte contable · ${periodoTexto(periodo)}`,
    columnas: 3,
  })

  const meta = [
    ['Condición fiscal', local.condicion_fiscal || 'No especificada'],
    ['Período', periodoTexto(periodo)],
    ['Generado', formatFecha(new Date())],
    ['Movimientos incluidos', `${calidad.total}${calidad.anuladas ? ` (${calidad.anuladas} anulados excluidos)` : ''}`],
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

  f = bloqueResumen(ws, f, 'RESULTADO DEL PERÍODO', [
    ['Total facturado (bruto)', resumen.totalFacturado],
    ...(discriminaIva ? [
      ['(-) IVA débito fiscal', -resumen.ivaDebitoFiscal, { sangria: true, color: HEX.rojo }],
      ['Neto gravado', resumen.netoGravado, { sangria: true }],
    ] : []),
    ['(-) Comisiones de medios de pago', -resumen.comisiones, { sangria: true, color: HEX.rojo }],
    ['Ingreso neto real', resumen.ingresoNetoReal, { destacada: true }],
    ['(-) Gastos operativos', -resumen.gastosOperativos, { sangria: true, color: HEX.rojo }],
    ...(discriminaIva ? [['(+) IVA crédito fiscal', resumen.ivaCreditoFiscal, { sangria: true, color: HEX.verde }]] : []),
    ['RESULTADO', resumen.resultadoEjercicio, { destacada: true, color: resumen.resultadoEjercicio >= 0 ? HEX.verde : HEX.rojo }],
  ])

  if (discriminaIva) {
    f = bloqueResumen(ws, f, 'POSICIÓN IVA', [
      ['IVA débito fiscal (ventas)', resumen.ivaDebitoFiscal],
      ['IVA crédito fiscal (compras)', -resumen.ivaCreditoFiscal],
      [resumen.ivaAPagar >= 0 ? 'Saldo a pagar' : 'Saldo a favor', Math.abs(resumen.ivaAPagar),
        { destacada: true, color: resumen.ivaAPagar >= 0 ? HEX.rojo : HEX.verde }],
    ])
  }

  if (conciliacion.cierres > 0) {
    f = bloqueResumen(ws, f, 'CONCILIACIÓN DE CAJA', [
      ['Diferencia acumulada', conciliacion.totalDiferencia,
        { destacada: true, color: conciliacion.totalDiferencia < 0 ? HEX.rojo : HEX.verde }],
    ])
    ws.mergeCells(`A${f - 1}:C${f - 1}`)
    const nota = ws.getCell(`A${f - 1}`)
    nota.value = `${conciliacion.cierres} cierres · ${conciliacion.cuadrados} cuadraron · ${conciliacion.diasFaltante} con faltante · ${conciliacion.diasSobrante} con sobrante · ${conciliacion.sinContar} sin contar efectivo`
    nota.font = { name: 'Calibri', size: 9, italic: true, color: { argb: HEX.gris } }
    nota.alignment = { indent: 1, wrapText: true }
    f += 1
  }

  f = tituloSeccion(ws, f, 'SOBRE LA CALIDAD DE ESTE REPORTE', 3, HEX.ambar, HEX.ambarClaro)
  const avisos = calidad.avisos.length ? calidad.avisos.map(a => a.texto) : ['Sin observaciones.']
  for (const texto of avisos) {
    ws.mergeCells(`A${f}:C${f}`)
    const c = ws.getCell(`A${f}`)
    c.value = `• ${texto}`
    c.font = { name: 'Calibri', size: 10 }
    c.alignment = { indent: 1, wrapText: true }
    ws.getRow(f).height = 17
    f += 1
  }

  f += 1
  ws.mergeCells(`A${f}:C${f}`)
  const pie = ws.getCell(`A${f}`)
  pie.value = 'Generado a partir de los movimientos cargados en el sistema. No reemplaza la liquidación de un profesional.'
  pie.font = { name: 'Calibri', size: 9, italic: true, color: { argb: HEX.gris } }
  pie.alignment = { indent: 1, wrapText: true }
  ws.getRow(f).height = 26
}

const hojaLibro = (wb, ctx, tipo) => {
  const { local, periodo, resumen, discriminaIva } = ctx
  const esVentas = tipo === 'ventas'
  const filas = esVentas ? ctx.libroVentas : ctx.libroCompras
  const ws = wb.addWorksheet(esVentas ? 'IVA Ventas' : 'IVA Compras', { views: [{ showGridLines: false }] })

  const titulos = esVentas
    ? ['Fecha', 'Comprobante', 'Número', 'Medio de pago', 'Detalle', 'Neto', 'Alíc.', 'IVA', 'Total', 'Comisión']
    : ['Fecha', 'Comprobante', 'Número', 'Proveedor / concepto', 'Neto', 'Alíc.', 'IVA', 'Total']

  const formatos = esVentas
    ? [null, null, null, null, null, FMT.moneda, FMT.porcentaje, FMT.moneda, FMT.moneda, FMT.moneda]
    : [null, null, null, null, FMT.moneda, FMT.porcentaje, FMT.moneda, FMT.moneda]

  anchos(ws, esVentas ? [12, 16, 16, 20, 26, 15, 8, 14, 15, 13] : [12, 16, 16, 32, 15, 8, 14, 15])

  let f = encabezado(ws, {
    titulo: esVentas ? 'Libro IVA Ventas' : 'Libro IVA Compras',
    subtitulo: `${local.nombre} · ${periodoTexto(periodo)}`,
    columnas: titulos.length,
  })

  const filaCabecera = f
  f = cabecera(ws, f, titulos)

  const cuerpoFilas = filas.map(x => (esVentas
    ? [new Date(x.fecha), etiquetaComprobante(x.tipo), numeroComprobante(x.punto_venta, x.numero) || '—',
       x.medio || '—', x.descripcion || '—', n(x.neto), n(x.alicuota), n(x.iva), n(x.total), n(x.comision)]
    : [new Date(x.fecha), etiquetaComprobante(x.tipo), numeroComprobante(x.punto_venta, x.numero) || '—',
       x.proveedor || '—', n(x.neto), n(x.alicuota), n(x.iva), n(x.total)]))

  f = cuerpo(ws, f, cuerpoFilas, formatos)
  cuerpoFilas.forEach((_, i) => { ws.getRow(filaCabecera + 1 + i).getCell(1).numFmt = FMT.fecha })

  if (filas.length) {
    const totalNeto = esVentas ? resumen.netoGravado : resumen.gastosOperativos - resumen.ivaCreditoFiscal
    const totalIva = esVentas ? resumen.ivaDebitoFiscal : resumen.ivaCreditoFiscal
    const total = esVentas ? resumen.totalFacturado : resumen.gastosOperativos
    totales(ws, f, esVentas
      ? [`TOTALES (${filas.length})`, '', '', '', '', totalNeto, '', totalIva, total, resumen.comisiones]
      : [`TOTALES (${filas.length})`, '', '', '', totalNeto, '', totalIva, total], formatos)
  }

  ws.views = [{ state: 'frozen', ySplit: filaCabecera, showGridLines: false }]
  ws.autoFilter = { from: { row: filaCabecera, column: 1 }, to: { row: filaCabecera, column: titulos.length } }

  if (!discriminaIva) {
    const colAlic = esVentas ? 7 : 6
    ws.getColumn(colAlic).hidden = true
    ws.getColumn(colAlic + 1).hidden = true
  }
}

const hojaAlicuotas = (wb, ctx) => {
  const { local, periodo, porAlicuotaVentas, porAlicuotaCompras } = ctx
  const ws = wb.addWorksheet('Resumen IVA', { views: [{ showGridLines: false }] })
  anchos(ws, [16, 12, 18, 18, 18])

  let f = encabezado(ws, {
    titulo: 'Resumen por alícuota',
    subtitulo: `${local.nombre} · ${periodoTexto(periodo)}`,
    columnas: 5,
  })

  const formatos = [FMT.porcentaje, FMT.entero, FMT.moneda, FMT.moneda, FMT.moneda]

  for (const [titulo, datos] of [['VENTAS', porAlicuotaVentas], ['COMPRAS', porAlicuotaCompras]]) {
    f = tituloSeccion(ws, f, titulo, 5)
    f = cabecera(ws, f, ['Alícuota', 'Cantidad', 'Neto', 'IVA', 'Total'])
    if (datos.length === 0) {
      const c = ws.getCell(`A${f}`)
      c.value = 'Sin movimientos en el período'
      c.font = { name: 'Calibri', size: 10, italic: true, color: { argb: HEX.gris } }
      f += 2
    } else {
      f = cuerpo(ws, f, datos.map(a => [n(a.alicuota), a.cantidad, n(a.neto), n(a.iva), n(a.total)]), formatos)
      f = totales(ws, f, [
        'TOTAL', datos.reduce((s, a) => s + a.cantidad, 0),
        datos.reduce((s, a) => s + n(a.neto), 0),
        datos.reduce((s, a) => s + n(a.iva), 0),
        datos.reduce((s, a) => s + n(a.total), 0),
      ], [null, FMT.entero, FMT.moneda, FMT.moneda, FMT.moneda])
      f += 1
    }
  }
}

const hojaMedios = (wb, ctx) => {
  const { local, periodo, porMedio, resumen } = ctx
  const ws = wb.addWorksheet('Medios de pago', { views: [{ showGridLines: false }] })
  anchos(ws, [24, 20, 12, 18, 16, 18, 12])

  let f = encabezado(ws, {
    titulo: 'Cobros por medio de pago',
    subtitulo: `${local.nombre} · ${periodoTexto(periodo)}`,
    columnas: 7,
  })

  f = cabecera(ws, f, ['Medio', 'Tipo', 'Cantidad', 'Total cobrado', 'Comisión', 'Neto acreditado', '% del total'])
  const formatos = [null, null, FMT.entero, FMT.moneda, FMT.moneda, FMT.moneda, FMT.porcentaje]

  f = cuerpo(ws, f, porMedio.map(m => [
    m.nombre, LABEL_TIPO_MEDIO[m.tipo] || m.tipo, m.cantidad,
    n(m.total), n(m.comisiones), n(m.neto),
    resumen.totalFacturado ? (m.total / resumen.totalFacturado) * 100 : 0,
  ]), formatos)

  if (porMedio.length) {
    totales(ws, f, [
      'TOTAL', '', porMedio.reduce((s, m) => s + m.cantidad, 0),
      resumen.totalFacturado, resumen.comisiones, resumen.ingresoNetoReal, 100,
    ], formatos)
  }
}

const hojaLibroCaja = (wb, ctx) => {
  const { local, periodo, porDia } = ctx
  const ws = wb.addWorksheet('Libro caja', { views: [{ showGridLines: false }] })
  anchos(ws, [16, 14, 18, 18, 18])

  let f = encabezado(ws, {
    titulo: 'Movimientos por día',
    subtitulo: `${local.nombre} · ${periodoTexto(periodo)}`,
    columnas: 5,
  })

  const filaCabecera = f
  f = cabecera(ws, f, ['Fecha', 'Movimientos', 'Ventas', 'Gastos', 'Resultado'])
  const formatos = [null, FMT.entero, FMT.moneda, FMT.moneda, FMT.moneda]

  f = cuerpo(ws, f, porDia.map(d => [new Date(d.fecha + 'T12:00:00'), d.cantidad, n(d.ventas), n(d.gastos), n(d.resultado)]), formatos)
  porDia.forEach((_, i) => { ws.getRow(filaCabecera + 1 + i).getCell(1).numFmt = FMT.fecha })

  if (porDia.length) {
    totales(ws, f, [
      'TOTAL', porDia.reduce((s, d) => s + d.cantidad, 0),
      porDia.reduce((s, d) => s + n(d.ventas), 0),
      porDia.reduce((s, d) => s + n(d.gastos), 0),
      porDia.reduce((s, d) => s + n(d.resultado), 0),
    ], formatos)
  }

  ws.views = [{ state: 'frozen', ySplit: filaCabecera, showGridLines: false }]
}

const hojaConciliacion = (wb, ctx) => {
  const { local, periodo, cierres, conciliacion } = ctx
  const ws = wb.addWorksheet('Conciliación caja', { views: [{ showGridLines: false }] })
  anchos(ws, [18, 16, 16, 16, 18, 16, 34])

  let f = encabezado(ws, {
    titulo: 'Conciliación de caja',
    subtitulo: `${local.nombre} · ${periodoTexto(periodo)}`,
    columnas: 7,
  })

  const resumenFilas = [
    ['Cierres registrados', conciliacion.cierres],
    ['Días que cuadraron', conciliacion.cuadrados],
    ['Días con faltante', conciliacion.diasFaltante],
    ['Días con sobrante', conciliacion.diasSobrante],
    ['Cierres sin contar efectivo', conciliacion.sinContar],
  ]
  for (const [label, valor] of resumenFilas) {
    const row = ws.getRow(f)
    ws.mergeCells(`A${f}:B${f}`)
    row.getCell(1).value = label
    row.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: HEX.gris } }
    row.getCell(1).alignment = { indent: 1 }
    row.getCell(3).value = valor
    row.getCell(3).font = { name: 'Calibri', size: 10, bold: true }
    row.height = 16
    f += 1
  }

  const row = ws.getRow(f)
  ws.mergeCells(`A${f}:B${f}`)
  row.getCell(1).value = 'Diferencia acumulada'
  row.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: HEX.azul } }
  row.getCell(1).alignment = { indent: 1 }
  row.getCell(3).value = n(conciliacion.totalDiferencia)
  row.getCell(3).numFmt = FMT.moneda
  row.getCell(3).font = { name: 'Calibri', size: 11, bold: true, color: { argb: conciliacion.totalDiferencia < 0 ? HEX.rojo : HEX.verde } }
  f += 2

  const filaCabecera = f
  f = cabecera(ws, f, ['Fecha cierre', 'Inicial', 'Cobrado', 'Gastado', 'Efectivo contado', 'Diferencia', 'Observaciones'])
  const formatos = [null, FMT.moneda, FMT.moneda, FMT.moneda, FMT.moneda, FMT.moneda, null]

  f = cuerpo(ws, f, cierres.map(c => [
    new Date(c.fecha_cierre), n(c.monto_inicial_efectivo), n(c.total_cobrado), n(c.total_gastado),
    c.efectivo_fisico == null ? 'No contado' : n(c.efectivo_fisico),
    c.diferencia_efectivo == null ? '—' : n(c.diferencia_efectivo),
    c.observaciones || '',
  ]), formatos)

  // La diferencia se pinta según cuadre, faltante o sobrante: se lee de un vistazo
  cierres.forEach((c, i) => {
    const fila = ws.getRow(filaCabecera + 1 + i)
    fila.getCell(1).numFmt = FMT.fechaHora
    const celda = fila.getCell(6)
    if (c.diferencia_efectivo == null) return
    const d = n(c.diferencia_efectivo)
    const [relleno, color] = d === 0
      ? [HEX.verdeClaro, HEX.verde]
      : d < 0 ? [HEX.rojoClaro, HEX.rojo] : [HEX.azulClaro, HEX.azulMedio]
    celda.fill = fondo(relleno)
    celda.font = { name: 'Calibri', size: 10, bold: true, color: { argb: color } }
  })

  ws.views = [{ state: 'frozen', ySplit: filaCabecera, showGridLines: false }]
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

/**
 * Arma el libro completo para el contador: resumen, libros IVA con autofiltro y
 * panel fijo, resumen por alícuota, medios de pago, libro caja diario y conciliación.
 * Los importes van como números con formato de moneda, así se pueden sumar.
 * Separado de la descarga para poder testearlo.
 */
export const construirLibro = (ctx) => {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'GDT Suite'
  wb.created = new Date()

  hojaResumen(wb, ctx)
  hojaLibro(wb, ctx, 'ventas')
  hojaLibro(wb, ctx, 'compras')
  if (ctx.discriminaIva) hojaAlicuotas(wb, ctx)
  hojaMedios(wb, ctx)
  hojaLibroCaja(wb, ctx)
  if (ctx.cierres?.length) hojaConciliacion(wb, ctx)

  return wb
}

/** Arma el libro y dispara la descarga en el navegador. */
export const generarExcel = async (ctx) => {
  const wb = construirLibro(ctx)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo(ctx.local, ctx.periodo, 'xlsx')
  a.click()
  URL.revokeObjectURL(url)
}
