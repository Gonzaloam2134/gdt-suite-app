import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

export default function Reportes() {
  const [user, setUser] = useState(null)
  const [businessName, setBusinessName] = useState('Mi Negocio')
  const [loading, setLoading] = useState(true)
  const [monthlySummary, setMonthlySummary] = useState(null)
  const [weeklyProjection, setWeeklyProjection] = useState([])
  const [methodBreakdown, setMethodBreakdown] = useState([])
  const [lastMonthComparison, setLastMonthComparison] = useState(null)
  
  const router = useRouter()
  const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        if (activeLocalId) {
          loadReportes()
        } else {
          router.push('/locales')
        }
      }
    })
  }, [router, activeLocalId])

  const loadReportes = async () => {
    try {
      setLoading(true)
      
      const { data: localData } = await supabase.from('locales').select('nombre').eq('id', activeLocalId).single()
      if (localData) setBusinessName(localData.nombre)

      const hoy = new Date()
      const hoyStr = hoy.toISOString().split('T')[0]
      
      // Fechas del mes actual en formato ISO completo
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0).toISOString()
      const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()
      
      // Fechas del mes anterior
      const primerDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1, 0, 0, 0, 0).toISOString()
      const ultimoDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999).toISOString()

      console.log('Filtros de fecha:', { primerDiaMes, ultimoDiaMes, activeLocalId })

      // Transacciones del mes actual
      const { data: currentMonthTx, error: txError } = await supabase
        .from('transacciones')
        .select(`
          *,
          medios_pago (
            id,
            nombre,
            dias_acreditacion,
            cuenta_bancaria,
            banco_emisor,
            tipo_comision,
            valor_comision,
            subcategorias_pago (
              id,
              nombre,
              categorias_pago (id, nombre, icono)
            )
          )
        `)
        .eq('local_id', activeLocalId)
        .gte('creado_en', primerDiaMes)
        .lte('creado_en', ultimoDiaMes)
        .order('creado_en', { ascending: false })

      if (txError) {
        console.error('Error en query de transacciones:', txError)
      }

      console.log('Transacciones encontradas:', currentMonthTx?.length || 0)

      // Transacciones del mes anterior
      const { data: lastMonthTx } = await supabase
        .from('transacciones')
        .select('*')
        .eq('local_id', activeLocalId)
        .gte('creado_en', primerDiaMesAnterior)
        .lte('creado_en', ultimoDiaMesAnterior)

      if (currentMonthTx && currentMonthTx.length > 0) {
        // Resumen del mes
        const totalFacturado = currentMonthTx
          .filter(t => t.tipo === 'COBRO_RECIBIDO')
          .reduce((sum, t) => sum + t.monto, 0)

        const totalComisiones = currentMonthTx
          .filter(t => t.tipo === 'COBRO_RECIBIDO')
          .reduce((sum, t) => sum + (t.comision_monto || 0), 0)

        const totalNeto = totalFacturado - totalComisiones

        const totalGastos = currentMonthTx
          .filter(t => t.tipo === 'GASTO_REGISTRADO')
          .reduce((sum, t) => sum + t.monto, 0)

        const yaAcreditado = currentMonthTx
          .filter(t => {
            const isIncome = t.tipo === 'COBRO_RECIBIDO'
            const accreditationDate = t.fecha_acreditacion_estimada || hoyStr
            return isIncome && accreditationDate <= hoyStr
          })
          .reduce((sum, t) => sum + (t.monto - (t.comision_monto || 0)), 0)

        const porAcreditar = currentMonthTx
          .filter(t => {
            const isIncome = t.tipo === 'COBRO_RECIBIDO'
            const accreditationDate = t.fecha_acreditacion_estimada || hoyStr
            return isIncome && accreditationDate > hoyStr
          })
          .reduce((sum, t) => sum + (t.monto - (t.comision_monto || 0)), 0)

        setMonthlySummary({
          totalFacturado,
          totalComisiones,
          totalNeto,
          totalGastos,
          yaAcreditado,
          porAcreditar,
          cantidadTransacciones: currentMonthTx.filter(t => t.tipo === 'COBRO_RECIBIDO').length
        })

        // Proyección semanal
        const semanas = []
        const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
        
        for (let semana = 1; semana <= Math.ceil(diasEnMes / 7); semana++) {
          const inicioSemana = new Date(hoy.getFullYear(), hoy.getMonth(), (semana - 1) * 7 + 1).toISOString().split('T')[0]
          const finSemana = new Date(hoy.getFullYear(), hoy.getMonth(), Math.min(semana * 7, diasEnMes)).toISOString().split('T')[0]
          
          const ingresosSemana = currentMonthTx
            .filter(t => {
              const isIncome = t.tipo === 'COBRO_RECIBIDO'
              const accreditationDate = t.fecha_acreditacion_estimada || hoyStr
              return isIncome && accreditationDate >= inicioSemana && accreditationDate <= finSemana
            })
            .reduce((sum, t) => sum + (t.monto - (t.comision_monto || 0)), 0)

          semanas.push({
            semana,
            inicio: inicioSemana,
            fin: finSemana,
            total: ingresosSemana,
            esSemanaActual: hoy >= new Date(inicioSemana) && hoy <= new Date(finSemana)
          })
        }
        
        setWeeklyProjection(semanas)

        // Desglose por medio de pago
        const methodsMap = {}
        currentMonthTx
          .filter(t => t.tipo === 'COBRO_RECIBIDO')
          .forEach(t => {
            const method = t.medios_pago
            if (!method) return
            
            const methodName = method.nombre || 'Desconocido'
            const banco = method.banco_emisor || ''
            const key = banco ? `${methodName} (${banco})` : methodName
            
            if (!methodsMap[key]) {
              methodsMap[key] = {
                nombre: key,
                facturado: 0,
                comisiones: 0,
                neto: 0,
                cantidad: 0,
                yaAcreditado: 0,
                porAcreditar: 0
              }
            }
            
            methodsMap[key].facturado += t.monto
            methodsMap[key].comisiones += (t.comision_monto || 0)
            methodsMap[key].neto += (t.monto - (t.comision_monto || 0))
            methodsMap[key].cantidad += 1
            
            const accreditationDate = t.fecha_acreditacion_estimada || hoyStr
            if (accreditationDate <= hoyStr) {
              methodsMap[key].yaAcreditado += (t.monto - (t.comision_monto || 0))
            } else {
              methodsMap[key].porAcreditar += (t.monto - (t.comision_monto || 0))
            }
          })
        
        setMethodBreakdown(Object.values(methodsMap).sort((a, b) => b.neto - a.neto))

        // Comparativa con mes anterior
        if (lastMonthTx && lastMonthTx.length > 0) {
          const lastMonthFacturado = lastMonthTx
            .filter(t => t.tipo === 'COBRO_RECIBIDO')
            .reduce((sum, t) => sum + t.monto, 0)

          const lastMonthComisiones = lastMonthTx
            .filter(t => t.tipo === 'COBRO_RECIBIDO')
            .reduce((sum, t) => sum + (t.comision_monto || 0), 0)

          const lastMonthNeto = lastMonthFacturado - lastMonthComisiones

          const variacionFacturacion = lastMonthFacturado > 0 
            ? ((totalFacturado - lastMonthFacturado) / lastMonthFacturado * 100)
            : 0

          setLastMonthComparison({
            facturado: lastMonthFacturado,
            comisiones: lastMonthComisiones,
            neto: lastMonthNeto,
            variacion: variacionFacturacion
          })
        }
      }
    } catch (err) {
      console.error('Error cargando reportes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  const hoy = new Date()
  const nombreMes = hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

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
          <button onClick={handleSignOut} style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}>Salir</button>
        </div>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        {/* RESUMEN DEL MES */}
        {monthlySummary && (
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
                <div style={{ fontSize: '0.65rem', color: '#991b1b', marginTop: '0.25rem' }}>
                  {((monthlySummary.totalComisiones / monthlySummary.totalFacturado) * 100).toFixed(1)}% del facturado
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Neto a recibir:</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#0f172a' }}>${monthlySummary.totalNeto.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Gastos del mes:</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#dc2626' }}>-${monthlySummary.totalGastos.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '2px solid #0f172a' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#0f172a' }}>RESULTADO:</span>
                <span style={{ fontSize: '1rem', fontWeight: '800', color: (monthlySummary.totalNeto - monthlySummary.totalGastos) >= 0 ? '#15803d' : '#b91c1c' }}>
                  ${(monthlySummary.totalNeto - monthlySummary.totalGastos).toFixed(2)}
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
        )}

        {/* PROYECCIÓN SEMANAL */}
        {weeklyProjection.length > 0 && (
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: '700' }}> Proyección de Cobros por Semana</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {weeklyProjection.map(semana => (
                <div 
                  key={semana.semana}
                  style={{ 
                    padding: '0.75rem', 
                    backgroundColor: semana.esSemanaActual ? '#f0fdf4' : '#f8fafc',
                    borderRadius: '8px', 
                    border: semana.esSemanaActual ? '2px solid #16a34a' : '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.875rem', color: '#0f172a' }}>
                        {semana.esSemanaActual ? '' : ''} Semana {semana.semana}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {new Date(semana.inicio).toLocaleDateString('es-AR')} - {new Date(semana.fin).toLocaleDateString('es-AR')}
                      </div>
                    </div>
                    <div style={{ fontSize: '1.125rem', fontWeight: '800', color: semana.total > 0 ? '#15803d' : '#94a3b8' }}>
                      ${semana.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
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
                    <div>
                      <div style={{ color: '#64748b' }}>Facturado</div>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>${method.facturado.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Comisiones</div>
                      <div style={{ fontWeight: '600', color: '#dc2626' }}>-${method.comisiones.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Ventas</div>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{method.cantidad}</div>
                    </div>
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

        {/* COMPARATIVA CON MES ANTERIOR */}
        {lastMonthComparison && (
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: '700' }}>📈 vs Mes Anterior</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>Mes Anterior</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '800', color: '#0f172a' }}>${lastMonthComparison.facturado.toFixed(2)}</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Neto: ${lastMonthComparison.neto.toFixed(2)}</div>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: lastMonthComparison.variacion >= 0 ? '#f0fdf4' : '#fee2e2', borderRadius: '8px', border: `2px solid ${lastMonthComparison.variacion >= 0 ? '#16a34a' : '#dc2626'}` }}>
                <div style={{ fontSize: '0.7rem', color: lastMonthComparison.variacion >= 0 ? '#166534' : '#991b1b', marginBottom: '0.25rem' }}>
                  {lastMonthComparison.variacion >= 0 ? '↑' : '↓'} Variación
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: '800', color: lastMonthComparison.variacion >= 0 ? '#15803d' : '#b91c1c' }}>
                  {lastMonthComparison.variacion >= 0 ? '+' : ''}{lastMonthComparison.variacion.toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                  ${Math.abs(monthlySummary.totalFacturado - lastMonthComparison.facturado).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MENSAJE SI NO HAY DATOS */}
        {!monthlySummary && !loading && (
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Sin datos este mes</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
              Aún no hay transacciones registradas en el mes actual.
            </p>
          </div>
        )}
      </div>

      <BottomNav activeTab="reportes" />
    </main>
  )
}
