import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatFecha } from '../format'

const TIPO_LABEL = { A: 'Fac. A', B: 'Fac. B', C: 'Fac. C', M: 'Fac. M', TICKET: 'Ticket', SIN_COMPROBANTE: 'Sin compr.' }
const AZUL = [30, 58, 95]

/** Resumen imprimible del período. El detalle completo va en el Excel. */
export const generarPDF = ({ local, periodo, resumen, libroVentas, libroCompras, porMedio, conciliacion, calidad }) => {
  const doc = new jsPDF('landscape', 'mm', 'a4')
  const ancho = doc.internal.pageSize.getWidth()

  doc.setFontSize(9); doc.setTextColor(120)
  doc.text('GDT Suite', 14, 12)
  doc.setFontSize(17); doc.setFont('helvetica', 'bold'); doc.setTextColor(...AZUL)
  doc.text(local.nombre, 14, 20)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(0)
  doc.text(`Reporte contable · ${formatFecha(periodo.desde + 'T12:00:00')} al ${formatFecha(periodo.hasta + 'T12:00:00')}`, 14, 26)
  doc.setFontSize(8); doc.setTextColor(120)
  doc.text(`Condición fiscal: ${local.condicion_fiscal || 'no especificada'} · Emitido ${formatFecha(new Date())}`, 14, 31)
  doc.setDrawColor(...AZUL); doc.setLineWidth(0.4); doc.line(14, 34, ancho - 14, 34)

  autoTable(doc, {
    startY: 40,
    head: [['Resultado del período', 'Importe']],
    body: [
      ['Total facturado (bruto)', formatCurrency(resumen.totalFacturado)],
      ['(-) IVA débito fiscal', `-${formatCurrency(resumen.ivaDebitoFiscal)}`],
      ['Neto gravado', formatCurrency(resumen.netoGravado)],
      ['(-) Comisiones de medios de pago', `-${formatCurrency(resumen.comisiones)}`],
      ['Ingreso neto real', formatCurrency(resumen.ingresoNetoReal)],
      ['(-) Gastos operativos', `-${formatCurrency(resumen.gastosOperativos)}`],
      ['(+) IVA crédito fiscal', formatCurrency(resumen.ivaCreditoFiscal)],
      ['RESULTADO', formatCurrency(resumen.resultadoEjercicio)],
      ['Posición IVA del período', formatCurrency(resumen.ivaAPagar)],
    ],
    theme: 'striped',
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right', cellWidth: 45 } },
    margin: { left: 14 }, tableWidth: 165, styles: { fontSize: 9 },
    didParseCell: (d) => { if (d.row.index === 7) d.cell.styles.fontStyle = 'bold' },
  })

  if (porMedio.length) {
    autoTable(doc, {
      startY: 40,
      head: [['Medio de pago', 'Cant.', 'Total', 'Comisión', 'Neto']],
      body: porMedio.map(m => [m.nombre, m.cantidad, formatCurrency(m.total), formatCurrency(m.comisiones), formatCurrency(m.neto)]),
      theme: 'striped',
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
      margin: { left: 188 }, tableWidth: ancho - 202,
      styles: { fontSize: 8 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    })
  }

  let y = Math.max(doc.lastAutoTable?.finalY || 100, 100) + 8

  if (calidad.avisos.length) {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 80, 0)
    doc.text('Observaciones sobre la calidad del dato', 14, y); y += 5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80)
    for (const a of calidad.avisos) { doc.text(`• ${a.texto}`, 16, y); y += 4 }
    y += 4
  }

  if (conciliacion.cierres > 0) {
    doc.setFontSize(8); doc.setTextColor(80)
    doc.text(
      `Caja: ${conciliacion.cierres} cierres · ${conciliacion.cuadrados} cuadraron · ${conciliacion.diasFaltante} con faltante · ` +
      `${conciliacion.diasSobrante} con sobrante · diferencia acumulada ${formatCurrency(conciliacion.totalDiferencia)}`, 14, y)
    y += 8
  }

  const tabla = (titulo, cabecera, filas) => {
    if (!filas.length) return
    doc.addPage()
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...AZUL)
    doc.text(titulo, 14, 16)
    autoTable(doc, {
      startY: 22, head: [cabecera], body: filas, theme: 'grid',
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
    })
  }

  tabla('Libro IVA Ventas',
    ['Fecha', 'Compr.', 'PV', 'Número', 'Medio', 'Neto', 'Alíc.', 'IVA', 'Total'],
    libroVentas.map(v => [
      formatFecha(v.fecha), TIPO_LABEL[v.tipo] || v.tipo, v.punto_venta ?? '-', v.numero ?? '-', v.medio || '-',
      formatCurrency(v.neto), `${v.alicuota}%`, formatCurrency(v.iva), formatCurrency(v.total),
    ]))

  tabla('Libro IVA Compras',
    ['Fecha', 'Compr.', 'PV', 'Número', 'Proveedor', 'Neto', 'Alíc.', 'IVA', 'Total'],
    libroCompras.map(c => [
      formatFecha(c.fecha), TIPO_LABEL[c.tipo] || c.tipo, c.punto_venta ?? '-', c.numero ?? '-', c.proveedor || '-',
      formatCurrency(c.neto), `${c.alicuota}%`, formatCurrency(c.iva), formatCurrency(c.total),
    ]))

  const paginas = doc.internal.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(150)
    doc.text(
      'Reporte generado a partir de los movimientos cargados en el sistema. No reemplaza la liquidación de un profesional.',
      14, doc.internal.pageSize.getHeight() - 8)
    doc.text(`${i} / ${paginas}`, ancho - 20, doc.internal.pageSize.getHeight() - 8)
  }

  doc.save(`${local.nombre.replace(/[^\w\s-]/g, '').trim()} ${periodo.desde} a ${periodo.hasta}.pdf`)
}
