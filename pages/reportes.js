import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'
import * as XLSX from 'xlsx'

export default function Reportes() {
  const [user, setUser] = useState(null)
  const [businessName, setBusinessName] = useState('Mi Negocio')
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  
  // NUEVO: Fechas para exportación
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [showExportModal, setShowExportModal] = useState(false)
  
  const [summary, setSummary] = useState(null)
  const [salesBook, setSalesBook] = useState([])
  const [expensesBook, setExpensesBook] = useState([])
  const [methodSummary, setMethodSummary] = useState([])
  const [calendar, setCalendar] = useState([])
  const [localData, setLocalData] = useState(null)
  
  const router = useRouter()
  const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

  const hoy = new Date()
  const hoyStr = hoy.toISOString().split('T')[0]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.push('/') } 
      else {
        setUser(session.user)
        if (activeLocalId) {
          loadLocalData()
          loadReportes(selectedMonth)
        }
        else router.push('/locales')
      }
    })
  }, [router, activeLocalId])

  useEffect(() => { if (user && activeLocalId) loadReportes(selectedMonth) }, [selectedMonth])

  const loadLocalData = async () => {
    const { data } = await supabase.from('locales').select('*').eq('id', activeLocalId).single()
    if (data) setLocalData(data)
  }

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

  // NUEVA: Función de exportación a Excel
  const handleExportExcel = async () => {
    if (!exportStartDate || !exportEndDate) {
      alert('⚠️ Seleccioná fecha de inicio y fin')
      return
    }

    try {
      setLoading(true)
      const start = new Date(exportStartDate + 'T00:00:00').toISOString()
      const end = new Date(exportEndDate + 'T23:59:59').toISOString()

      // Cargar datos del período seleccionado
      const { data: mediosData } = await supabase.from('medios_pago').select('id, nombre, banco_emisor, dias_acreditacion, tipo_comision, valor_comision').eq('local_id', activeLocalId)
      const mediosMap = new Map()
      if (mediosData) mediosData.forEach(m => mediosMap.set(m.id, m))

      const { data: transacciones } = await supabase.from('transacciones').select('*').eq('local_id', activeLocalId).gte('creado_en', start).lte('creado_en', end)

      if (!transacciones || transacciones.length === 0) {
        alert(' No hay datos en el período seleccionado')
        setLoading(false)
        return
      }

      // Procesar datos
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
            Fecha: new Date(t.creado_en).toLocaleDateString('es-AR'),
            Concepto: t.descripcion || 'Venta',
            Medio: key,
            Bruto: monto,
            Neto: neto,
            IVA: iva,
            Comision: comision,
            NetoReal: neto - comision
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
            Fecha: new Date(t.creado_en).toLocaleDateString('es-AR'),
            Concepto: t.descripcion || 'Gasto',
            Medio: key,
            Bruto: monto,
            Neto: neto,
            IVA: iva
          })
        }
      })

      const resultado = totalNeto - totalComisiones - totalGastos

      // Crear workbook
      const wb = XLSX.utils.book_new()

      // HOJA 1: Resumen Ejecutivo
      const resumenData = [
        ['RESUMEN EJECUTIVO'],
        ['Período:', `${new Date(exportStartDate).toLocaleDateString('es-AR')} - ${new Date(exportEndDate).toLocaleDateString('es-AR')}`],
        ['Generado:', new Date().toLocaleString('es-AR')],
        [],
        ['Total Facturado (bruto)', totalFacturado],
        ['(-) IVA Débito Fiscal', -totalIVA],
        ['Neto Gravado', totalNeto],
        ['(-) Comisiones', -totalComisiones],
        ['INGRESO NETO REAL', totalNeto - totalComisiones],
        ['(-) Gastos operativos', -totalGastos],
        ['(-) IVA Crédito Fiscal', -totalGastosIVA],
        ['RESULTADO DEL EJERCICIO', resultado],
        [],
        ['Ventas registradas', salesRows.length],
        ['Gastos registrados', expenseRows.length],
        ['IVA a pagar (neto)', totalIVA - totalGastosIVA]
      ]
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenData)
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

      // HOJA 2: Libro IVA Ventas
      const wsVentas = XLSX.utils.json_to_sheet(salesRows)
      XLSX.utils.book_append_sheet(wb, wsVentas, 'Libro IVA Ventas')

      // HOJA 3: Libro IVA Compras
      const wsCompras = XLSX.utils.json_to_sheet(expenseRows)
      XLSX.utils.book_append_sheet(wb, wsCompras, 'Libro IVA Compras')

      // HOJA 4: Medios de Pago
      const mediosDataArray = Object.values(methodsMap).map(m => ({
        Medio: m.nombre,
        Cantidad: m.cantidad,
        Bruto: m.bruto,
        IVA: m.iva,
        Comisiones: m.comisiones,
        'Neto Real': m.neto - m.comisiones
      }))
      const wsMedios = XLSX.utils.json_to_sheet(mediosDataArray)
      XLSX.utils.book_append_sheet(wb, wsMedios, 'Medios de Pago')

      // HOJA 5: Calendario
      const calendarData = Object.values(calendarMap).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(c => ({
        Fecha: new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR'),
        'Monto a Acreditar': c.total
      }))
      const wsCalendar = XLSX.utils.json_to_sheet(calendarData)
      XLSX.utils.book_append_sheet(wb, wsCalendar, 'Calendario')

      // Guardar archivo
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

  const fmt = (n) => n ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#1e293b', padding: '1rem', borderBottom: '3px solid #3b82f6' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff', fontWeight: '800' }}>📊 Reportes Contables</h1>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{businessName} • {nombreMes}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setShowExportModal(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>📊 Exportar Excel</button>
            <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Salir</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
        {/* NAVEGACIÓN */}
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
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}></div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Sin datos para este mes</h3>
          </div>
        ) : (
          <>
            {/* RESUMEN */}
            <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1rem', color: 'white', fontWeight: '700', fontSize: '0.875rem' }}>📋 RESUMEN EJECUTIVO</div>
              <div style={{ padding: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '0.75rem', color: '#64748b' }}>Total Facturado</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700' }}>${fmt(summary.totalFacturado)}</td></tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '0.75rem', color: '#64748b' }}>(-) IVA Débito Fiscal</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>-${fmt(summary.totalIVA)}</td></tr>
                    <tr style={{ borderBottom: '2px solid #0f172a', backgroundColor: '#f8fafc' }}><td style={{ padding: '0.75rem', fontWeight: '700' }}>INGRESO NETO REAL</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800', color: '#15803d' }}>${fmt(summary.totalNeto - summary.totalComisiones)}</td></tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '0.75rem', color: '#64748b' }}>(-) Gastos</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>-${fmt(summary.totalGastos)}</td></tr>
                    <tr style={{ backgroundColor: summary.resultado >= 0 ? '#f0fdf4' : '#fef2f2' }}><td style={{ padding: '0.75rem', fontWeight: '800' }}>RESULTADO</td><td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800', color: summary.resultado >= 0 ? '#15803d' : '#b91c1c' }}>${fmt(summary.resultado)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* LIBRO VENTAS */}
            {salesBook.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1rem', color: 'white', fontWeight: '700', fontSize: '0.875rem' }}> LIBRO IVA VENTAS</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead><tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Fecha</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Concepto</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Bruto</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>IVA</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Neto Real</th>
                    </tr></thead>
                    <tbody>
                      {salesBook.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem' }}>{row.fecha}</td>
                          <td style={{ padding: '0.5rem' }}>{row.concepto}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>${fmt(row.bruto)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#dc2626' }}>${fmt(row.iva)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#15803d' }}>${fmt(row.netoReal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* LIBRO COMPRAS */}
            {expensesBook.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1rem', color: 'white', fontWeight: '700', fontSize: '0.875rem' }}>📕 LIBRO IVA COMPRAS</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead><tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Fecha</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Concepto</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Bruto</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>IVA</th>
                    </tr></thead>
                    <tbody>
                      {expensesBook.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem' }}>{row.fecha}</td>
                          <td style={{ padding: '0.5rem' }}>{row.concepto}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>${fmt(row.bruto)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#2563eb' }}>${fmt(row.iva)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL DE EXPORTACIÓN */}
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
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '1rem' }}
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Hasta:</label>
              <input 
                type="date" 
                value={exportEndDate} 
                onChange={e => setExportEndDate(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '1rem' }}
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
