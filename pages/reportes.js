import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

export default function Reportes() {
  const [user, setUser] = useState(null)
  const [businessName, setBusinessName] = useState('Mi Negocio')
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  
  // Datos del reporte
  const [summary, setSummary] = useState(null)
  const [salesBook, setSalesBook] = useState([]) // Libro IVA Ventas
  const [expensesBook, setExpensesBook] = useState([]) // Libro IVA Compras
  const [methodSummary, setMethodSummary] = useState([])
  const [calendar, setCalendar] = useState([])
  
  const router = useRouter()
  const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

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

      const hoy = new Date()
      const hoyStr = hoy.toISOString().split('T')[0]
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

            // Libro IVA Ventas
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

            // Resumen por medio
            if (!methodsMap[key]) methodsMap[key] = { nombre: key, bruto: 0, neto: 0, iva: 0, comisiones: 0, cantidad: 0 }
            methodsMap[key].bruto += monto
            methodsMap[key].neto += neto
            methodsMap[key].iva += iva
            methodsMap[key].comisiones += comision
            methodsMap[key].cantidad++

            // Calendario
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

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/') }
  const handleExportExcel = () => alert('📊 Exportación a Excel en desarrollo. Próximamente.')

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  const hoy = new Date()
  const nombreMes = selectedMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const isCurrentMonth = selectedMonth.getMonth() === hoy.getMonth() && selectedMonth.getFullYear() === hoy.getFullYear()

  const fmt = (n) => n ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', paddingBottom: '70px' }}>
      {/* HEADER */}
      <header style={{ backgroundColor: '#1e293b', padding: '1rem', borderBottom: '3px solid #3b82f6' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff', fontWeight: '800' }}>📊 Reportes Contables</h1>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{businessName} • {nombreMes}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleExportExcel} style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>📊 Exportar</button>
            <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Salir</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
        {/* NAVEGACIÓN DE MESES */}
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
            {/* SECCIÓN 1: RESUMEN EJECUTIVO */}
            <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1rem', color: 'white', fontWeight: '700', fontSize: '0.875rem' }}>
                📋 RESUMEN EJECUTIVO
              </div>
              <div style={{ padding: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.75rem', color: '#64748b' }}>Total Facturado (bruto)</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>${fmt(summary.totalFacturado)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.75rem', color: '#64748b' }}>(-) IVA Débito Fiscal</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>-${fmt(summary.totalIVA)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.75rem', color: '#64748b' }}>Neto Gravado</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>${fmt(summary.totalNeto)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.75rem', color: '#64748b' }}>(-) Comisiones de medios de pago</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>-${fmt(summary.totalComisiones)}</td>
                    </tr>
                    <tr style={{ borderBottom: '2px solid #0f172a', backgroundColor: '#f8fafc' }}>
                      <td style={{ padding: '0.75rem', fontWeight: '700', color: '#0f172a' }}>INGRESO NETO REAL</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800', fontSize: '1.125rem', color: '#15803d' }}>${fmt(summary.totalNeto - summary.totalComisiones)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.75rem', color: '#64748b' }}>(-) Gastos operativos</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>-${fmt(summary.totalGastos)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.75rem', color: '#64748b' }}>    (-) IVA Crédito Fiscal (compras)</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#64748b' }}>-${fmt(summary.totalGastosIVA)}</td>
                    </tr>
                    <tr style={{ backgroundColor: summary.resultado >= 0 ? '#f0fdf4' : '#fef2f2', borderBottom: '2px solid #0f172a' }}>
                      <td style={{ padding: '0.75rem', fontWeight: '800', color: '#0f172a', fontSize: '1rem' }}>RESULTADO DEL EJERCICIO</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800', fontSize: '1.25rem', color: summary.resultado >= 0 ? '#15803d' : '#b91c1c' }}>${fmt(summary.resultado)}</td>
                    </tr>
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
                    <div style={{ fontWeight: '800', color: '#dc2626', fontSize: '1.125rem' }}>${fmt(summary.totalIVA - summary.totalGastosIVA)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: LIBRO IVA VENTAS */}
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
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>${fmt(row.bruto)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>${fmt(row.neto)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#dc2626' }}>${fmt(row.iva)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#dc2626' }}>${fmt(row.comision)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#15803d' }}>${fmt(row.netoReal)}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #0f172a', fontWeight: '800' }}>
                        <td colSpan="3" style={{ padding: '0.75rem', textAlign: 'right', color: '#0f172a' }}>TOTALES</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${fmt(summary.totalFacturado)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${fmt(summary.totalNeto)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#dc2626' }}>${fmt(summary.totalIVA)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#dc2626' }}>${fmt(summary.totalComisiones)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#15803d' }}>${fmt(summary.totalNeto - summary.totalComisiones)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECCIÓN 3: LIBRO IVA COMPRAS */}
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
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>${fmt(row.bruto)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>${fmt(row.neto)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#2563eb' }}>${fmt(row.iva)}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #0f172a', fontWeight: '800' }}>
                        <td colSpan="3" style={{ padding: '0.75rem', textAlign: 'right', color: '#0f172a' }}>TOTALES</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${fmt(summary.totalGastos)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${fmt(summary.totalGastosNeto)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#2563eb' }}>${fmt(summary.totalGastosIVA)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECCIÓN 4: DESGLOSE POR MEDIO DE PAGO */}
            {methodSummary.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1rem', color: 'white', fontWeight: '700', fontSize: '0.875rem' }}>
                  💳 DESGLOSE POR MEDIO DE PAGO
                </div>
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
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>${fmt(m.bruto)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#dc2626' }}>${fmt(m.iva)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#dc2626' }}>${fmt(m.comisiones)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#15803d' }}>${fmt(m.neto - m.comisiones)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECCIÓN 5: CALENDARIO DE ACREDITACIONES */}
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
                               isToday ? <span style={{ color: '#3b82f6', fontWeight: '700' }}> Hoy</span> : 
                               <span style={{ color: '#d97706', fontWeight: '700' }}>⏳ Pendiente</span>}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#15803d' }}>${fmt(day.total)}</td>
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

      <BottomNav activeTab="reportes" />
    </main>
  )
}
