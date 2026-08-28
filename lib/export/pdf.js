import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatFecha } from '../format'
import { LABEL_TIPO_MEDIO } from '../constants/mediosPago'
import { RGB, etiquetaComprobante, numeroComprobante, nombreArchivo } from './estilos'

const MARGEN = 14
const periodoTexto = (p) => `${formatFecha(p.desde + 'T12:00:00')} al ${formatFecha(p.hasta + 'T12:00:00')}`

/** Estilo común de todas las tablas, para que el documento se lea parejo. */
const tabla = (doc, opciones) => autoTable(doc, {
  theme: 'grid',
  headStyles: { fillColor: RGB.azul, textColor: RGB.blanco, fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
  bodyStyles: { fontSize: 8, textColor: RGB.negro, cellPadding: 2 },
  alternateRowStyles: { fillColor: RGB.grisClaro },
  styles: { lineColor: RGB.linea, lineWidth: 0.1, font: 'helvetica' },
  margin: { left: MARGEN, right: MARGEN },
  ...opciones,
})

/** Portada: de qué local es, qué período cubre y los tres números que importan. */
const portada = (doc, { local, periodo, resumen, calidad }) => {
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()

  doc.setFillColor(...RGB.azul)
  doc.rect(0, 0, ancho, 58, 'F')

  doc.setTextColor(...RGB.blanco)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text('GDT SUITE', MARGEN, 16)

  doc.setFontSize(24); doc.setFont('helvetica', 'bold')
  doc.text(doc.splitTextToSize(local.nombre, ancho - MARGEN * 2)[0], MARGEN, 32)

  doc.setFontSize(12); doc.setFont('helvetica', 'normal')
  doc.text('Reporte contable', MARGEN, 42)
  doc.setFontSize(10)
  doc.text(periodoTexto(periodo), MARGEN, 50)

  let y = 74
  doc.setTextColor(...RGB.gris); doc.setFontSize(9)
  doc.text(`Condición fiscal: ${local.condicion_fiscal || 'no especificada'}`, MARGEN, y)
  doc.text(`Emitido el ${formatFecha(new Date())}`, ancho - MARGEN, y, { align: 'right' })
  y += 12

  // Tres cifras grandes: facturado, resultado, movimientos
  const anchoCaja = (ancho - MARGEN * 2 - 12) / 3
  const cajas = [
    { titulo: 'TOTAL FACTURADO', valor: formatCurrency(resumen.totalFacturado), color: RGB.azul },
    { titulo: 'RESULTADO', valor: formatCurrency(resumen.resultadoEjercicio), color: resumen.resultadoEjercicio >= 0 ? RGB.verde : RGB.rojo },
    { titulo: 'MOVIMIENTOS', valor: String(calidad.total), color: RGB.gris },
  ]
  cajas.forEach((c, i) => {
    const x = MARGEN + i * (anchoCaja + 6)
    doc.setFillColor(...RGB.grisClaro)
    doc.setDrawColor(...RGB.linea)
    doc.roundedRect(x, y, anchoCaja, 26, 2, 2, 'FD')
    doc.setFontSize(7.5); doc.setTextColor(...RGB.gris); doc.setFont('helvetica', 'bold')
    doc.text(c.titulo, x + 5, y + 8)
    doc.setFontSize(14); doc.setTextColor(...c.color)
    doc.text(c.valor, x + 5, y + 19)
  })
  y += 38

  if (calidad.avisos.length) {
    doc.setFillColor(253, 243, 226)
    doc.setDrawColor(230, 200, 150)
    const altura = 12 + calidad.avisos.length * 6
    doc.roundedRect(MARGEN, y, ancho - MARGEN * 2, altura, 2, 2, 'FD')
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...RGB.ambar)
    doc.text('Sobre la calidad de este reporte', MARGEN + 5, y + 8)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...RGB.negro)
    calidad.avisos.forEach((a, i) => {
      const lineas = doc.splitTextToSize(`• ${a.texto}`, ancho - MARGEN * 2 - 12)
      doc.text(lineas[0], MARGEN + 5, y + 15 + i * 6)
    })
    y += altura + 10
  }

  doc.setFontSize(8); doc.setTextColor(...RGB.gris); doc.setFont('helvetica', 'italic')
  doc.text(
    doc.splitTextToSize(
      'Este reporte se genera a partir de los movimientos cargados en el sistema. No reemplaza la liquidación de un profesional.',
      ancho - MARGEN * 2),
    MARGEN, alto - 22)

  return y
}

/** Título de sección, con línea debajo. */
const seccion = (doc, texto, y) => {
  const ancho = doc.internal.pageSize.getWidth()
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...RGB.azul)
  doc.text(texto, MARGEN, y)
  doc.setDrawColor(...RGB.azul); doc.setLineWidth(0.4)
  doc.line(MARGEN, y + 2, ancho - MARGEN, y + 2)
  return y + 8
}

const paginaNueva = (doc, titulo) => {
  doc.addPage()
  return seccion(doc, titulo, 20)
}

const pie = (doc) => {
  const paginas = doc.internal.getNumberOfPages()
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...RGB.gris)
    if (i > 1) doc.text('GDT Suite · Reporte contable', MARGEN, alto - 8)
    doc.text(`Página ${i} de ${paginas}`, ancho - MARGEN, alto - 8, { align: 'right' })
  }
}

/**
 * Reporte completo listo para entregar: portada, resultado, posición IVA,
 * medios de pago, resumen por alícuota, libros IVA, libro caja y conciliación.
 */
export const construirPDF = (ctx) => {
  const { local, periodo, resumen, libroVentas, libroCompras, porAlicuotaVentas, porAlicuotaCompras,
          porMedio, porDia, cierres, conciliacion, calidad, discriminaIva } = ctx

  const doc = new jsPDF('portrait', 'mm', 'a4')
  portada(doc, ctx)

  // --- Resultado del período ---
  let y = paginaNueva(doc, 'Resultado del período')
  tabla(doc, {
    startY: y,
    head: [['Concepto', 'Importe']],
    body: [
      ['Total facturado (bruto)', formatCurrency(resumen.totalFacturado)],
      ...(discriminaIva ? [
        ['   (-) IVA débito fiscal', `-${formatCurrency(resumen.ivaDebitoFiscal)}`],
        ['   Neto gravado', formatCurrency(resumen.netoGravado)],
      ] : []),
      ['   (-) Comisiones de medios de pago', `-${formatCurrency(resumen.comisiones)}`],
      ['Ingreso neto real', formatCurrency(resumen.ingresoNetoReal)],
      ['   (-) Gastos operativos', `-${formatCurrency(resumen.gastosOperativos)}`],
      ...(discriminaIva ? [['   (+) IVA crédito fiscal', formatCurrency(resumen.ivaCreditoFiscal)]] : []),
      ['RESULTADO DEL PERÍODO', formatCurrency(resumen.resultadoEjercicio)],
    ],
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (d) => {
      if (d.section !== 'body') return
      const label = String(d.row.raw[0])
      if (label.startsWith('RESULTADO') || label.startsWith('Ingreso neto')) {
        d.cell.styles.fontStyle = 'bold'
        d.cell.styles.fillColor = RGB.azulClaro
        d.cell.styles.textColor = RGB.azul
      } else if (label.trim().startsWith('(-)')) {
        if (d.column.index === 1) d.cell.styles.textColor = RGB.rojo
      }
    },
  })
  y = doc.lastAutoTable.finalY + 10

  if (discriminaIva) {
    y = seccion(doc, 'Posición IVA', y)
    tabla(doc, {
      startY: y,
      head: [['Concepto', 'Importe']],
      body: [
        ['IVA débito fiscal (ventas)', formatCurrency(resumen.ivaDebitoFiscal)],
        ['IVA crédito fiscal (compras)', `-${formatCurrency(resumen.ivaCreditoFiscal)}`],
        [resumen.ivaAPagar >= 0 ? 'Saldo a pagar' : 'Saldo a favor', formatCurrency(Math.abs(resumen.ivaAPagar))],
      ],
      columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.row.index === 2) {
          d.cell.styles.fontStyle = 'bold'
          d.cell.styles.fillColor = RGB.azulClaro
          d.cell.styles.textColor = resumen.ivaAPagar >= 0 ? RGB.rojo : RGB.verde
        }
      },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  if (porMedio.length) {
    y = seccion(doc, 'Cobros por medio de pago', y)
    tabla(doc, {
      startY: y,
      head: [['Medio', 'Tipo', 'Cant.', 'Total', 'Comisión', 'Neto', '%']],
      body: porMedio.map(m => [
        m.nombre, LABEL_TIPO_MEDIO[m.tipo] || m.tipo, m.cantidad,
        formatCurrency(m.total), formatCurrency(m.comisiones), formatCurrency(m.neto),
        resumen.totalFacturado ? `${Math.round((m.total / resumen.totalFacturado) * 100)}%` : '—',
      ]),
      foot: [['TOTAL', '', porMedio.reduce((s, m) => s + m.cantidad, 0),
              formatCurrency(resumen.totalFacturado), formatCurrency(resumen.comisiones),
              formatCurrency(resumen.ingresoNetoReal), '100%']],
      footStyles: { fillColor: RGB.azulClaro, textColor: RGB.azul, fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    })
  }

  // --- Resumen por alícuota ---
  if (discriminaIva && (porAlicuotaVentas.length || porAlicuotaCompras.length)) {
    y = paginaNueva(doc, 'Resumen por alícuota')
    for (const [titulo, datos] of [['Ventas', porAlicuotaVentas], ['Compras', porAlicuotaCompras]]) {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...RGB.negro)
      doc.text(titulo, MARGEN, y)
      tabla(doc, {
        startY: y + 3,
        head: [['Alícuota', 'Cantidad', 'Neto', 'IVA', 'Total']],
        body: datos.length
          ? datos.map(a => [`${a.alicuota}%`, a.cantidad, formatCurrency(a.neto), formatCurrency(a.iva), formatCurrency(a.total)])
          : [['—', '0', formatCurrency(0), formatCurrency(0), formatCurrency(0)]],
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      })
      y = doc.lastAutoTable.finalY + 10
    }
  }

  // --- Libros IVA ---
  const libro = (titulo, cabecera, filas, totalesFila) => {
    if (!filas.length) return
    const yy = paginaNueva(doc, titulo)
    tabla(doc, {
      startY: yy,
      head: [cabecera],
      body: filas,
      foot: totalesFila ? [totalesFila] : undefined,
      footStyles: { fillColor: RGB.azulClaro, textColor: RGB.azul, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.6, lineColor: RGB.linea, lineWidth: 0.1 },
      columnStyles: discriminaIva
        ? { 4: { halign: 'right' }, 5: { halign: 'center' }, 6: { halign: 'right' }, 7: { halign: 'right' } }
        : { 4: { halign: 'right' } },
      showFoot: 'lastPage',
    })
  }

  libro('Libro IVA Ventas',
    discriminaIva
      ? ['Fecha', 'Comprobante', 'Número', 'Medio', 'Neto', 'Alíc.', 'IVA', 'Total']
      : ['Fecha', 'Comprobante', 'Número', 'Medio', 'Total'],
    libroVentas.map(v => discriminaIva
      ? [formatFecha(v.fecha), etiquetaComprobante(v.tipo), numeroComprobante(v.punto_venta, v.numero) || '—',
         v.medio || '—', formatCurrency(v.neto), `${v.alicuota}%`, formatCurrency(v.iva), formatCurrency(v.total)]
      : [formatFecha(v.fecha), etiquetaComprobante(v.tipo), numeroComprobante(v.punto_venta, v.numero) || '—',
         v.medio || '—', formatCurrency(v.total)]),
    discriminaIva
      ? [`TOTALES (${libroVentas.length})`, '', '', '', formatCurrency(resumen.netoGravado), '',
         formatCurrency(resumen.ivaDebitoFiscal), formatCurrency(resumen.totalFacturado)]
      : [`TOTALES (${libroVentas.length})`, '', '', '', formatCurrency(resumen.totalFacturado)])

  libro('Libro IVA Compras',
    discriminaIva
      ? ['Fecha', 'Comprobante', 'Número', 'Proveedor', 'Neto', 'Alíc.', 'IVA', 'Total']
      : ['Fecha', 'Comprobante', 'Número', 'Proveedor', 'Total'],
    libroCompras.map(c => discriminaIva
      ? [formatFecha(c.fecha), etiquetaComprobante(c.tipo), numeroComprobante(c.punto_venta, c.numero) || '—',
         c.proveedor || '—', formatCurrency(c.neto), `${c.alicuota}%`, formatCurrency(c.iva), formatCurrency(c.total)]
      : [formatFecha(c.fecha), etiquetaComprobante(c.tipo), numeroComprobante(c.punto_venta, c.numero) || '—',
         c.proveedor || '—', formatCurrency(c.total)]),
    discriminaIva
      ? [`TOTALES (${libroCompras.length})`, '', '', '',
         formatCurrency(resumen.gastosOperativos - resumen.ivaCreditoFiscal), '',
         formatCurrency(resumen.ivaCreditoFiscal), formatCurrency(resumen.gastosOperativos)]
      : [`TOTALES (${libroCompras.length})`, '', '', '', formatCurrency(resumen.gastosOperativos)])

  // --- Libro caja ---
  if (porDia.length) {
    const yy = paginaNueva(doc, 'Movimientos por día')
    tabla(doc, {
      startY: yy,
      head: [['Fecha', 'Movimientos', 'Ventas', 'Gastos', 'Resultado']],
      body: porDia.map(d => [
        formatFecha(d.fecha + 'T12:00:00'), d.cantidad,
        formatCurrency(d.ventas), formatCurrency(d.gastos), formatCurrency(d.resultado),
      ]),
      foot: [['TOTAL', porDia.reduce((s, d) => s + d.cantidad, 0),
              formatCurrency(porDia.reduce((s, d) => s + d.ventas, 0)),
              formatCurrency(porDia.reduce((s, d) => s + d.gastos, 0)),
              formatCurrency(porDia.reduce((s, d) => s + d.resultado, 0))]],
      footStyles: { fillColor: RGB.azulClaro, textColor: RGB.azul, fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 4) {
          const valor = porDia[d.row.index]?.resultado ?? 0
          d.cell.styles.textColor = valor < 0 ? RGB.rojo : RGB.negro
        }
      },
    })
  }

  // --- Conciliación de caja ---
  if (cierres.length) {
    let yy = paginaNueva(doc, 'Conciliación de caja')
    tabla(doc, {
      startY: yy,
      head: [['Cierres', 'Cuadraron', 'Con faltante', 'Con sobrante', 'Sin contar', 'Diferencia acumulada']],
      body: [[conciliacion.cierres, conciliacion.cuadrados, conciliacion.diasFaltante,
              conciliacion.diasSobrante, conciliacion.sinContar, formatCurrency(conciliacion.totalDiferencia)]],
      columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'center' },
                      3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'right', fontStyle: 'bold' } },
    })
    yy = doc.lastAutoTable.finalY + 8

    tabla(doc, {
      startY: yy,
      head: [['Fecha cierre', 'Inicial', 'Cobrado', 'Gastado', 'Contado', 'Diferencia', 'Observaciones']],
      body: cierres.map(c => [
        formatFecha(c.fecha_cierre), formatCurrency(c.monto_inicial_efectivo),
        formatCurrency(c.total_cobrado), formatCurrency(c.total_gastado),
        c.efectivo_fisico == null ? 'No contado' : formatCurrency(c.efectivo_fisico),
        c.diferencia_efectivo == null ? '—' : formatCurrency(c.diferencia_efectivo),
        c.observaciones || '',
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.6, lineColor: RGB.linea, lineWidth: 0.1 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
                      4: { halign: 'right' }, 5: { halign: 'right' }, 6: { cellWidth: 40 } },
      didParseCell: (d) => {
        if (d.section !== 'body' || d.column.index !== 5) return
        const dif = cierres[d.row.index]?.diferencia_efectivo
        if (dif == null) return
        d.cell.styles.fontStyle = 'bold'
        d.cell.styles.textColor = dif === 0 ? RGB.verde : dif < 0 ? RGB.rojo : RGB.azul
      },
    })
  }

  pie(doc)
  return doc
}

/** Arma el PDF y dispara la descarga. */
export const generarPDF = (ctx) => {
  const doc = construirPDF(ctx)
  doc.save(nombreArchivo(ctx.local, ctx.periodo, 'pdf'))
}
