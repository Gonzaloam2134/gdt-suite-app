import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'
import * as XLSX from 'xlsx-js-style'
import { formatCurrency } from '../lib/format'

export default function Reportes() {
  const [user, setUser] = useState(null)
  const [businessName, setBusinessName] = useState('Mi Negocio')
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [showExportModal, setShowExportModal] = useState(false)
  
  const [summary, setSummary] = useState(null)
  const [salesBook, setSalesBook] = useState([])
  const [expensesBook, setExpensesBook] = useState([])
  const [methodSummary, setMethodSummary] = useState([])
  const [calendar, setCalendar] = useState([])
  
  const router = useRouter()
  const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

  const hoy = new Date()
  const hoyStr = hoy.toISOString().split('T')[0]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.push('/') } 
      else {
        setUser(session.user)
        if (activeLocalId) loadReportes(selectedMonth)
        else router.push('/locales')
      }
    })
  }, [router, activeLocalId])

  useEffect(() => { if (user && activeLocalId) loadReportes(selectedMonth) }, [selectedMonth])

  const loadReportes = async (monthDate) => {
    try {
      setLoading(true)
      const { data: localData } = await supabase.from('locales').select('nombre').eq('id', activeLocalId).single()
      if (localData) setBusinessName(localData.nombre)

      const primerDiaMes = new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0)).toISOString()
      const ultimoDiaMes = new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)).toISOString()

      const { data: mediosData } = await supabase.from('medios_pago').select('id, nombre, banco_emisor, dias_acreditacion, tipo_comision, valor_comision').eq('local_id', activeLocalId)
      const mediosMap = new Map()
      if (mediosData) mediosData.forEach(m => mediosMap.set(m.id, m))

      const { data: transacciones } = await supabase.from('transacciones').select('*').eq('local_id', activeLocalId).gte('creado_en', primerDiaMes).lte('creado_en', ultimoDiaMes)

      if (transacciones && transacciones.length > 0) {
        let totalFacturado = 0, totalNeto = 0, totalIVA = 0, totalComisiones = 0, totalGastos = 0, totalGastosNeto = 0, totalGastosIVA = 0
        const salesRows = [], expenseRows = [], methodsMap = {}, calendarMap = {}

        transacciones.forEach(t => {
          const medio = mediosMap.get(t.medio_pago_id) || { nombre: 'Sin Medio', banco_emisor: '', dias_acreditacion: 0, tipo_comision: 'NINGUNA', valor_comision: 0 }
          const key = medio.banco_emisor ? `${medio.nombre} (${medio.banco_emisor})` : medio.nombre

          if (t.tipo === 'COBRO_RECIBIDO') {
            const monto = t.monto || 0
            const comision = medio.tipo_comision === 'PORCENTAJE' ? (monto * (medio.valor_comision || 0)) / 100 : 0
            const iva = t.monto_iva || (monto - monto / 1.21)
            const neto = t.monto_neto || (monto - iva)

            totalFacturado += monto
            totalNeto += neto
            totalIVA += iva
            totalComisiones += comision

            salesRows.push({
              fecha: new Date(t.creado_en).toLocaleDateString('es-AR'),
              concepto: t.descripcion || 'Venta',
              medio: key,
              bruto: monto,
              neto: neto,
              iva: iva,
              comision: comision,
              netoReal: neto - comision
            })

            if (!methodsMap[key]) methodsMap[key] = { nombre: key, bruto: 0, neto: 0, iva: 0, comisiones: 0, cantidad: 0 }
            methodsMap[key].bruto += monto
            methodsMap[key].neto += neto
            methodsMap[key].iva += iva
            methodsMap[key].comisiones += comision
            methodsMap[key].cantidad++

            let fechaAcred = t.fecha_acreditacion_estimada
            if (!fechaAcred) {
              const d = new Date(t.creado_en)
              d.setDate(d.getDate() + (medio.dias_acreditacion || 0))
              fechaAcred = d.toISOString().split('T')[0]
            }
            if (!calendarMap[fechaAcred]) calendarMap[fechaAcred] = { fecha: fechaAcred, total: 0 }
            calendarMap[fechaAcred].total += (neto - comision)

          } else if (t.tipo === 'GASTO_REGISTRADO') {
            const monto = t.monto || 0
            const iva = t.monto_iva || (monto - monto / 1.21)
            const neto = t.monto_neto || (monto - iva)
            totalGastos += monto
            totalGastosNeto += neto
            totalGastosIVA += iva

            expenseRows.push({
              fecha: new Date(t.creado_en).toLocaleDateString('es-AR'),
              concepto: t.descripcion || 'Gasto',
              medio: key,
              bruto: monto,
              neto: neto,
              iva: iva
            })
          }
        })

        setSummary({
          totalFacturado, totalNeto, totalIVA, totalComisiones,
          totalGastos, totalGastosNeto, totalGastosIVA,
          resultado: totalNeto - totalComisiones - totalGastos,
          cantVentas: salesRows.length,
          cantGastos: expenseRows.length
        })
        setSalesBook(salesRows.sort((a, b) => a.fecha.localeCompare(b.fecha)))
        setExpensesBook(expenseRows.sort((a, b) => a.fecha.localeCompare(b.fecha)))
        setMethodSummary(Object.values(methodsMap).sort((a, b) => b.neto - a.neto))
        setCalendar(Object.values(calendarMap).sort((a, b) => a.fecha.localeCompare(b.fecha)))
      } else {
        setSummary(null); setSalesBook([]); setExpensesBook([]); setMethodSummary([]); setCalendar([])
      }
    } catch (err) { console.error('Error:', err) } finally { setLoading(false) }
  }

  const handleExportExcel = async () => {
    if (!exportStartDate || !exportEndDate) {
      alert('⚠️ Seleccioná fecha de inicio y fin')
      return
    }

    try {
      setLoading(true)
      const start = new Date(exportStartDate + 'T00:00:00').toISOString()
      const end = new Date(exportEndDate + 'T23:59:59').toISOString()

      const { data: mediosData } = await supabase.from('medios_pago').select('id, nombre, banco_emisor, dias_acreditacion, tipo_comision, valor_comision').eq('local_id', activeLocalId)
      const mediosMap = new Map()
      if (mediosData) mediosData.forEach(m => mediosMap.set(m.id, m))

      const { data: transacciones } = await supabase.from('transacciones').select('*').eq('local_id', activeLocalId).gte('creado_en', start).lte('creado_en', end)

      if (!transacciones || transacciones.length === 0) {
        alert(' No hay datos en el período seleccionado')
        setLoading(false)
        return
      }

      let totalFacturado = 0, totalNeto = 0, totalIVA = 0, totalComisiones = 0, totalGastos = 0, totalGastosNeto = 0, totalGastosIVA = 0
      const salesRows = [], expenseRows = [], methodsMap = {}, calendarMap = {}

      transacciones.forEach(t => {
        const medio = mediosMap.get(t.medio_pago_id) || { nombre: 'Sin Medio', banco_emisor: '', dias_acreditacion: 0, tipo_comision: 'NINGUNA', valor_comision: 0 }
        const key = medio.banco_emisor ? `${medio.nombre} (${medio.banco_emisor})` : medio.nombre

        if (t.tipo === 'COBRO_RECIBIDO') {
          const monto = t.monto || 0
          const comision = medio.tipo_comision === 'PORCENTAJE' ? (monto * (medio.valor_comision || 0)) / 100 : 0
          const iva = t.monto_iva || (monto - monto / 1.21)
          const neto = t.monto_neto || (monto - iva)

          totalFacturado += monto
          totalNeto += neto
          totalIVA += iva
          totalComisiones += comision

          salesRows.push({
            fecha: new Date(t.creado_en).toLocaleDateString('es-AR'),
            concepto: t.descripcion || 'Venta',
            medio: key,
            bruto: monto,
            neto: neto,
            iva: iva,
            comision: comision,
            netoReal: neto - comision
          })

          if (!methodsMap[key]) methodsMap[key] = { nombre: key, bruto: 0, neto: 0, iva: 0, comisiones: 0, cantidad: 0 }
          methodsMap[key].bruto += monto
          methodsMap[key].neto += neto
          methodsMap[key].iva += iva
          methodsMap[key].comisiones += comision
          methodsMap[key].cantidad++

          let fechaAcred = t.fecha_acreditacion_estimada
          if (!fechaAcred) {
            const d = new Date(t.creado_en)
            d.setDate(d.getDate() + (medio.dias_acreditacion || 0))
            fechaAcred = d.toISOString().split('T')[0]
          }
          if (!calendarMap[fechaAcred]) calendarMap[fechaAcred] = { fecha: fechaAcred, total: 0 }
          calendarMap[fechaAcred].total += (neto - comision)

        } else if (t.tipo === 'GASTO_REGISTRADO') {
          const monto = t.monto || 0
          const iva = t.monto_iva || (monto - monto / 1.21)
          const neto = t.monto_neto || (monto - iva)
          totalGastos += monto
          totalGastosNeto += neto
          totalGastosIVA += iva

          expenseRows.push({
            fecha: new Date(t.creado_en).toLocaleDateString('es-AR'),
            concepto: t.descripcion || 'Gasto',
            medio: key,
            bruto: monto,
            neto: neto,
            iva: iva
          })
        }
      })

      const resultado = totalNeto - totalComisiones - totalGastos
      const wb = XLSX.utils.book_new()

      const applyStyle = (ws, cellRef, style) => {
        if (ws[cellRef]) {
          ws[cellRef].s = style
        }
      }

      const applyCurrencyFormat = (ws, startRow, endRow, startCol, endCol) => {
        const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
        const fmt = '$#,##0.00;[Red]-$#,##0.00'
        
        for (let row = startRow; row <= endRow; row++) {
          for (let colIdx = startCol; colIdx <= endCol; colIdx++) {
            const cellRef = `${cols[colIdx]}${row}`
            if (ws[cellRef]) {
              ws[cellRef].s = { ...ws[cellRef].s, numFmt: fmt }
            }
          }
        }
      }

      // HOJA 1: RESUMEN
      const resumenData = [
        ['RESUMEN EJECUTIVO', ''],
        ['Período:', `${new Date(exportStartDate).toLocaleDateString('es-AR')} - ${new Date(exportEndDate).toLocaleDateString('es-AR')}`],
        ['Generado:', new Date().toLocaleString('es-AR')],
        ['', ''],
        ['Total Facturado (bruto)', totalFacturado],
        ['(-) IVA Débito Fiscal', -totalIVA],
        ['Neto Gravado', totalNeto],
        ['(-) Comisiones de medios de pago', -totalComisiones],
        ['INGRESO NETO REAL', totalNeto - totalComisiones],
        ['(-) Gastos operativos', -totalGastos],
        ['(-) IVA Crédito Fiscal (compras)', -totalGastosIVA],
        ['RESULTADO DEL EJERCICIO', resultado],
        ['', ''],
        ['Ventas registradas', salesRows.length],
        ['Gastos registrados', expenseRows.length],
        ['IVA a pagar (neto)', totalIVA - totalGastosIVA]
      ]
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenData, { sheetStubs: true })
      
      wsResumen['!cols'] = [{ wch: 35 }, { wch: 25 }]
      
      applyStyle(wsResumen, 'A1', { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } })
      applyStyle(wsResumen, 'B1', { fill: { fgColor: { rgb: '1E293B' } } })
      applyStyle(wsResumen, 'A2', { font: { bold: true, sz: 11 } })
      applyStyle(wsResumen, 'A3', { font: { italic: true, color: { rgb: '64748B' }, sz: 10 } })
      applyCurrencyFormat(wsResumen, 5, 12, 1, 1)
      applyCurrencyFormat(wsResumen, 16, 16, 1, 1)
      
      const resultadoColor = resultado >= 0 ? '15803D' : 'B91C1C'
      const resultadoBg = resultado >= 0 ? 'F0FDF4' : 'FEF2F2'
      applyStyle(wsResumen, 'A12', { font: { bold: true, sz: 13 }, fill: { fgColor: { rgb: resultadoBg } }, border: { top: { style: 'double', color: { rgb: '0F172A' } }, bottom: { style: 'double', color: { rgb: '0F172A' } } } })
      applyStyle(wsResumen, 'B12', { font: { bold: true, sz: 13, color: { rgb: resultadoColor } }, fill: { fgColor: { rgb: resultadoBg } }, border: { top: { style: 'double', color: { rgb: '0F172A' } }, bottom: { style: 'double', color: { rgb: '0F172A' } } } })
      
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

      // HOJA 2: LIBRO IVA VENTAS
      const ventasData = [
        ['Fecha', 'Concepto', 'Medio de Pago', 'Bruto', 'Neto', 'IVA', 'Comisión', 'Neto Real']
      ]
      
      salesRows.forEach(row => {
        ventasData.push([row.fecha, row.concepto, row.medio, row.bruto, row.neto, row.iva, row.comision, row.netoReal])
      })
      
      ventasData.push(['TOTALES', '', '', totalFacturado, totalNeto, totalIVA, totalComisiones, totalNeto - totalComisiones])
      
      const wsVentas = XLSX.utils.aoa_to_sheet(ventasData)
      wsVentas['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }]
      
      for (let col = 0; col < 8; col++) {
        const cellRef = `A1,B1,C1,D1,E1,F1,G1,H1`.split(',')[col]
        applyStyle(wsVentas, cellRef, { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } })
      }
      
      const lastRowVentas = ventasData.length
      applyCurrencyFormat(wsVentas, 2, lastRowVentas, 3, 7)
      
      const totalesRowVentas = lastRowVentas
      for (let col = 0; col < 8; col++) {
        const cellRef = `${['A','B','C','D','E','F','G','H'][col]}${totalesRowVentas}`
        applyStyle(wsVentas, cellRef, { font: { bold: true, sz: 11 }, fill: { fgColor: { rgb: 'F1F5F9' } }, border: { top: { style: 'double', color: { rgb: '0F172A' } } } })
      }
      
      XLSX.utils.book_append_sheet(wb, wsVentas, 'Libro IVA Ventas')

      // HOJA 3: LIBRO IVA COMPRAS
      const comprasData = [
        ['Fecha', 'Concepto', 'Medio de Pago', 'Bruto', 'Neto', 'IVA (Crédito Fiscal)']
      ]
      
      expenseRows.forEach(row => {
        comprasData.push([row.fecha, row.concepto, row.medio, row.bruto, row.neto, row.iva])
      })
      
      comprasData.push(['TOTALES', '', '', totalGastos, totalGastosNeto, totalGastosIVA])
      
      const wsCompras = XLSX.utils.aoa_to_sheet(comprasData)
      wsCompras['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }]
      
      for (let col = 0; col < 6; col++) {
        const cellRef = `A1,B1,C1,D1,E1,F1`.split(',')[col]
        applyStyle(wsCompras, cellRef, { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } })
      }
      
      const lastRowCompras = comprasData.length
      applyCurrencyFormat(wsCompras, 2, lastRowCompras, 3, 5)
      
      const totalesRowCompras = lastRowCompras
      for (let col = 0; col < 6; col++) {
        const cellRef = `${['A','B','C','D','E','F'][col]}${totalesRowCompras}`
        applyStyle(wsCompras, cellRef, { font: { bold: true, sz: 11 }, fill: { fgColor: { rgb: 'F1F5F9' } }, border: { top: { style: 'double', color: { rgb: '0F172A' } } } })
      }
      
      XLSX.utils.book_append_sheet(wb, wsCompras, 'Libro IVA Compras')

      // HOJA 4: MEDIOS DE PAGO
      const mediosHeaders = ['Medio de Pago', 'Cant. Operaciones', 'Bruto', 'IVA', 'Comisiones', 'Neto Real']
      const mediosDataForSheet = [mediosHeaders]
      
      const mediosDataArray = Object.values(methodsMap).sort((a, b) => b.neto - a.neto)
      mediosDataArray.forEach(m => {
        mediosDataForSheet.push([m.nombre, m.cantidad, m.bruto, m.iva, m.comisiones, m.neto - m.comisiones])
      })
      
      const wsMedios = XLSX.utils.aoa_to_sheet(mediosDataForSheet)
      wsMedios['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }]
      
      for (let col = 0; col < 6; col++) {
        const cellRef = `${['A','B','C','D','E','F'][col]}1`
        applyStyle(wsMedios, cellRef, { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } })
      }
      
      const lastRowMedios = mediosDataForSheet.length
      applyCurrencyFormat(wsMedios, 2, lastRowMedios, 2, 5)
      
      XLSX.utils.book_append_sheet(wb, wsMedios, 'Medios de Pago')

      // HOJA 5: CALENDARIO
      const calendarHeaders = ['Fecha de Acreditación', 'Estado', 'Monto a Acreditar']
      const calendarDataForSheet = [calendarHeaders]
      
      const calendarSorted = Object.values(calendarMap).sort((a, b) => a.fecha.localeCompare(b.fecha))
      calendarSorted.forEach(c => {
        const isPast = c.fecha < hoyStr
        const isToday = c.fecha === hoyStr
        const estado = isPast ? '✅ Acreditado' : isToday ? '📍 Hoy' : ' Pendiente'
        const fechaCompleta = new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        calendarDataForSheet.push([fechaCompleta, estado, c.total])
      })
      
      const wsCalendar = XLSX.utils.aoa_to_sheet(calendarDataForSheet)
      wsCalendar['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 20 }]
      
      for (let col = 0; col < 3; col++) {
        const cellRef = `${['A','B','C'][col]}1`
        applyStyle(wsCalendar, cellRef, { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } })
      }
      
      const lastRowCalendar = calendarDataForSheet.length
      applyCurrencyFormat(wsCalendar, 2, lastRowCalendar, 2, 2)
      
      XLSX.utils.book_append_sheet(wb, wsCalendar, 'Calendario')

      const fileName = `Reporte_${businessName.replace(/\s+/g, '_')}_${exportStartDate}_${exportEndDate}.xlsx`
      XLSX.writeFile(wb, fileName)

      setShowExportModal(false)
    } catch (err) {
      console.error('Error exportando:', err)
      alert('❌ Error al exportar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  const nombreMes = selectedMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const isCurrentMonth = selectedMonth.getMonth() === hoy.getMonth() && selectedMonth.getFullYear() === hoy.getFullYear()

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#1e293b', padding: '1rem', borderBottom: '3px solid #3b82f6' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff', fontWeight: '800' }}>📊 Reportes Contables</h1>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{businessName} • {nombreMes}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setShowExportModal(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}> Exportar Excel</button>
            <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Salir</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginBottom: '1rem', backgroundColor: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <button onClick={() => { const d = new Date(selectedMonth); d.setMonth(d.getMonth() - 1); setSelectedMonth(d) }} style={{ padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>← Mes anterior</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', textTransform: 'capitalize' }}>{nombreMes}</div>
            {isCurrentMonth && <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: '700' }}>● Mes actual</div>}
          </div>
          <button onClick={() => { const d = new Date(selectedMonth); d.setMonth(d.getMonth() + 1); setSelectedMonth(d) }} style={{ padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Mes siguiente →</button>
        </div>

        {!summary ? (
          <div style={{ backgroundColor: 'white', padding: '3rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Sin datos para este mes</h3>
            <p style={{ margin: 0, color: '#64748b' }}>No hay transacciones registradas en {nombreMes}.</p>
          </div>
        ) : (
          <>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1rem', color: 'white', fontWeight: '700', fontSize: '0.875rem' }}>📋 RESUMEN EJECUTIVO</div>
              <div style={{ padding: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '0.75rem', color: '#64748b' }}>Total Facturado (bruto)</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>{formatCurrency(summary.totalFacturado)}</td></tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '0.75rem', color: '#64748b' }}>(-) IVA Débito Fiscal</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>-{formatCurrency(summary.totalIVA)}</td></tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '0.75rem', color: '#64748b' }}>Neto Gravado</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>{formatCurrency(summary.totalNeto)}</td></tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '0.75rem', color: '#64748b' }}>(-) Comisiones de medios de pago</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>-{formatCurrency(summary.totalComisiones)}</td></tr>
                    <tr style={{ borderBottom: '2px solid #0f172a', backgroundColor: '#f8fafc' }}><td style={{ padding: '0.75rem', fontWeight: '700', color: '#0f172a' }}>INGRESO NETO REAL</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800', fontSize: '1.125rem', color: '#15803d' }}>{formatCurrency(summary.totalNeto - summary.totalComisiones)}</td></tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '0.75rem', color: '#64748b' }}>(-) Gastos operativos</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>-{formatCurrency(summary.totalGastos)}</td></tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '0.75rem', color: '#64748b' }}>    (-) IVA Crédito Fiscal (compras)</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#64748b' }}>-{formatCurrency(summary.totalGastosIVA)}</td></tr>
                    <tr style={{ backgroundColor: summary.resultado >= 0 ? '#f0fdf4' : '#fef2f2', borderBottom: '2px solid #0f172a' }}><td style={{ padding: '0.75rem', fontWeight: '800', color: '#0f172a', fontSize: '1rem' }}>RESULTADO DEL EJERCICIO</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800', fontSize: '1.25rem', color: summary.resultado >= 0 ? '#15803d' : '#b91c1c' }}>{formatCurrency(summary.resultado)}</td></tr>
                  </tbody>
                </table>
                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ color: '#64748b' }}>Ventas registradas</div>
                    <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '1.125rem' }}>{summary.cantVentas}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ color: '#64748b' }}>Gastos registrados</div>
                    <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '1.125rem' }}>{summary.cantGastos}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ color: '#64748b' }}>IVA a pagar (neto)</div>
                    <div style={{ fontWeight: '800', color: '#dc2626', fontSize: '1.125rem' }}>{formatCurrency(summary.totalIVA - summary.totalGastosIVA)}</div>
                  </div>
                </div>
              </div>
            </div>

            {salesBook.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1rem', color: 'white', fontWeight: '700', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>📒 LIBRO IVA VENTAS (Débito Fiscal)</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#94a3b8' }}>{salesBook.length} registros</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontWeight: '700' }}>Fecha</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontWeight: '700' }}>Concepto</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontWeight: '700' }}>Medio</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>Bruto</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>Neto</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>IVA</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>Comisión</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>Neto Real</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesBook.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem', color: '#0f172a' }}>{row.fecha}</td>
                          <td style={{ padding: '0.5rem', color: '#0f172a' }}>{row.concepto}</td>
                          <td style={{ padding: '0.5rem', color: '#64748b', fontSize: '0.7rem' }}>{row.medio}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(row.bruto)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(row.neto)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(row.iva)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(row.comision)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#15803d' }}>{formatCurrency(row.netoReal)}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #0f172a', fontWeight: '800' }}>
                        <td colSpan="3" style={{ padding: '0.75rem', textAlign: 'right', color: '#0f172a' }}>TOTALES</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(summary.totalFacturado)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(summary.totalNeto)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(summary.totalIVA)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(summary.totalComisiones)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#15803d' }}>{formatCurrency(summary.totalNeto - summary.totalComisiones)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {expensesBook.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1rem', color: 'white', fontWeight: '700', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span> LIBRO IVA COMPRAS (Crédito Fiscal)</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#94a3b8' }}>{expensesBook.length} registros</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontWeight: '700' }}>Fecha</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontWeight: '700' }}>Concepto</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontWeight: '700' }}>Medio</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>Bruto</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>Neto</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>IVA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expensesBook.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem', color: '#0f172a' }}>{row.fecha}</td>
                          <td style={{ padding: '0.5rem', color: '#0f172a' }}>{row.concepto}</td>
                          <td style={{ padding: '0.5rem', color: '#64748b', fontSize: '0.7rem' }}>{row.medio}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(row.bruto)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(row.neto)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#2563eb' }}>{formatCurrency(row.iva)}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #0f172a', fontWeight: '800' }}>
                        <td colSpan="3" style={{ padding: '0.75rem', textAlign: 'right', color: '#0f172a' }}>TOTALES</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(summary.totalGastos)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(summary.totalGastosNeto)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#2563eb' }}>{formatCurrency(summary.totalGastosIVA)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {methodSummary.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1rem', color: 'white', fontWeight: '700', fontSize: '0.875rem' }}>💳 DESGLOSE POR MEDIO DE PAGO</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontWeight: '700' }}>Medio</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>Cant.</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>Bruto</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>IVA</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>Comisiones</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>Neto Real</th>
                      </tr>
                    </thead>
                    <tbody>
                      {methodSummary.map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem', fontWeight: '600', color: '#0f172a' }}>{m.nombre}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{m.cantidad}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(m.bruto)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(m.iva)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(m.comisiones)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#15803d' }}>{formatCurrency(m.neto - m.comisiones)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {calendar.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1rem', color: 'white', fontWeight: '700', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>📅 CALENDARIO DE ACREDITACIONES</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#94a3b8' }}>Cuándo entra la plata al banco</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontWeight: '700' }}>Fecha</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontWeight: '700' }}>Estado</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>Monto a acreditar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendar.map((day, i) => {
                        const isPast = day.fecha < hoyStr
                        const isToday = day.fecha === hoyStr
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isToday ? '#f0fdf4' : 'transparent' }}>
                            <td style={{ padding: '0.5rem', fontWeight: '600', color: '#0f172a' }}>
                              {new Date(day.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              {isPast ? <span style={{ color: '#10b981', fontWeight: '700' }}>✅ Acreditado</span> : 
                               isToday ? <span style={{ color: '#3b82f6', fontWeight: '700' }}>📍 Hoy</span> : 
                               <span style={{ color: '#d97706', fontWeight: '700' }}>⏳ Pendiente</span>}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#15803d' }}>{formatCurrency(day.total)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '400px', borderRadius: '12px', padding: '1.5rem' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '700' }}>📊 Exportar a Excel</h2>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#64748b' }}>Seleccioná el período a exportar:</p>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Desde:</label>
              <input 
                type="date" 
                value={exportStartDate} 
                onChange={e => setExportStartDate(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Hasta:</label>
              <input 
                type="date" 
                value={exportEndDate} 
                onChange={e => setExportEndDate(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => setShowExportModal(false)}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleExportExcel}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}
              >
                Exportar
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav activeTab="reportes" />
    </main>
  )
}
