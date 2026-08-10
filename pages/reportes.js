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
      
      console.log('🔍 activeLocalId usado:', activeLocalId)

      const { data: localData } = await supabase.from('locales').select('nombre').eq('id', activeLocalId).single()
      if (localData) setBusinessName(localData.nombre)

      const hoy = new Date()
      const hoyStr = hoy.toISOString().split('T')[0]
      
      const primerDiaMes = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0)).toISOString()
      const ultimoDiaMes = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999)).toISOString()
      
      console.log('🔍 FILTROS DE FECHA:', { primerDiaMes, ultimoDiaMes })

      // ✅ CONSULTA SIMPLIFICADA para descartar errores de relaciones anidadas
      const { data: currentMonthTx, error: txError } = await supabase
        .from('transacciones')
        .select(`
          id,
          tipo,
          monto,
          comision_monto,
          fecha_acreditacion_estimada,
          creado_en,
          medios_pago (
            id,
            nombre,
            banco_emisor
          )
        `)
        .eq('local_id', activeLocalId)
        .gte('creado_en', primerDiaMes)
        .lte('creado_en', ultimoDiaMes)
        .order('creado_en', { ascending: false })

      if (txError) {
        console.error('❌ DETALLE DEL ERROR:', JSON.stringify(txError, null, 2))
      } else {
        console.log('✅ Transacciones encontradas:', currentMonthTx?.length || 0)
      }

      // Si hay datos, procesamos el resumen básico
      if (currentMonthTx && currentMonthTx.length > 0) {
        const totalFacturado = currentMonthTx
          .filter(t => t.tipo === 'COBRO_RECIBIDO')
          .reduce((sum, t) => sum + t.monto, 0)

        const totalComisiones = currentMonthTx
          .filter(t => t.tipo === 'COBRO_RECIBIDO')
          .reduce((sum, t) => sum + (t.comision_monto || 0), 0)

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
          totalGastos,
          yaAcreditado,
          porAcreditar,
          cantidadTransacciones: currentMonthTx.filter(t => t.tipo === 'COBRO_RECIBIDO').length
        })

        // Desglose por medio de pago (simplificado)
        const methodsMap = {}
        currentMonthTx
          .filter(t => t.tipo === 'COBRO_RECIBIDO')
          .forEach(t => {
            const method = t.medios_pago
            const key = method ? (method.banco_emisor ? `${method.nombre} (${method.banco_emisor})` : method.nombre) : 'Desconocido'
            
            if (!methodsMap[key]) {
              methodsMap[key] = { nombre: key, facturado: 0, comisiones: 0, neto: 0, cantidad: 0, yaAcreditado: 0, porAcreditar: 0 }
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
      }
    } catch (err) {
      console.error('❌ Error general:', err)
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
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Cargando o sin datos...</h3>
          </div>
        )}

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
