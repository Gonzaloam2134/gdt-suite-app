import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatCurrency } from './format'

// ==========================================
// GENERAR PDF - Profesional Contable Argentino
// ==========================================
export const generarReportePDF = (local, fecha, resumen, libroVentas, libroCompras) => {
  try {
    const doc = new jsPDF('landscape', 'mm', 'a4')
    const fechaFormateada = fecha.replace(/_/g, ' al ')

    // HEADER
    doc.setFontSize(10)
    doc.setTextColor(80, 80, 80)
    doc.text('GDT SUITE - Sistema de Gestión', 14, 12)

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 139)
    doc.text(local.nombre.toUpperCase(), 14, 20)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(`Reporte Contable - ${fechaFormateada}`, 14, 26)

    doc.setDrawColor(0, 0, 139)
    doc.setLineWidth(0.5)
    doc.line(14, 28, 283, 28)

    // RESUMEN EJECUTIVO
    let yPos = 35
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('📊 RESUMEN EJECUTIVO', 14, yPos)
    yPos += 8

    const resumenData = [
      ['Total Facturado (bruto)', formatCurrency(resumen.totalFacturado)],
      ['(-) IVA Débito Fiscal', '-' + formatCurrency(resumen.ivaDebitoFiscal)],
      ['Neto Gravado', formatCurrency(resumen.netoGravado)],
      ['(-) Comisiones', '-' + formatCurrency(resumen.comisiones)],
      ['INGRESO NETO REAL', formatCurrency(resumen.ingresoNetoReal)],
      ['(-) Gastos operativos', '-' + formatCurrency(resumen.gastosOperativos)],
      ['(-) IVA Crédito Fiscal', '-' + formatCurrency(resumen.ivaCreditoFiscal)],
      ['RESULTADO DEL EJERCICIO', formatCurrency(resumen.resultadoEjercicio)],
    ]

    autoTable(doc, {
      startY: yPos,
      head: [['Concepto', 'Monto']],
      body: resumenData,
      theme: 'striped',
      headStyles: { fillColor: [0, 0, 139], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 50 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 180 },
        1: { cellWidth: 90, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14 }
    })

    // LIBRO IVA VENTAS
    doc.addPage()
    yPos = 12
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('📘 LIBRO IVA VENTAS (Débito Fiscal)', 14, yPos)
    yPos += 6

    const ventasData = libroVentas.map(v => [
      new Date(v.fecha).toLocaleDateString('es-AR'),
      v.tipo,
      v.numero,
      v.medio,
      formatCurrency(v.total),
      formatCurrency(v.iva),
      formatCurrency(v.neto)
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Fecha', 'Tipo', 'Nro.', 'Medio', 'Total', 'IVA', 'Neto']],
      body: ventasData,
      theme: 'grid',
      headStyles: { fillColor: [255, 165, 0], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 40 },
        4: { cellWidth: 45, halign: 'right' },
        5: { cellWidth: 35, halign: 'right' },
        6: { cellWidth: 45, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    })

    // LIBRO IVA COMPRAS
    if (libroCompras && libroCompras.length > 0) {
      doc.addPage()
      yPos = 12
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('📗 LIBRO IVA COMPRAS (Crédito Fiscal)', 14, yPos)
      yPos += 6

      const comprasData = libroCompras.map(c => [
        new Date(c.fecha).toLocaleDateString('es-AR'),
        c.tipo,
        c.numero,
        c.proveedor,
        formatCurrency(c.total),
        formatCurrency(c.iva),
        formatCurrency(c.neto)
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['Fecha', 'Tipo', 'Nro.', 'Proveedor', 'Total', 'IVA', 'Neto']],
        body: comprasData,
        theme: 'grid',
        headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 70 },
          4: { cellWidth: 45, halign: 'right' },
          5: { cellWidth: 35, halign: 'right' },
          6: { cellWidth: 45, halign: 'right' }
        },
        margin: { left: 14, right: 14 }
      })
    }

    // FOOTER
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text(`Página ${i} de ${pageCount}`, 14, 200)
      doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 200, 200)
    }

    doc.save(`Reporte_${local.nombre.replace(/\s+/g, '_')}_${fecha}.pdf`)
    return true
  } catch (error) {
    console.error('Error generando PDF:', error)
    throw error
  }
}

// ==========================================
// GENERAR EXCEL - Profesional Contable Argentino
// ==========================================
export const generarReporteExcel = (local, fecha, resumen, libroVentas, libroCompras) => {
  try {
    // ==========================================
    // VALIDAR PARÁMETROS (defensivo)
    // ==========================================
    const ventas = Array.isArray(libroVentas) ? libroVentas : []
    const compras = Array.isArray(libroCompras) ? libroCompras : []
    
    const wb = XLSX.utils.book_new()
    const fechaFormateada = fecha.replace(/_/g, ' al ')

    // ==========================================
    // CALCULAR TOTALES AL INICIO
    // ==========================================
    const totalVentas = ventas.reduce((sum, v) => sum + (v.total || 0), 0)
    const totalIvaVentas = ventas.reduce((sum, v) => sum + (v.iva || 0), 0)
    const totalNetoVentas = ventas.reduce((sum, v) => sum + (v.neto || 0), 0)
    
    const totalCompras = compras.reduce((sum, c) => sum + (c.total || 0), 0)
    const totalIvaCompras = compras.reduce((sum, c) => sum + (c.iva || 0), 0)
    const totalNetoCompras = compras.reduce((sum, c) => sum + (c.neto || 0), 0)

    // ==========================================
    // HOJA 1: PORTADA / RESUMEN EJECUTIVO
    // ==========================================
    const portadaData = [
      ['GDT SUITE - SISTEMA DE GESTIÓN'],
      [''],
      ['REPORTE CONTABLE COMPLETO'],
      [''],
      ['Local:', local?.nombre || 'Sin nombre'],
      ['Período:', fechaFormateada],
      ['Generado:', new Date().toLocaleString('es-AR')],
      [''],
      ['═══════════════════════════════════════'],
      [''],
      ['RESUMEN EJECUTIVO'],
      [''],
      ['CONCEPTO', 'MONTO'],
      ['Total Facturado (bruto)', resumen?.totalFacturado || 0],
      ['(-) IVA Débito Fiscal', -(resumen?.ivaDebitoFiscal || 0)],
      ['Neto Gravado', resumen?.netoGravado || 0],
      ['(-) Comisiones medios de pago', -(resumen?.comisiones || 0)],
      ['═══════════════════════════════════════', ''],
      ['INGRESO NETO REAL', resumen?.ingresoNetoReal || 0],
      [''],
      ['(-) Gastos operativos', -(resumen?.gastosOperativos || 0)],
      ['(-) IVA Crédito Fiscal', -(resumen?.ivaCreditoFiscal || 0)],
      ['═══════════════════════════════════════', ''],
      ['RESULTADO DEL EJERCICIO', resumen?.resultadoEjercicio || 0],
      [''],
      ['═══════════════════════════════════════'],
      [''],
      ['INDICADORES CLAVE'],
      ['Ventas (cantidad)', resumen?.cantidadVentas || 0],
      ['Gastos (cantidad)', resumen?.cantidadGastos || 0],
      ['IVA a pagar', resumen?.ivaAPagar || 0],
      [''],
      ['═══════════════════════════════════════'],
      [''],
      ['Este reporte incluye:'],
      ['✓ Libro IVA Ventas'],
      ['✓ Libro IVA Compras'],
      ['✓ Resumen por Condición de IVA'],
      ['✓ Resumen por Medio de Pago'],
      ['✓ Libro Caja'],
    ]

    const wsPortada = XLSX.utils.aoa_to_sheet(portadaData)
    wsPortada['!cols'] = [{ wch: 50 }, { wch: 25 }]
    wsPortada['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
      { s: { r: 8, c: 0 }, e: { r: 8, c: 1 } },
      { s: { r: 10, c: 0 }, e: { r: 10, c: 1 } },
      { s: { r: 18, c: 0 }, e: { r: 18, c: 1 } },
      { s: { r: 23, c: 0 }, e: { r: 23, c: 1 } },
      { s: { r: 26, c: 0 }, e: { r: 26, c: 1 } },
    ]
    XLSX.utils.book_append_sheet(wb, wsPortada, ' RESUMEN')

    // ==========================================
    // HOJA 2: LIBRO IVA VENTAS
    // ==========================================
    const ventasData = [
      ['LIBRO IVA VENTAS - DÉBITO FISCAL'],
      ['Período:', fechaFormateada],
      [''],
      ['Fecha', 'Tipo', 'Punto Venta', 'Nro. Comprobante', 'Medio de Pago', 'Descripción', 'Importe Total', 'IVA 21%', 'Neto Gravado'],
      ...ventas.map(v => [
        new Date(v.fecha).toLocaleDateString('es-AR'),
        v.tipo || '-',
        v.punto_venta || '0001',
        v.numero || '-',
        v.medio || '-',
        v.descripcion || '-',
        v.total || 0,
        v.iva || 0,
        v.neto || 0
      ])
    ]

    ventasData.push([])
    ventasData.push(['TOTALES', '', '', '', '', '', totalVentas, totalIvaVentas, totalNetoVentas])

    const wsVentas = XLSX.utils.aoa_to_sheet(ventasData)
    wsVentas['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
      { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ]
    XLSX.utils.book_append_sheet(wb, wsVentas, '📘 IVA VENTAS')

    // ==========================================
    // HOJA 3: LIBRO IVA COMPRAS
    // ==========================================
    const comprasData = [
      ['LIBRO IVA COMPRAS - CRÉDITO FISCAL'],
      ['Período:', fechaFormateada],
      [''],
      ['Fecha', 'Tipo', 'Punto Venta', 'Nro. Comprobante', 'Proveedor', 'Importe Total', 'IVA 21%', 'Neto Gravado'],
      ...compras.map(c => [
        new Date(c.fecha).toLocaleDateString('es-AR'),
        c.tipo || '-',
        c.punto_venta || '0001',
        c.numero || '-',
        c.proveedor || '-',
        c.total || 0,
        c.iva || 0,
        c.neto || 0
      ])
    ]

    if (compras.length > 0) {
      comprasData.push([])
      comprasData.push(['TOTALES', '', '', '', '', totalCompras, totalIvaCompras, totalNetoCompras])
    }

    const wsCompras = XLSX.utils.aoa_to_sheet(comprasData)
    wsCompras['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
      { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ]
    XLSX.utils.book_append_sheet(wb, wsCompras, ' IVA COMPRAS')

    // ==========================================
    // HOJA 4: RESUMEN POR CONDICIÓN DE IVA
    // ==========================================
    const condicionIvaMap = {}
    ventas.forEach(v => {
      const condicion = v.tipo || 'Factura A'
      if (!condicionIvaMap[condicion]) {
        condicionIvaMap[condicion] = { cantidad: 0, total: 0, iva: 0, neto: 0 }
      }
      condicionIvaMap[condicion].cantidad++
      condicionIvaMap[condicion].total += v.total || 0
      condicionIvaMap[condicion].iva += v.iva || 0
      condicionIvaMap[condicion].neto += v.neto || 0
    })

    const condicionData = [
      ['RESUMEN POR CONDICIÓN DE IVA'],
      [''],
      ['Condición', 'Cantidad', 'Total Facturado', 'IVA', 'Neto Gravado'],
      ...Object.entries(condicionIvaMap).map(([condicion, datos]) => [
        condicion,
        datos.cantidad,
        datos.total,
        datos.iva,
        datos.neto
      ])
    ]

    const wsCondicion = XLSX.utils.aoa_to_sheet(condicionData)
    wsCondicion['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, wsCondicion, '📋 RESUMEN IVA')

    // ==========================================
    // HOJA 5: RESUMEN POR MEDIO DE PAGO
    // ==========================================
    const medioPagoMap = {}
    ventas.forEach(v => {
      const medio = v.medio || 'Efectivo'
      if (!medioPagoMap[medio]) {
        medioPagoMap[medio] = { cantidad: 0, total: 0 }
      }
      medioPagoMap[medio].cantidad++
      medioPagoMap[medio].total += v.total || 0
    })

    const totalFacturado = resumen?.totalFacturado || 0
    const medioData = [
      ['RESUMEN POR MEDIO DE PAGO'],
      [''],
      ['Medio de Pago', 'Cantidad', 'Total', 'Porcentaje'],
      ...Object.entries(medioPagoMap).map(([medio, datos]) => [
        medio,
        datos.cantidad,
        datos.total,
        totalFacturado > 0 ? ((datos.total / totalFacturado) * 100).toFixed(2) + '%' : '0%'
      ])
    ]

    const wsMedio = XLSX.utils.aoa_to_sheet(medioData)
    wsMedio['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsMedio, '💳 MEDIOS PAGO')

    // ==========================================
    // HOJA 6: LIBRO CAJA
    // ==========================================
    const libroCajaData = [
      ['LIBRO CAJA'],
      ['Período:', fechaFormateada],
      [''],
      ['Fecha', 'Descripción', 'Ingreso', 'Egreso', 'Saldo'],
    ]

    const movimientosCaja = []
    
    ventas.forEach(v => {
      movimientosCaja.push({
        fecha: v.fecha,
        descripcion: `Venta ${v.numero || '-'} - ${v.descripcion || '-'}`,
        ingreso: v.total || 0,
        egreso: 0
      })
    })

    compras.forEach(c => {
      movimientosCaja.push({
        fecha: c.fecha,
        descripcion: `Compra ${c.numero || '-'} - ${c.proveedor || '-'}`,
        ingreso: 0,
        egreso: c.total || 0
      })
    })

    movimientosCaja.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

    let saldo = 0
    movimientosCaja.forEach(mov => {
      saldo += mov.ingreso - mov.egreso
      libroCajaData.push([
        new Date(mov.fecha).toLocaleDateString('es-AR'),
        mov.descripcion,
        mov.ingreso,
        mov.egreso,
        saldo
      ])
    })

    libroCajaData.push([])
    libroCajaData.push(['TOTALES', '', totalVentas, totalCompras, saldo])

    const wsCaja = XLSX.utils.aoa_to_sheet(libroCajaData)
    wsCaja['!cols'] = [
      { wch: 12 }, { wch: 50 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
    ]
    XLSX.utils.book_append_sheet(wb, wsCaja, '📒 LIBRO CAJA')

    // ==========================================
    // HOJA 7: CONCILIACIÓN BANCARIA
    // ==========================================
    const conciliacionData = [
      ['CONCILIACIÓN BANCARIA'],
      ['Período:', fechaFormateada],
      [''],
      ['CONCEPTO', 'IMPORTE'],
      ['Saldo inicial', 0],
      ['(+) Cobros del período', totalFacturado],
      ['(-) Gastos del período', -(resumen?.gastosOperativos || 0)],
      ['(-) Comisiones', -(resumen?.comisiones || 0)],
      ['(-) IVA a pagar', -(resumen?.ivaAPagar || 0)],
      ['════════════════════════════', ''],
      ['SALDO FINAL ESPERADO', resumen?.resultadoEjercicio || 0],
      [''],
      ['OBSERVACIONES:'],
      ['Verificar que el saldo final coincida con el extracto bancario'],
      ['Pendientes de acreditación:', resumen?.pendiente || 0],
    ]

    const wsConciliacion = XLSX.utils.aoa_to_sheet(conciliacionData)
    wsConciliacion['!cols'] = [{ wch: 40 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsConciliacion, '🏦 CONCILIACIÓN')

    // Guardar Excel
    const nombreArchivo = `Reporte_Completo_${(local?.nombre || 'Local').replace(/\s+/g, '_')}_${fecha}.xlsx`
    XLSX.writeFile(wb, nombreArchivo)
    return true
  } catch (error) {
    console.error('Error generando Excel:', error)
    throw error
  }
}