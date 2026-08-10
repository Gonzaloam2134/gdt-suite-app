import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

export default function Reportes() {
  const [user, setUser] = useState(null)
  const [businessName, setBusinessName] = useState('Mi Negocio')
  const [loading, setLoading] = useState(true)
  const [cashflowData, setCashflowData] = useState([])
  const [totalAvailable, setTotalAvailable] = useState(0)
  const [totalInTransit, setTotalInTransit] = useState(0)
  
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

      const hoy = new Date().toISOString().split('T')[0]
      
      const { data: transactions } = await supabase
        .from('transacciones')
        .select(`
          *,
          medios_pago (
            id,
            nombre,
            dias_acreditacion,
            cuenta_bancaria,
            subcategorias_pago (
              id,
              nombre,
              categorias_pago (id, nombre, icono)
            )
          )
        `)
        .eq('local_id', activeLocalId)
        .eq('tipo', 'COBRO_RECIBIDO')
        .order('creado_en', { ascending: false })
        .limit(100)

      if (transactions) {
        const available = transactions
          .filter(t => {
            const accreditationDate = t.fecha_acreditacion_estimada || hoy
            return accreditationDate <= hoy
          })
          .reduce((sum, t) => sum + (t.monto - (t.comision_monto || 0)), 0)

        const inTransit = transactions
          .filter(t => {
            const accreditationDate = t.fecha_acreditacion_estimada || hoy
            return accreditationDate > hoy
          })
          .reduce((sum, t) => sum + (t.monto - (t.comision_monto || 0)), 0)

        setTotalAvailable(available)
        setTotalInTransit(inTransit)

        // Agrupar por fecha de acreditación
        const groupedByDate = transactions.reduce((acc, t) => {
          const date = t.fecha_acreditacion_estimada || hoy
          if (!acc[date]) {
            acc[date] = {
              date,
              total: 0,
              methods: {}
            }
          }
          acc[date].total += (t.monto - (t.comision_monto || 0))
          
          const methodName = t.medios_pago?.nombre || 'Desconocido'
          const cuentaBancaria = t.medios_pago?.cuenta_bancaria
          const key = cuentaBancaria ? `${methodName} (${cuentaBancaria})` : methodName
          
          if (!acc[date].methods[key]) {
            acc[date].methods[key] = 0
          }
          acc[date].methods[key] += (t.monto - (t.comision_monto || 0))
          
          return acc
        }, {})

        const cashflow = Object.values(groupedByDate)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
        
        setCashflowData(cashflow)
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

  const hoy = new Date().toISOString().split('T')[0]

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1rem', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '700' }}>{businessName}</h1>
            <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Reportes y Cashflow</p>
          </div>
          <button onClick={handleSignOut} style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}>Salir</button>
        </div>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        {/* RESUMEN GENERAL */}
        <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: '700' }}>💰 Resumen de Caja</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '2px solid #16a34a' }}>
              <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: '700', marginBottom: '0.5rem' }}>✅ DISPONIBLE HOY</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#15803d' }}>${totalAvailable.toFixed(2)}</div>
            </div>
            <div style={{ backgroundColor: '#fffbeb', padding: '1rem', borderRadius: '8px', border: '2px solid #d97706' }}>
              <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: '700', marginBottom: '0.5rem' }}>⏳ EN TRÁNSITO</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#d97706' }}>${totalInTransit.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* CASHFLOW REPORT */}
        <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: '700' }}> Proyección de Ingresos</h2>
          
          {cashflowData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              No hay transacciones registradas
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {cashflowData.map(day => {
                const isToday = day.date === hoy
                const isPast = day.date < hoy
                
                return (
                  <div 
                    key={day.date} 
                    style={{ 
                      padding: '1rem', 
                      backgroundColor: isToday ? '#f0fdf4' : isPast ? '#f8fafc' : 'white',
                      borderRadius: '8px', 
                      border: isToday ? '2px solid #16a34a' : '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.875rem', color: '#0f172a' }}>
                          {isToday ? '📅 Hoy' : isPast ? '✅' : '📅'} {new Date(day.date).toLocaleDateString('es-AR')}
                        </div>
                        {isPast && <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>Acreditado</div>}
                        {isToday && <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>Disponible hoy</div>}
                        {!isToday && !isPast && <div style={{ fontSize: '0.7rem', color: '#d97706' }}>En tránsito</div>}
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '800', color: '#0f172a' }}>
                        ${day.total.toFixed(2)}
                      </div>
                    </div>
                    
                    {Object.entries(day.methods).length > 0 && (
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                        {Object.entries(day.methods).map(([method, amount]) => (
                          <div key={method} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
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
          )}
        </div>
      </div>

      <BottomNav activeTab="reportes" />
    </main>
  )
}
