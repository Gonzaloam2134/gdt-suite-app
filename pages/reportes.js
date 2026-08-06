import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

export default function Reportes() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [globalTotals, setGlobalTotals] = useState({ in: 0, out: 0, commissions: 0, net: 0, count: 0 })
  const [todayTotals, setTodayTotals] = useState({ in: 0, out: 0, commissions: 0, net: 0, count: 0 })
  const [weekTotals, setWeekTotals] = useState({ in: 0, out: 0, commissions: 0, net: 0, count: 0 })
  const [monthTotals, setMonthTotals] = useState({ in: 0, out: 0, commissions: 0, net: 0, count: 0 })
  const [totalShifts, setTotalShifts] = useState(0)
  const [topMethods, setTopMethods] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  
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

      // 1. Cargar medios de pago
      const { data: pmData } = await supabase
        .from('medios_pago')
        .select('*')
        .eq('local_id', activeLocalId)
      setPaymentMethods(pmData || [])

      // 2. Cargar todas las transacciones del local
      const { data: allTx } = await supabase
        .from('transacciones')
        .select('*')
        .eq('local_id', activeLocalId)
        .order('creado_en', { ascending: false })

      const transactions = allTx || []

      // Función auxiliar para calcular totales (evita repetir código)
      const calculateTotals = (txList) => {
        return txList.reduce((acc, curr) => {
          const isIncome = curr.tipo === 'COBRO_RECIBIDO' || curr.tipo === 'CAJA_ABIERTA'
          const commission = curr.comision_monto || 0
          if (isIncome) {
            acc.in += curr.monto
            acc.commissions += commission
            acc.net += curr.monto - commission
          } else {
            acc.out += curr.monto
          }
          acc.count++
          return acc
        }, { in: 0, out: 0, commissions: 0, net: 0, count: 0 })
      }

      // 3. Calcular totales globales
      setGlobalTotals(calculateTotals(transactions))

      // 4. Totales de hoy
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTx = transactions.filter(t => new Date(t.creado_en) >= today)
      setTodayTotals(calculateTotals(todayTx))

      // 5. Totales de la semana (últimos 7 días)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekTx = transactions.filter(t => new Date(t.creado_en) >= weekAgo)
      setWeekTotals(calculateTotals(weekTx))

      // 6. Totales del mes (últimos 30 días)
      const monthAgo = new Date()
      monthAgo.setDate(monthAgo.getDate() - 30)
      const monthTx = transactions.filter(t => new Date(t.creado_en) >= monthAgo)
      setMonthTotals(calculateTotals(monthTx))

      // 7. Cantidad de turnos cerrados
      const { count: shiftsCount } = await supabase
        .from('turnos')
        .select('*', { count: 'exact', head: true })
        .eq('local_id', activeLocalId)
        .eq('estado', 'CERRADO')
      setTotalShifts(shiftsCount || 0)

      // 8. Top medios de pago
      const methodCounts = {}
      transactions.forEach(t => {
        if (t.medio_pago_id) {
          methodCounts[t.medio_pago_id] = (methodCounts[t.medio_pago_id] || 0) + 1
        }
      })
      const sorted = Object.entries(methodCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([methodId, count]) => {
          const method = pmData?.find(m => m.id === methodId)
          return { name: method?.nombre || 'Desconocido', count }
        })
      setTopMethods(sorted)

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

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando reportes...</div>
  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '700' }}>📊 Reportes</h1>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Resumen global de tu negocio</p>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Histórico</div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff' }}>${globalTotals.net.toFixed(2)}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
            {globalTotals.count} transacciones • {totalShifts} cierres de caja
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {/* Hoy */}
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>📅 Hoy</h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{todayTotals.count} movs</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>BRUTO</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#15803d' }}>${todayTotals.in.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>COMIS</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#dc2626' }}>-${todayTotals.commissions.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>NETO</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#059669' }}>${todayTotals.net.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>GASTOS</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#b91c1c' }}>${todayTotals.out.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Última Semana */}
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>📆 Última Semana</h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{weekTotals.count} movs</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>BRUTO</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#15803d' }}>${weekTotals.in.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>COMIS</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#dc2626' }}>-${weekTotals.commissions.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>NETO</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#059669' }}>${weekTotals.net.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>GASTOS</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#b91c1c' }}>${weekTotals.out.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Último Mes */}
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>🗓️ Último Mes</h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{monthTotals.count} movs</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>BRUTO</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#15803d' }}>${monthTotals.in.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>COMIS</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#dc2626' }}>-${monthTotals.commissions.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>NETO</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#059669' }}>${monthTotals.net.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>GASTOS</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#b91c1c' }}>${monthTotals.out.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {topMethods.length > 0 && (
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>🏆 Top Medios de Pago</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {topMethods.map((method, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}</span>
                    <span style={{ fontWeight: '600', fontSize: '0.875rem', color: '#0f172a' }}>{method.name}</span>
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#64748b' }}>{method.count} usos</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ backgroundColor: '#fef3c7', padding: '1rem', borderRadius: '10px', border: '1px solid #fcd34d', marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '700', color: '#92400e' }}>📋 Resumen para el Contador (Mes)</h3>
          <div style={{ fontSize: '0.75rem', color: '#78350f', lineHeight: '1.6' }}>
            <div>Ventas brutas: <strong>${monthTotals.in.toFixed(2)}</strong></div>
            <div>Comisiones de medios de pago: <strong>-${monthTotals.commissions.toFixed(2)}</strong></div>
            <div>Ventas netas: <strong>${monthTotals.net.toFixed(2)}</strong></div>
            <div>Gastos operativos: <strong>${monthTotals.out.toFixed(2)}</strong></div>
            <div style={{ borderTop: '1px solid #fcd34d', paddingTop: '0.5rem', marginTop: '0.5rem', fontWeight: '700' }}>
              Resultado neto: <strong>${(monthTotals.net - monthTotals.out).toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </div>

      <BottomNav activeTab="reportes" />
    </main>
  )
}
