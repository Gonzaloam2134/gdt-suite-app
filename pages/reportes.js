import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import * as XLSX from 'xlsx-js-style'
import { formatCurrency } from '../lib/format'
import toast from 'react-hot-toast'
import ContactModal from '../components/ContactModal'

// ✅ FUNCIÓN REUTILIZABLE: Procesa transacciones con campos REALES y datos detallados
const procesarTransacciones = (transacciones, mediosMap, hoyStr) => {
  let totalFacturado = 0, totalNeto = 0, totalIVA = 0, totalComisiones = 0
  let totalGastos = 0, totalGastosNeto = 0, totalGastosIVA = 0
  const salesRows = [], expenseRows = [], methodsMap = {}, calendarMap = {}

  transacciones.forEach(t => {
    const medio = mediosMap.get(t.medio_pago_id) || { 
      nombre: 'Sin Medio', 
      banco_emisor: '', 
      tipo: 'otro',
      plazo_acreditacion_dias: 0, 
      comision_porcentaje: 0 
    }
    const key = medio.banco_emisor ? `${medio.nombre} (${medio.banco_emisor})` : medio.nombre

    if (t.tipo === 'COBRO_RECIBIDO') {
      const monto = t.monto || 0
      const comision = (monto * (medio.comision_porcentaje || 0)) / 100
      const iva = t.monto_iva || (monto - monto / 1.21)
      const neto = t.monto_neto || (monto - iva)

      totalFacturado += monto
      totalNeto += neto
      totalIVA += iva
      totalComisiones += comision

      // ✅ NUEVO: Determinar operador y tipo de medio
      let operador = '-'
      let tipoMedio = 'Otro'
      
      if (medio.tipo === 'efectivo') {
        tipoMedio = 'Efectivo'
        operador = 'Efectivo'
      } else if (medio.tipo === 'transferencia') {
        tipoMedio = 'Transferencia'
        operador = medio.banco_emisor || 'Transferencia'
      } else if (medio.tipo === 'debito') {
        tipoMedio = 'Débito'
        operador = medio.nombre || 'Débito'
      } else if (medio.tipo === 'credito') {
        tipoMedio = 'Crédito'
        operador = medio.nombre || 'Crédito'
      } else if (medio.tipo === 'qr') {
        tipoMedio = 'QR'
        operador = medio.nombre || 'QR'
      } else if (medio.tipo === 'cheque') {
        tipoMedio = 'Cheque'
        operador = medio.nombre || 'Cheque'
      }

      // ✅ NUEVO: Calcular fecha de acreditación
      let fechaAcred = t.fecha_acreditacion_estimada
      if (!fechaAcred) {
        const d = new Date(t.creado_en)
        d.setDate(d.getDate() + (medio.plazo_acreditacion_dias || 0))
        fechaAcred = d.toISOString().split('T')[0]
      }

      salesRows.push({
        fecha: new Date(t.creado_en).toLocaleDateString('es-AR'),
        concepto: t.descripcion || 'Venta',
        medio: key,
        tipo_medio: tipoMedio,
        operador: operador,
        comision_porcentaje: medio.comision_porcentaje || 0,
        bruto: monto, 
        neto, 
        iva, 
        comision, 
        fecha_acreditacion: fechaAcred,
        netoReal: neto - comision
      })

      if (!methodsMap[key]) methodsMap[key] = { nombre: key, bruto: 0, neto: 0, iva: 0, comisiones: 0, cantidad: 0 }
      methodsMap[key].bruto += monto
      methodsMap[key].neto += neto
      methodsMap[key].iva += iva
      methodsMap[key].comisiones += comision
      methodsMap[key].cantidad++

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
        bruto: monto, neto, iva
      })
    }
  })

  return {
    summary: {
      totalFacturado, totalNeto, totalIVA, totalComisiones,
      totalGastos, totalGastosNeto, totalGastosIVA,
      resultado: totalNeto - totalComisiones - totalGastos,
      cantVentas: salesRows.length, cantGastos: expenseRows.length
    },
    salesBook: salesRows.sort((a, b) => a.fecha.localeCompare(b.fecha)),
    expensesBook: expenseRows.sort((a, b) => a.fecha.localeCompare(b.fecha)),
    methodSummary: Object.values(methodsMap).sort((a, b) => b.neto - a.neto),
    calendar: Object.values(calendarMap).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }
}

export default function Reportes() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [misLocales, setMisLocales] = useState([])
  const [selectedLocalId, setSelectedLocalId] = useState('')
  
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  
  const [businessName, setBusinessName] = useState('Todos los locales')
  const [summary, setSummary] = useState(null)
  const [salesBook, setSalesBook] = useState([])
  const [expensesBook, setExpensesBook] = useState([])
  const [methodSummary, setMethodSummary] = useState([])
  const [calendar, setCalendar] = useState([])
  
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  
  const [showContactModal, setShowContactModal] = useState(false)
  
  const router = useRouter()
  const hoy = new Date()
  const hoyStr = hoy.toISOString().split('T')[0]

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
      await cargarLocales(session.user.id)
    })
  }, [router])

  const cargarLocales = async (userId) => {
    try {
      const { data: membresias } = await supabase
        .from('miembros_locales')
        .select('local_id, rol')
        .eq('user_id', userId)
        .eq('activo', true)
      
      if (!membresias || membresias.length === 0) {
        router.push('/locales'); return
      }

      const localIds = membresias.map(m => m.local_id)
      const { data: localesData } = await supabase
        .from('locales')
        .select('id, nombre')
        .in('id', localIds)
      
      setMisLocales(localesData || [])
      setSelectedLocalId('')
      
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
      const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]
      setFechaDesde(primerDia)
      setFechaHasta(ultimoDia)
      
    } catch (err) {
      console.error('Error cargando locales:', err)
      toast.error('Error al cargar locales')
    }
  }

  useEffect(() => {
    if (user && fechaDesde && fechaHasta) {
      cargarReportes()
    }
  }, [fechaDesde, fechaHasta, selectedLocalId, user])

  const cargarReportes = async () => {
    try {
      setLoading(true)
      
      const start = `${fechaDesde}T00:00:00`
      const end = `${fechaHasta}T23:59:59`
      
      let query = supabase
        .from('transacciones')
        .select('*')
        .gte('creado_en', start)
        .lte('creado_en', end)
      
      if (selectedLocalId) {
        query = query.eq('local_id', selectedLocalId)
      } else {
        const localIds = misLocales.map(l => l.id)
        query = query.in('local_id', localIds)
      }
      
      const { data: transacciones } = await query
      
      const { data: mediosData } = await supabase
        .from('medios_pago')
        .select('id, nombre, banco_emisor, tipo, plazo_acreditacion_dias, comision_porcentaje')
        .in('local_id', selectedLocalId ? [selectedLocalId] : misLocales.map(l => l.id))
      
      const mediosMap = new Map()
      if (mediosData) mediosData.forEach(m => mediosMap.set(m.id, m))
      
      if (transacciones && transacciones.length > 0) {
        const resultado = procesarTransacciones(transacciones, mediosMap, hoyStr)
        setSummary(resultado.summary)
        setSalesBook(resultado.salesBook)
        setExpensesBook(resultado.expensesBook)
        setMethodSummary(resultado.methodSummary)
        setCalendar(resultado.calendar)
        
        if (selectedLocalId) {
          const local = misLocales.find(l => l.id === selectedLocalId)
          setBusinessName(local?.nombre || 'Local')
        } else {
          setBusinessName('Todos los locales')
        }
      } else {
        setSummary(null)
        setSalesBook([])
        setExpensesBook([])
        setMethodSummary([])
        setCalendar([])
      }
    } catch (err) {
      console.error('Error cargando reportes:', err)
      toast.error('Error al cargar reportes: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRangoRapido = (tipo) => {
    const hoy = new Date()
    let desde, hasta
    
    if (tipo === 'mes-actual') {
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    } else if (tipo === 'mes-anterior') {
      desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
    } else if (tipo === 'ultimos-30') {
      hasta = new Date(hoy)
      desde = new Date(hoy)
      desde.setDate(desde.getDate() - 29)
    } else if (tipo === 'trimestre') {
      const mesActual = hoy.getMonth()
      const mesInicioTrimestre = Math.floor(mesActual / 3) * 3
      desde = new Date(hoy.getFullYear(), mesInicioTrimestre, 1)
      hasta = new Date(hoy.getFullYear(), mesInicioTrimestre + 3, 0)
    }
    
    setFechaDesde(desde.toISOString().split('T')[0])
    setFechaHasta(hasta.toISOString().split('T')[0])
  }

  const handleExportExcel = async () => {
    if (!exportStartDate || !exportEndDate) {
      toast.error('Seleccioná fecha de inicio y fin')
      return
    }

    try {
      setLoading(true)
      const start = `${exportStartDate}T00:00:00`
      const end = `${exportEndDate}T23:59:59`

      let query = supabase
        .from('transacciones')
        .select('*')
        .gte('creado_en', start)
        .lte('creado_en', end)
      
      if (selectedLocalId) {
        query = query.eq('local_id', selectedLocalId)
      } else {
        query = query.in('local_id', misLocales.map(l => l.id))
      }
      
      const { data: transacciones } = await query

      const { data: mediosData } = await supabase
        .from('medios_pago')
        .select('id, nombre, banco_emisor, tipo, plazo_acreditacion_dias, comision_porcentaje')
        .in('local_id', selectedLocalId ? [selectedLocalId] : misLocales.map(l => l.id))
      
      const mediosMap = new Map()
      if (mediosData) mediosData.forEach(m => mediosMap.set(m.id, m))

      if (!transacciones || transacciones.length === 0) {
        toast.error('No hay datos en el período seleccionado')
        setLoading(false)
        return
      }

      const resultado = procesarTransacciones(transacciones, mediosMap, hoyStr)
      const { summary: expSummary, salesBook: expSales, expensesBook: expExpenses, methodSummary: expMethods, calendar: expCalendar } = resultado

      const wb = XLSX.utils.book_new()

      const applyStyle = (ws, cellRef, style) => {
        if (ws[cellRef]) ws[cellRef].s = style
      }

      const applyCurrencyFormat = (ws, startRow, endRow, startCol, endCol) => {
        const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
        const fmt = '$#,##0.00;[Red]-$#,##0.00'
        for (let row = startRow; row <= endRow; row++) {
          for (let colIdx = startCol; colIdx <= endCol; colIdx++) {
            const cellRef = `${cols[colIdx]}${row}`
            if (ws[cellRef]) ws[cellRef].s = { ...ws[cellRef].s, numFmt: fmt }
          }
        }
      }

      const applyDateFormat = (ws, startRow, endRow, col) => {
        const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
        const fmt = 'DD/MM/YYYY'
        for (let row = startRow; row <= endRow; row++) {
          const cellRef = `${cols[col]}${row}`
          if (ws[cellRef]) ws[cellRef].s = { ...ws[cellRef].s, numFmt: fmt }
        }
      }

      // HOJA 1: RESUMEN
      const resumenData = [
        ['RESUMEN EJECUTIVO', ''],
        ['Local:', businessName],
        ['Período:', `${new Date(exportStartDate).toLocaleDateString('es-AR')} - ${new Date(exportEndDate).toLocaleDateString('es-AR')}`],
        ['Generado:', new Date().toLocaleString('es-AR')],
        ['', ''],
        ['Total Facturado (bruto)', expSummary.totalFacturado],
        ['(-) IVA Débito Fiscal', -expSummary.totalIVA],
        ['Neto Gravado', expSummary.totalNeto],
        ['(-) Comisiones de medios de pago', -expSummary.totalComisiones],
        ['INGRESO NETO REAL', expSummary.totalNeto - expSummary.totalComisiones],
        ['(-) Gastos operativos', -expSummary.totalGastos],
        ['(-) IVA Crédito Fiscal (compras)', -expSummary.totalGastosIVA],
        ['RESULTADO DEL EJERCICIO', expSummary.resultado],
        ['', ''],
        ['Ventas registradas', expSales.length],
        ['Gastos registrados', expExpenses.length],
        ['IVA a pagar (neto)', expSummary.totalIVA - expSummary.totalGastosIVA]
      ]
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenData, { sheetStubs: true })
      wsResumen['!cols'] = [{ wch: 35 }, { wch: 25 }]
      
      applyStyle(wsResumen, 'A1', { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } })
      applyStyle(wsResumen, 'B1', { fill: { fgColor: { rgb: '1E293B' } } })
      applyStyle(wsResumen, 'A2', { font: { bold: true, sz: 11 } })
      applyStyle(wsResumen, 'A3', { font: { italic: true, color: { rgb: '64748B' }, sz: 10 } })
      applyCurrencyFormat(wsResumen, 6, 13, 1, 1)
      applyCurrencyFormat(wsResumen, 17, 17, 1, 1)
      
      const resultadoColor = expSummary.resultado >= 0 ? '15803D' : 'B91C1C'
      const resultadoBg = expSummary.resultado >= 0 ? 'F0FDF4' : 'FEF2F2'
      applyStyle(wsResumen, 'A13', { font: { bold: true, sz: 13 }, fill: { fgColor: { rgb: resultadoBg } }, border: { top: { style: 'double', color: { rgb: '0F172A' } }, bottom: { style: 'double', color: { rgb: '0F172A' } } } })
      applyStyle(wsResumen, 'B13', { font: { bold: true, sz: 13, color: { rgb: resultadoColor } }, fill: { fgColor: { rgb: resultadoBg } }, border: { top: { style: 'double', color: { rgb: '0F172A' } }, bottom: { style: 'double', color: { rgb: '0F172A' } } } })
      
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

      // ✅ HOJA 2: LIBRO IVA VENTAS (CON COLUMNAS NUEVAS)
      const ventasData = [['Fecha', 'Concepto', 'Medio de Pago', 'Tipo', 'Operador', 'Com. %', 'Bruto', 'Neto', 'IVA', 'Comisión', 'Acreditación', 'Neto Real']]
      expSales.forEach(row => ventasData.push([
        row.fecha, 
        row.concepto, 
        row.medio, 
        row.tipo_medio, 
        row.operador, 
        row.comision_porcentaje + '%',
        row.bruto, 
        row.neto, 
        row.iva, 
        row.comision, 
        row.fecha_acreditacion,
        row.netoReal
      ]))
      ventasData.push(['TOTALES', '', '', '', '', '', expSummary.totalFacturado, expSummary.totalNeto, expSummary.totalIVA, expSummary.totalComisiones, '', expSummary.totalNeto - expSummary.totalComisiones])
      
      const wsVentas = XLSX.utils.aoa_to_sheet(ventasData)
      wsVentas['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }]
      
      for (let col = 0; col < 12; col++) {
        applyStyle(wsVentas, `${['A','B','C','D','E','F','G','H','I','J','K','L'][col]}1`, { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } })
      }
      applyCurrencyFormat(wsVentas, 2, ventasData.length, 6, 9)
      applyCurrencyFormat(wsVentas, 2, ventasData.length, 11, 11)
      applyDateFormat(wsVentas, 2, ventasData.length - 1, 0)
      applyDateFormat(wsVentas, 2, ventasData.length - 1, 10)
      
      const totalesRowVentas = ventasData.length
      for (let col = 0; col < 12; col++) {
        applyStyle(wsVentas, `${['A','B','C','D','E','F','G','H','I','J','K','L'][col]}${totalesRowVentas}`, { font: { bold: true, sz: 11 }, fill: { fgColor: { rgb: 'F1F5F9' } }, border: { top: { style: 'double', color: { rgb: '0F172A' } } } })
      }
      XLSX.utils.book_append_sheet(wb, wsVentas, 'Libro IVA Ventas')

      // HOJA 3: LIBRO IVA COMPRAS
      const comprasData = [['Fecha', 'Concepto', 'Medio de Pago', 'Bruto', 'Neto', 'IVA (Crédito Fiscal)']]
      expExpenses.forEach(row => comprasData.push([row.fecha, row.concepto, row.medio, row.bruto, row.neto, row.iva]))
      comprasData.push(['TOTALES', '', '', expSummary.totalGastos, expSummary.totalGastosNeto, expSummary.totalGastosIVA])
      
      const wsCompras = XLSX.utils.aoa_to_sheet(comprasData)
      wsCompras['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }]
      
      for (let col = 0; col < 6; col++) {
        applyStyle(wsCompras, `${['A','B','C','D','E','F'][col]}1`, { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } })
      }
      applyCurrencyFormat(wsCompras, 2, comprasData.length, 3, 5)
      applyDateFormat(wsCompras, 2, comprasData.length - 1, 0)
      
      const totalesRowCompras = comprasData.length
      for (let col = 0; col < 6; col++) {
        applyStyle(wsCompras, `${['A','B','C','D','E','F'][col]}${totalesRowCompras}`, { font: { bold: true, sz: 11 }, fill: { fgColor: { rgb: 'F1F5F9' } }, border: { top: { style: 'double', color: { rgb: '0F172A' } } } })
      }
      XLSX.utils.book_append_sheet(wb, wsCompras, 'Libro IVA Compras')

      // HOJA 4: MEDIOS DE PAGO
      const mediosDataForSheet = [['Medio de Pago', 'Cant. Operaciones', 'Bruto', 'IVA', 'Comisiones', 'Neto Real']]
      expMethods.forEach(m => mediosDataForSheet.push([m.nombre, m.cantidad, m.bruto, m.iva, m.comisiones, m.neto - m.comisiones]))
      
      const wsMedios = XLSX.utils.aoa_to_sheet(mediosDataForSheet)
      wsMedios['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }]
      
      for (let col = 0; col < 6; col++) {
        applyStyle(wsMedios, `${['A','B','C','D','E','F'][col]}1`, { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } })
      }
      applyCurrencyFormat(wsMedios, 2, mediosDataForSheet.length, 2, 5)
      XLSX.utils.book_append_sheet(wb, wsMedios, 'Medios de Pago')

      // HOJA 5: CALENDARIO
      const calendarDataForSheet = [['Fecha de Acreditación', 'Estado', 'Monto a Acreditar']]
      expCalendar.forEach(c => {
        const isPast = c.fecha < hoyStr
        const isToday = c.fecha === hoyStr
        const estado = isPast ? '✅ Acreditado' : isToday ? '📍 Hoy' : '⏳ Pendiente'
        calendarDataForSheet.push([new Date(c.fecha + 'T12:00:00'), estado, c.total])
      })
      
      const wsCalendar = XLSX.utils.aoa_to_sheet(calendarDataForSheet)
      wsCalendar['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 20 }]
      
      for (let col = 0; col < 3; col++) {
        applyStyle(wsCalendar, `${['A','B','C'][col]}1`, { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } })
      }
      applyCurrencyFormat(wsCalendar, 2, calendarDataForSheet.length, 2, 2)
      applyDateFormat(wsCalendar, 2, calendarDataForSheet.length, 0)
      XLSX.utils.book_append_sheet(wb, wsCalendar, 'Calendario')

      const fileName = `Reporte_${businessName.replace(/\s+/g, '_')}_${exportStartDate}_${exportEndDate}.xlsx`
      XLSX.writeFile(wb, fileName)

      setShowExportModal(false)
      toast.success('✅ Reporte exportado correctamente')
    } catch (err) {
      console.error('Error exportando:', err)
      toast.error('Error al exportar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p>Cargando reportes...</p></div>
  if (!user) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p>Cargando...</p></div>

  return (
    <main className="min-h-screen bg-slate-100 pb-8">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="m-0 text-lg font-bold text-gray-900">📊 Reportes Contables</h1>
            <p className="mt-0.5 text-xs text-gray-500">{businessName}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowExportModal(true)} 
              className="px-3 py-1.5 bg-emerald-500 text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-emerald-600"
            >
              📥 Exportar Excel
            </button>
            <button 
              onClick={() => setShowContactModal(true)} 
              className="px-3 py-1.5 bg-blue-100 text-blue-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-200"
            >
              💬 Ayuda
            </button>
            <button 
              onClick={() => router.push('/locales')} 
              className="px-3 py-1.5 bg-gray-100 text-gray-600 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200"
            >
              ← Volver
            </button>
            <button 
              onClick={handleSignOut} 
              className="px-3 py-1.5 bg-gray-100 text-gray-500 border-none rounded-md text-xs font-medium cursor-pointer hover:bg-gray-200"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">📍 Local:</label>
          <select 
            value={selectedLocalId} 
            onChange={(e) => setSelectedLocalId(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">📊 Todos los locales (Consolidado)</option>
            {misLocales.map(local => (
              <option key={local.id} value={local.id}>🏪 {local.nombre}</option>
            ))}
          </select>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">📅 Período:</label>
          
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => handleRangoRapido('mes-actual')} className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-100">Este mes</button>
            <button onClick={() => handleRangoRapido('mes-anterior')} className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-100">Mes anterior</button>
            <button onClick={() => handleRangoRapido('ultimos-30')} className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-100">Últimos 30 días</button>
            <button onClick={() => handleRangoRapido('trimestre')} className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-100">Trimestre</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Desde:</label>
              <input 
                type="date" 
                value={fechaDesde} 
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hasta:</label>
              <input 
                type="date" 
                value={fechaHasta} 
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {!summary ? (
          <div className="bg-white p-12 rounded-xl border border-gray-200 text-center">
            <div className="text-5xl mb-3"></div>
            <h3 className="m-0 mb-2 text-gray-900 text-base font-bold">Sin datos para este período</h3>
            <p className="m-0 text-gray-500 text-sm">No hay transacciones registradas entre {new Date(fechaDesde).toLocaleDateString('es-AR')} y {new Date(fechaHasta).toLocaleDateString('es-AR')}.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
              <div className="bg-slate-800 p-3 text-white font-bold text-sm"> RESUMEN EJECUTIVO</div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">Total Facturado (bruto)</td><td className="py-2 text-right font-bold text-gray-900">{formatCurrency(summary.totalFacturado)}</td></tr>
                    <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">(-) IVA Débito Fiscal</td><td className="py-2 text-right font-bold text-red-600">-{formatCurrency(summary.totalIVA)}</td></tr>
                    <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">Neto Gravado</td><td className="py-2 text-right font-bold text-gray-900">{formatCurrency(summary.totalNeto)}</td></tr>
                    <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">(-) Comisiones de medios de pago</td><td className="py-2 text-right font-bold text-red-600">-{formatCurrency(summary.totalComisiones)}</td></tr>
                    <tr className="border-b-2 border-gray-900 bg-slate-50"><td className="py-3 font-bold text-gray-900">INGRESO NETO REAL</td><td className="py-3 text-right font-extrabold text-lg text-green-700">{formatCurrency(summary.totalNeto - summary.totalComisiones)}</td></tr>
                    <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">(-) Gastos operativos</td><td className="py-2 text-right font-bold text-red-600">-{formatCurrency(summary.totalGastos)}</td></tr>
                    <tr className="border-b border-gray-100"><td className="py-2 text-gray-600 pl-4">(-) IVA Crédito Fiscal (compras)</td><td className="py-2 text-right font-semibold text-gray-500">-{formatCurrency(summary.totalGastosIVA)}</td></tr>
                    <tr className={`border-b-2 border-gray-900 ${summary.resultado >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <td className="py-3 font-extrabold text-gray-900 text-base">RESULTADO DEL EJERCICIO</td>
                      <td className={`py-3 text-right font-extrabold text-xl ${summary.resultado >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(summary.resultado)}</td>
                    </tr>
                  </tbody>
                </table>
                
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="bg-slate-50 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-500">Ventas</div>
                    <div className="font-extrabold text-gray-900 text-lg">{summary.cantVentas}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-500">Gastos</div>
                    <div className="font-extrabold text-gray-900 text-lg">{summary.cantGastos}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-500">IVA a pagar</div>
                    <div className="font-extrabold text-red-600 text-lg">{formatCurrency(summary.totalIVA - summary.totalGastosIVA)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ LIBRO IVA VENTAS CON COLUMNAS NUEVAS */}
            {salesBook.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
                <div className="bg-slate-800 p-3 text-white font-bold text-sm flex justify-between">
                  <span>📒 LIBRO IVA VENTAS (Débito Fiscal)</span>
                  <span className="text-xs font-normal text-slate-400">{salesBook.length} registros</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b-2 border-slate-200">
                        <th className="p-2 text-left text-slate-600 font-bold">Fecha</th>
                        <th className="p-2 text-left text-slate-600 font-bold">Concepto</th>
                        <th className="p-2 text-left text-slate-600 font-bold">Medio</th>
                        <th className="p-2 text-left text-slate-600 font-bold">Tipo</th>
                        <th className="p-2 text-left text-slate-600 font-bold">Operador</th>
                        <th className="p-2 text-right text-slate-600 font-bold">Com. %</th>
                        <th className="p-2 text-right text-slate-600 font-bold">Bruto</th>
                        <th className="p-2 text-right text-slate-600 font-bold">Neto</th>
                        <th className="p-2 text-right text-slate-600 font-bold">IVA</th>
                        <th className="p-2 text-right text-slate-600 font-bold">Comisión</th>
                        <th className="p-2 text-left text-slate-600 font-bold">Acreditación</th>
                        <th className="p-2 text-right text-slate-600 font-bold">Neto Real</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesBook.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="p-2 text-gray-900">{row.fecha}</td>
                          <td className="p-2 text-gray-900">{row.concepto}</td>
                          <td className="p-2 text-slate-500 text-[10px]">{row.medio}</td>
                          <td className="p-2 text-slate-700 font-medium">{row.tipo_medio}</td>
                          <td className="p-2 text-slate-700">{row.operador}</td>
                          <td className="p-2 text-right text-slate-600">{row.comision_porcentaje}%</td>
                          <td className="p-2 text-right font-semibold">{formatCurrency(row.bruto)}</td>
                          <td className="p-2 text-right">{formatCurrency(row.neto)}</td>
                          <td className="p-2 text-right text-red-600">{formatCurrency(row.iva)}</td>
                          <td className="p-2 text-right text-red-600">{formatCurrency(row.comision)}</td>
                          <td className="p-2 text-slate-700">
                            {row.fecha_acreditacion ? new Date(row.fecha_acreditacion + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                          </td>
                          <td className="p-2 text-right font-bold text-green-700">{formatCurrency(row.netoReal)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 border-t-2 border-slate-900 font-extrabold">
                        <td colSpan="5" className="p-3 text-right text-gray-900">TOTALES</td>
                        <td className="p-3 text-right text-slate-600">-</td>
                        <td className="p-3 text-right">{formatCurrency(summary.totalFacturado)}</td>
                        <td className="p-3 text-right">{formatCurrency(summary.totalNeto)}</td>
                        <td className="p-3 text-right text-red-600">{formatCurrency(summary.totalIVA)}</td>
                        <td className="p-3 text-right text-red-600">{formatCurrency(summary.totalComisiones)}</td>
                        <td className="p-3 text-right text-slate-600">-</td>
                        <td className="p-3 text-right text-green-700">{formatCurrency(summary.totalNeto - summary.totalComisiones)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {expensesBook.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
                <div className="bg-slate-800 p-3 text-white font-bold text-sm flex justify-between">
                  <span>📗 LIBRO IVA COMPRAS (Crédito Fiscal)</span>
                  <span className="text-xs font-normal text-slate-400">{expensesBook.length} registros</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b-2 border-slate-200">
                        <th className="p-2 text-left text-slate-600 font-bold">Fecha</th>
                        <th className="p-2 text-left text-slate-600 font-bold">Concepto</th>
                        <th className="p-2 text-left text-slate-600 font-bold">Medio</th>
                        <th className="p-2 text-right text-slate-600 font-bold">Bruto</th>
                        <th className="p-2 text-right text-slate-600 font-bold">Neto</th>
                        <th className="p-2 text-right text-slate-600 font-bold">IVA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expensesBook.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="p-2 text-gray-900">{row.fecha}</td>
                          <td className="p-2 text-gray-900">{row.concepto}</td>
                          <td className="p-2 text-slate-500 text-[10px]">{row.medio}</td>
                          <td className="p-2 text-right font-semibold">{formatCurrency(row.bruto)}</td>
                          <td className="p-2 text-right">{formatCurrency(row.neto)}</td>
                          <td className="p-2 text-right text-blue-600">{formatCurrency(row.iva)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 border-t-2 border-slate-900 font-extrabold">
                        <td colSpan="3" className="p-3 text-right text-gray-900">TOTALES</td>
                        <td className="p-3 text-right">{formatCurrency(summary.totalGastos)}</td>
                        <td className="p-3 text-right">{formatCurrency(summary.totalGastosNeto)}</td>
                        <td className="p-3 text-right text-blue-600">{formatCurrency(summary.totalGastosIVA)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {methodSummary.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
                <div className="bg-slate-800 p-3 text-white font-bold text-sm">💳 DESGLOSE POR MEDIO DE PAGO</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b-2 border-slate-200">
                        <th className="p-2 text-left text-slate-600 font-bold">Medio</th>
                        <th className="p-2 text-right text-slate-600 font-bold">Cant.</th>
                        <th className="p-2 text-right text-slate-600 font-bold">Bruto</th>
                        <th className="p-2 text-right text-slate-600 font-bold">IVA</th>
                        <th className="p-2 text-right text-slate-600 font-bold">Comisiones</th>
                        <th className="p-2 text-right text-slate-600 font-bold">Neto Real</th>
                      </tr>
                    </thead>
                    <tbody>
                      {methodSummary.map((m, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="p-2 font-semibold text-gray-900">{m.nombre}</td>
                          <td className="p-2 text-right">{m.cantidad}</td>
                          <td className="p-2 text-right">{formatCurrency(m.bruto)}</td>
                          <td className="p-2 text-right text-red-600">{formatCurrency(m.iva)}</td>
                          <td className="p-2 text-right text-red-600">{formatCurrency(m.comisiones)}</td>
                          <td className="p-2 text-right font-bold text-green-700">{formatCurrency(m.neto - m.comisiones)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {calendar.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
                <div className="bg-slate-800 p-3 text-white font-bold text-sm flex justify-between">
                  <span>📅 CALENDARIO DE ACREDITACIONES</span>
                  <span className="text-xs font-normal text-slate-400">Cuándo entra la plata al banco</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b-2 border-slate-200">
                        <th className="p-2 text-left text-slate-600 font-bold">Fecha</th>
                        <th className="p-2 text-left text-slate-600 font-bold">Estado</th>
                        <th className="p-2 text-right text-slate-600 font-bold">Monto a acreditar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendar.map((day, i) => {
                        const isPast = day.fecha < hoyStr
                        const isToday = day.fecha === hoyStr
                        return (
                          <tr key={i} className={`border-b border-slate-100 ${isToday ? 'bg-green-50' : ''}`}>
                            <td className="p-2 font-semibold text-gray-900">
                              {new Date(day.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </td>
                            <td className="p-2">
                              {isPast ? <span className="text-green-600 font-bold">✅ Acreditado</span> : 
                               isToday ? <span className="text-blue-600 font-bold">📍 Hoy</span> : 
                               <span className="text-amber-600 font-bold">⏳ Pendiente</span>}
                            </td>
                            <td className="p-2 text-right font-bold text-green-700">{formatCurrency(day.total)}</td>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-xl p-6">
            <h2 className="m-0 mb-4 text-lg font-bold text-gray-900">📊 Exportar a Excel</h2>
            <p className="m-0 mb-4 text-sm text-gray-600">Seleccioná el período a exportar:</p>
            
            <div className="mb-3">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Desde:</label>
              <input 
                type="date" 
                value={exportStartDate} 
                onChange={e => setExportStartDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Hasta:</label>
              <input 
                type="date" 
                value={exportEndDate} 
                onChange={e => setExportEndDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setShowExportModal(false)}
                className="flex-1 p-3 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button 
                onClick={handleExportExcel}
                className="flex-1 p-3 bg-emerald-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-emerald-600"
              >
                📥 Exportar
              </button>
            </div>
          </div>
        </div>
      )}

      <ContactModal 
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        user={user}
        localId={selectedLocalId || null}
        paginaOrigen="Reportes"
      />
    </main>
  )
}
