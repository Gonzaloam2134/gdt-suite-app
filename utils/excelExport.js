import * as XLSX from 'xlsx-js-style'

export const generateExcelFile = (data, businessName, startDate, endDate) => {
  const { salesRows, expenseRows, methodsMap, calendarMap, totalFacturado, totalNeto, totalIVA, totalComisiones, totalGastos, totalGastosNeto, totalGastosIVA, resultado, hoyStr } = data
  const wb = XLSX.utils.book_new()
  const applyStyle = (ws, cellRef, style) => { if (ws[cellRef]) ws[cellRef].s = style }
  const applyCurrencyFormat = (ws, startRow, endRow, startCol, endCol) => {
    const cols = ['A','B','C','D','E','F','G','H','I','J','K','L']
    const fmt = '$#,##0.00;[Red]-$#,##0.00'
    for (let row = startRow; row <= endRow; row++) {
      for (let colIdx = startCol; colIdx <= endCol; colIdx++) {
        const cellRef = cols[colIdx] + row
        if (ws[cellRef]) ws[cellRef].s = { ...ws[cellRef].s, numFmt: fmt }
      }
    }
  }
  const applyDateFormat = (ws, startRow, endRow, col) => {
    const cols = ['A','B','C','D','E','F','G','H','I','J','K','L']
    for (let row = startRow; row <= endRow; row++) {
      const cellRef = cols[col] + row
      if (ws[cellRef]) ws[cellRef].s = { ...ws[cellRef].s, numFmt: 'DD/MM/YYYY' }
    }
  }
  const applyHeaderStyle = (ws, cols) => {
    cols.forEach(col => { applyStyle(ws, col + '1', { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } }) })
  }
  const applyTotalsStyle = (ws, cols, rowNum) => {
    cols.forEach(col => { applyStyle(ws, col + rowNum, { font: { bold: true, sz: 11 }, fill: { fgColor: { rgb: 'F1F5F9' } }, border: { top: { style: 'double', color: { rgb: '0F172A' } } } }) })
  }
  const resumenData = [['RESUMEN EJECUTIVO',''],['Período:', new Date(startDate).toLocaleDateString('es-AR') + ' - ' + new Date(endDate).toLocaleDateString('es-AR')],['Generado:', new Date().toLocaleString('es-AR')],['',''],['Total Facturado (bruto)',totalFacturado],['(-) IVA Débito Fiscal',-totalIVA],['Neto Gravado',totalNeto],['(-) Comisiones',-totalComisiones],['INGRESO NETO REAL',totalNeto-totalComisiones],['(-) Gastos operativos',-totalGastos],['(-) IVA Crédito Fiscal',-totalGastosIVA],['RESULTADO DEL EJERCICIO',resultado],['',''],['Ventas registradas',salesRows.length],['Gastos registrados',expenseRows.length],['IVA a pagar (neto)',totalIVA-totalGastosIVA]]
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData, { sheetStubs: true })
  wsResumen['!cols'] = [{ wch: 35 }, { wch: 25 }]
  applyStyle(wsResumen, 'A1', { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } })
  applyStyle(wsResumen, 'B1', { fill: { fgColor: { rgb: '1E293B' } } })
  applyStyle(wsResumen, 'A2', { font: { bold: true, sz: 11 } })
  applyStyle(wsResumen, 'A3', { font: { italic: true, color: { rgb: '64748B' }, sz: 10 } })
  applyCurrencyFormat(wsResumen, 5, 12, 1, 1)
  applyCurrencyFormat(wsResumen, 16, 16, 1, 1)
  const rc = resultado >= 0 ? '15803D' : 'B91C1C'
  const rb = resultado >= 0 ? 'F0FDF4' : 'FEF2F2'
  applyStyle(wsResumen, 'A12', { font: { bold: true, sz: 13 }, fill: { fgColor: { rgb: rb } }, border: { top: { style: 'double', color: { rgb: '0F172A' } }, bottom: { style: 'double', color: { rgb: '0F172A' } } } })
  applyStyle(wsResumen, 'B12', { font: { bold: true, sz: 13, color: { rgb: rc } }, fill: { fgColor: { rgb: rb } }, border: { top: { style: 'double', color: { rgb: '0F172A' } }, bottom: { style: 'double', color: { rgb: '0F172A' } } } })
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')
  const ventasData = [['Fecha','Concepto','Medio de Pago','Bruto','Neto','IVA','Comisión','Neto Real']]
  salesRows.forEach(row => ventasData.push([row.fecha, row.concepto, row.medio, row.bruto, row.neto, row.iva, row.comision, row.netoReal]))
  ventasData.push(['TOTALES','','',totalFacturado,totalNeto,totalIVA,totalComisiones,totalNeto-totalComisiones])
  const wsVentas = XLSX.utils.aoa_to_sheet(ventasData)
  wsVentas['!cols'] = [{ wch: 12 },{ wch: 25 },{ wch: 30 },{ wch: 15 },{ wch: 15 },{ wch: 15 },{ wch: 15 },{ wch: 15 }]
  applyHeaderStyle(wsVentas, ['A','B','C','D','E','F','G','H'])
  applyCurrencyFormat(wsVentas, 2, ventasData.length - 1, 3, 7)
  applyDateFormat(wsVentas, 2, ventasData.length - 1, 0)
  applyTotalsStyle(wsVentas, ['A','B','C','D','E','F','G','H'], ventasData.length)
  XLSX.utils.book_append_sheet(wb, wsVentas, 'Libro IVA Ventas')
  const comprasData = [['Fecha','Concepto','Medio de Pago','Bruto','Neto','IVA (Crédito Fiscal)']]
  expenseRows.forEach(row => comprasData.push([row.fecha, row.concepto, row.medio, row.bruto, row.neto, row.iva]))
  comprasData.push(['TOTALES','','',totalGastos,totalGastosNeto,totalGastosIVA])
  const wsCompras = XLSX.utils.aoa_to_sheet(comprasData)
  wsCompras['!cols'] = [{ wch: 12 },{ wch: 25 },{ wch: 30 },{ wch: 15 },{ wch: 15 },{ wch: 20 }]
  applyHeaderStyle(wsCompras, ['A','B','C','D','E','F'])
  applyCurrencyFormat(wsCompras, 2, comprasData.length - 1, 3, 5)
  applyDateFormat(wsCompras, 2, comprasData.length - 1, 0)
  applyTotalsStyle(wsCompras, ['A','B','C','D','E','F'], comprasData.length)
  XLSX.utils.book_append_sheet(wb, wsCompras, 'Libro IVA Compras')
  const mediosHeaders = ['Medio de Pago','Cant. Operaciones','Bruto','IVA','Comisiones','Neto Real']
  const mediosDataForSheet = [mediosHeaders]
  Object.values(methodsMap).sort((a, b) => b.neto - a.neto).forEach(m => { mediosDataForSheet.push([m.nombre, m.cantidad, m.bruto, m.iva, m.comisiones, m.neto - m.comisiones]) })
  const wsMedios = XLSX.utils.aoa_to_sheet(mediosDataForSheet)
  wsMedios['!cols'] = [{ wch: 35 },{ wch: 18 },{ wch: 15 },{ wch: 15 },{ wch: 15 },{ wch: 15 }]
  applyHeaderStyle(wsMedios, ['A','B','C','D','E','F'])
  applyCurrencyFormat(wsMedios, 2, mediosDataForSheet.length, 2, 5)
  XLSX.utils.book_append_sheet(wb, wsMedios, 'Medios de Pago')
  const calendarHeaders = ['Fecha de Acreditación','Estado','Monto a Acreditar']
  const calendarDataForSheet = [calendarHeaders]
  Object.values(calendarMap).sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(c => {
    const isPast = c.fecha < hoyStr
    const isToday = c.fecha === hoyStr
    const estado = isPast ? '✅ Acreditado' : isToday ? '📍 Hoy' : ' Pendiente'
    calendarDataForSheet.push([new Date(c.fecha + 'T12:00:00'), estado, c.total])
  })
  const wsCalendar = XLSX.utils.aoa_to_sheet(calendarDataForSheet)
  wsCalendar['!cols'] = [{ wch: 18 },{ wch: 18 },{ wch: 20 }]
  applyHeaderStyle(wsCalendar, ['A','B','C'])
  applyCurrencyFormat(wsCalendar, 2, calendarDataForSheet.length, 2, 2)
  applyDateFormat(wsCalendar, 2, calendarDataForSheet.length, 0)
  XLSX.utils.book_append_sheet(wb, wsCalendar, 'Calendario')
  const fileName = 'Reporte_' + businessName.replace(/\s+/g, '_') + '_' + startDate + '_' + endDate + '.xlsx'
  XLSX.writeFile(wb, fileName)
}
