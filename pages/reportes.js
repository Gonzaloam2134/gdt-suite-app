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
  const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkspaceId') : null

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        if (activeWorkspaceId) {
          loadReportes()
        } else {
          router.push('/workspaces')
        }
      }
    })
  }, [router, activeWorkspaceId])

  const loadReportes = async () => {
    try {
      setLoading(true)

      // Cargar medios de pago para mostrar nombres
      const { data: pmData } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
      setPaymentMethods(pmData || [])

      // Cargar todas las transacciones del workspace
      const { data: allTx } = await supabase
        .from('transactions')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: false })

      const transactions = allTx || []

      // Calcular totales globales
      const global = transactions.reduce((acc, curr) => {
        const isIncome = curr.type === 'PAYMENT_RECEIVED' || curr.type === 'CASH_OPENED'
        const commission = curr.commission_amount || 0
        if (isIncome) {
          acc.in += curr.amount
          acc.commissions += commission
          acc.net += curr.amount - commission
        } else {
          acc.out += curr.amount
        }
        acc.count++
        return acc
      }, { in: 0, out: 0, commissions: 0, net: 0, count: 0 })
      setGlobalTotals(global)

      // Totales de hoy
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTx = transactions.filter(t => new Date(t.created_at) >= today)
      const todayTot = todayTx.reduce((acc, curr) => {
        const isIncome = curr.type === 'PAYMENT_RECEIVED' || curr.type === 'CASH_OPENED'
        const commission = curr.commission_amount || 0
        if (isIncome) {
          acc.in += curr.amount
          acc.commissions += commission
          acc.net += curr.amount - commission
        } else {
          acc.out += curr.amount
        }
        acc.count++
        return acc
      }, { in: 0, out: 0, commissions: 0, net: 0, count: 0 })
      setTodayTotals(todayTot)

      // Totales de la semana (últimos 7 días)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekTx = transactions.filter(t => new Date(t.created_at) >= weekAgo)
      const weekTot = weekTx.reduce((acc, curr) => {
        const isIncome = curr.type === 'PAYMENT_RECEIVED' || curr.type === 'CASH_OPENED'
        const commission = curr.commission_amount || 0
        if (isIncome) {
          acc.in += curr.amount
          acc.commissions += commission
          acc.net += curr.amount - commission
        } else {
          acc.out += curr.amount
        }
        acc.count++
        return acc
      }, { in: 0, out: 0, commissions: 0, net: 0, count: 0 })
      setWeekTotals(weekTot)

      // Totales del mes (últimos 30 días)
      const monthAgo = new Date()
      monthAgo.setDate(monthAgo.getDate() - 30)
      const monthTx = transactions.filter(t => new Date(t.created_at) >= monthAgo)
      const monthTot = monthTx.reduce((acc, curr) => {
        const isIncome = curr.type === 'PAYMENT_RECEIVED' || curr.type === 'CASH_OPENED'
        const commission = curr.commission_amount || 0
        if (isIncome) {
          acc.in += curr.amount
          acc.commissions += commission
          acc.net += curr.amount - commission
        } else {
          acc.out += curr.amount
        }
        acc.count++
        return acc
      }, { in: 0, out: 0, commissions: 0, net: 0, count: 0 })
      setMonthTotals(monthTot)

      // Cantidad de shifts cerrados
      const { count: shiftsCount } = await supabase
        .from('shifts')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', activeWorkspaceId)
        .eq('status', 'CLOSED')
      setTotalShifts(shiftsCount || 0)

      // Top medios de pago (por cantidad de transacciones)
      const methodCounts = {}
      transactions.forEach(t => {
        if (t.payment_method_id) {
          methodCounts[t.payment_method_id] = (methodCounts[t.payment_method_id] || 0) + 1
        }
      })
      const sorted = Object.entries(methodCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([methodId, count]) => {
          const method = pmData?.find(m => m.id === methodId)
          return { name: method?.name || 'Desconocido', count }
        })
      setTopMethods(sorted)

    } catch (err) {
      console.error('Error loading reportes:', err)
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
        {/* Resumen Global */}
        <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Histórico</div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff' }}>${globalTotals.net.toFixed(2)}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
            {globalTotals.count} transacciones • {totalShifts} cierres de caja
          </div>
        </div>

        {/* Periodos */}
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

          {/* Última semana */}
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

          {/* Último mes */}
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>️ Último Mes</h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{monthTotals.count} movs</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>BRUTO</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#15803d' }}>${monthTotals.in.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>COMIS</div>
