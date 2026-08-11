import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

export default function Reportes() {
  const [user, setUser] = useState(null)
  const [businessName, setBusinessName] = useState('Mi Negocio')
  const [loading, setLoading] = useState(true)
  const [monthlySummary, setMonthlySummary] = useState(null)
  const [methodBreakdown, setMethodBreakdown] = useState([])
  const [accreditationCalendar, setAccreditationCalendar] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  
  const router = useRouter()
  const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        if (activeLocalId) {
          loadReportes(selectedMonth)
        } else {
          router.push('/locales')
        }
      }
    })
  }, [router, activeLocalId])

  useEffect(() => {
    if (user && activeLocalId) {
      loadReportes(selectedMonth)
    }
  }, [selectedMonth])

  const loadReportes = async (monthDate) => {
    try {
      setLoading(true)
      
      // 1. Cargar nombre del local
      const { data: localData } = await supabase.from('locales').select('nombre').eq('id', activeLocalId).single()
      if (localData) setBusinessName(localData.nombre)

      const hoy = new Date()
      const hoyStr = hoy.toISOString().split('T')[0]
      
      // Fechas del mes seleccionado (UTC)
      const primerDiaMes = new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0)).toISOString()
      const ultimoDiaMes = new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)).toISOString()

      // 2. Cargar MEDIOS DE PAGO
      const { data: mediosData } = await supabase
        .from('medios_pago')
        .select('id, nombre, banco_emisor, dias_acreditacion')
        .eq('local_id', activeLocalId)

      const mediosMap = new Map()
      if (mediosData) {
        mediosData.forEach(m => mediosMap.set(m.id, m))
      }

      // 3. Cargar TRANSACCIONES del mes seleccionado
      const { data: transacciones, error: txError } = await supabase
        .from('transacciones')
        .select('*')
        .eq('local_id', activeLocalId)
        .gte('creado_en', primerDiaMes)
        .lte('creado_en', ultimoDiaMes)

      if (txError) {
        console.error('Error cargando transacciones:', txError)
        return
      }

      if (transacciones && transacciones.length > 0) {
        // --- CÁLCULOS CONTABLES ---
        let totalFacturado = 0
        let totalComisiones = 0
        let totalGastos = 0
        let yaAcreditado = 0
        let porAcreditar = 0
        let cantVentas = 0

        const methodsMap = {}
        const calendarMap = {}

        transacciones.forEach(t => {
          const medio = mediosMap.get(t.medio_pago_id) || { nombre: 'Sin Medio', banco_emisor: '', dias_acreditacion: 0 }
          const key = medio.banco_emisor ? `${medio.nombre} (${medio.banco_emisor})` : medio.nombre

          if (!methodsMap[key]) {
            methodsMap[key] = { nombre: key, facturado: 0, comisiones: 0, neto: 0, cantidad: 0, yaAcreditado: 0, porAcreditar: 0 }
          }

          if (t.tipo === 'COBRO_RECIBIDO') {
            const monto = t.monto || 0
            const comision = t.comision_monto || 0
            const neto = monto - comision

            totalFacturado += monto
            totalComisiones += comision
            cantVentas++

            methodsMap[key].facturado += monto
            methodsMap[key].comisiones += comision
            methodsMap[key].neto += neto
            methodsMap[key].cantidad++

            // Calcular fecha de acreditación
            let fechaAcred = t.fecha_acreditacion_estimada
            if (!fechaAcred) {
              const diasAcred = medio.dias_acreditacion || 0
              const fechaCreado = new Date(t.creado_en)
              fechaCreado.setDate(fechaCreado.getDate() + diasAcred)
              fechaAcred = fechaCreado.toISOString().split('T')[0]
            }

            // Agregar al calendario de acreditaciones
            if (!calendarMap[fechaAcred]) {
              calendarMap[fechaAcred] = {
                fecha: fechaAcred,
                total: 0,
                medios: {}
              }
            }
            calendarMap[fechaAcred].total += neto
            if (!calendarMap[fechaAcred].medios[key]) {
              calendarMap[fechaAcred].medios[key] = 0
            }
            calendarMap[fechaAcred].medios[key] += neto

            // Lógica de acreditación (comparando con hoy, no con el mes seleccionado)
            if (fechaAcred <= hoyStr) {
              yaAcreditado += neto
              methodsMap[key].yaAcreditado += neto
            } else {
              porAcreditar += neto
              methodsMap[key].porAcreditar += neto
            }

          } else if (t.tipo === 'GASTO_REGISTRADO') {
            totalGastos += (t.monto || 0)
          }
        })

        setMonthlySummary({
          totalFacturado,
          totalComisiones,
          totalGastos,
          yaAcreditado,
          porAcreditar,
          cantidadTransacciones: cantVentas
        })

        setMethodBreakdown(Object.values(methodsMap).sort((a, b) => b.neto - a.neto))

        // Ordenar calendario por fecha
        const calendar = Object.values(calendarMap).sort((a, b) => a.fecha.localeCompare(b.fecha))
        setAccreditationCalendar(calendar)
      } else {
        // Si no hay transacciones, resetear todo
        setMonthlySummary(null)
        setMethodBreakdown([])
        setAccreditationCalendar([])
      }
    } catch (err) {
      console.error('Error general:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousMonth = () => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(newDate.getMonth() - 1)
    setSelectedMonth(newDate)
  }

  const handleNextMonth = () => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(newDate.getMonth() + 1)
    setSelectedMonth(newDate)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleExportExcel = () => {
    alert('📊 Función de exportación a Excel en desarrollo. Próximamente disponible.')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  const hoy = new Date()
  const hoyStr = hoy.toISOString().split('T')[0]
  const nombreMes = selectedMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const isCurrentMonth = selectedMonth.getMonth() === hoy.getMonth() && selectedMonth.getFullYear() === hoy.getFullYear()

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1rem', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '700' }}>{businessName}</h1>
            <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>
              Reportes • {nombreMes}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={handleExportExcel}
              style={{ padding: '6px 10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
            >
              📊 Exportar
            </button>
            <button onClick={handleSignOut} style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}>Salir</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        {/* NAVEGACIÓN DE MESES */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginBottom: '1rem', backgroundColor: 'white', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <button 
            onClick={handlePreviousMonth}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
          >
            ← Anterior
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', textTransform: 'capitalize' }}>
              {nombreMes}
            </div>
            {isCurrentMonth && (
              <div style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: '600' }}>Mes actual</div>
            )}
          </div>
          <button 
            onClick={handleNextMonth}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
          >
            Siguiente →
          </button>
        </div>

        {/* RESUMEN DEL MES */}
        {monthlySummary ? (
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: '700' }}>📊 Resumen del Mes</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '2px solid #16a34a' }}>
                <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: '700', marginBottom: '0.25rem' }}>FACTURADO</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#15803d' }}>${monthlySummary.totalFacturado.toFixed(2)}</div>
                <div style={{ fontSize: '0.65rem', color: '#166534', marginTop: '0.25rem' }}>{monthlySummary.cantidadTransacciones} ventas</div>
              </div>
              <div style={{ backgroundColor: '#fee2e2', padding: '1rem', borderRadius: '8px', border: '2px solid #dc2626' }}>
                <div style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: '700', marginBottom: '0.25rem' }}>COMISIONES</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#b91c1c' }}>-${monthlySummary.totalComisiones.toFixed(2)}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Gastos del mes:</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#dc2626' }}>-${monthlySummary.totalGastos.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '2px solid #0f172a' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#0f172a' }}>RESULTADO NETO:</span>
                <span style={{ fontSize: '1rem', fontWeight: '800', color: (monthlySummary.totalFacturado - monthlySummary.totalComisiones - monthlySummary.totalGastos) >= 0 ? '#15803d' : '#b91c1c' }}>
                  ${(monthlySummary.totalFacturado - monthlySummary.totalComisiones - monthlySummary.totalGastos).toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
              <div style={{ backgroundColor: '#f0fdf4', padding: '0.75rem', borderRadius: '8px', border: '1px solid #16a34a' }}>
                <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: '700', marginBottom: '0.25rem' }}>✅ YA ACREDITADO</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '800', color: '#15803d' }}>${monthlySummary.yaAcreditado.toFixed(2)}</div>
              </div>
              <div style={{ backgroundColor: '#fffbeb', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d97706' }}>
                <div style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: '700', marginBottom: '0.25rem' }}>⏳ POR ACREDITAR</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '800', color: '#d97706' }}>${monthlySummary.porAcreditar.toFixed(2)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Sin datos este mes</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
              No hay transacciones registradas en {nombreMes}.
            </p>
          </div>
        )}

        {/* CALENDARIO DE ACREDITACIONES */}
        {accreditationCalendar.length > 0 && (
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: '700' }}> Calendario de Acreditaciones</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {accreditationCalendar.map(day => {
                const isPast = day.fecha < hoyStr
                const isToday = day.fecha === hoyStr
                
                return (
                  <div 
                    key={day.fecha}
                    style={{ 
                      padding: '0.75rem', 
                      backgroundColor: isToday ? '#f0fdf4' : isPast ? '#f8fafc' : 'white',
                      borderRadius: '8px', 
                      border: isToday ? '2px solid #16a34a' : isPast ? '1px solid #e2e8f0' : '1px solid #fcd34d'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.875rem', color: '#0f172a' }}>
                          {isToday ? '📍 Hoy' : isPast ? '✅' : '⏳'} {new Date(day.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        {isPast && <div style={{ fontSize: '0.65rem', color: '#16a34a' }}>Acreditado</div>}
                        {isToday && <div style={{ fontSize: '0.65rem', color: '#16a34a' }}>Se acredita hoy</div>}
                        {!isPast && !isToday && <div style={{ fontSize: '0.65rem', color: '#d97706' }}>Pendiente</div>}
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '800', color: '#0f172a' }}>
                        ${day.total.toFixed(2)}
                      </div>
                    </div>
                    
                    {Object.entries(day.medios).length > 0 && (
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                        {Object.entries(day.medios).map(([method, amount]) => (
                          <div key={method} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                            <span style={{ color: '#64748b' }}>{method}</span>
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>${amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* DESGLOSE POR MEDIO DE PAGO */}
        {methodBreakdown.length > 0 && (
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: '700' }}>💳 Desglose por Medio de Pago</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {methodBreakdown.map(method => (
                <div key={method.nombre} style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: '700', fontSize: '0.875rem', color: '#0f172a' }}>{method.nombre}</div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: '#15803d' }}>${method.neto.toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.7rem' }}>
                    <div><div style={{ color: '#64748b' }}>Facturado</div><div style={{ fontWeight: '600' }}>${method.facturado.toFixed(2)}</div></div>
                    <div><div style={{ color: '#64748b' }}>Comisiones</div><div style={{ fontWeight: '600', color: '#dc2626' }}>-${method.comisiones.toFixed(2)}</div></div>
                    <div><div style={{ color: '#64748b' }}>Ventas</div><div style={{ fontWeight: '600' }}>{method.cantidad}</div></div>
                  </div>
                  {(method.yaAcreditado > 0 || method.porAcreditar > 0) && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #e2e8f0', fontSize: '0.7rem' }}>
                      {method.yaAcreditado > 0 && (
                        <div style={{ flex: 1, backgroundColor: '#f0fdf4', padding: '0.25rem', borderRadius: '4px', textAlign: 'center' }}>
                          <div style={{ color: '#166534', fontSize: '0.65rem' }}>Acreditado</div>
                          <div style={{ fontWeight: '700', color: '#15803d' }}>${method.yaAcreditado.toFixed(2)}</div>
                        </div>
                      )}
                      {method.porAcreditar > 0 && (
                        <div style={{ flex: 1, backgroundColor: '#fffbeb', padding: '0.25rem', borderRadius: '4px', textAlign: 'center' }}>
                          <div style={{ color: '#b45309', fontSize: '0.65rem' }}>En tránsito</div>
                          <div style={{ fontWeight: '700', color: '#d97706' }}>${method.porAcreditar.toFixed(2)}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav activeTab="reportes" />
    </main>
  )
}
