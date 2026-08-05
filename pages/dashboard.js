import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

export default function CajaDelDia() {
  const [user, setUser] = useState(null)
  const [businessName, setBusinessName] = useState('Mi Negocio')
  const [movements, setMovements] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('INCOME')
  
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMethod, setSelectedMethod] = useState('')
  const [creating, setCreating] = useState(false)
  
  const router = useRouter()
  const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkspaceId') : null

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        if (activeWorkspaceId) {
          loadData(session.user.id)
        } else {
          router.push('/workspaces')
        }
      }
    })
    return () => {}
  }, [router, activeWorkspaceId])

  const loadData = async (userId) => {
    try {
      setLoading(true)
      const { data: wsData } = await supabase.from('workspaces').select('name').eq('id', activeWorkspaceId).single()
      if (wsData) setBusinessName(wsData.name)

      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: false })
        .limit(50)

      setMovements(txData || [])
      
      const { data: pmData } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .eq('is_active', true)

      setPaymentMethods(pmData || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const totals = movements.reduce((acc, curr) => {
    const isIncome = curr.type === 'PAYMENT_RECEIVED' || curr.type === 'CASH_OPENED'
    const net = curr.amount - (curr.commission_amount || 0)
    if (isIncome) acc.in += net
    else acc.out += net
    return acc
  }, { in: 0, out: 0 })

  const handleOpenForm = (type) => {
    setFormType(type)
    setAmount('')
    setDescription('')
    setSelectedMethod('')
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || !description || !selectedMethod) return alert('Completá todos los campos')

    try {
      setCreating(true)
      const method = paymentMethods.find(m => m.id === selectedMethod)
      const isIncome = formType === 'INCOME'
      const type = isIncome ? 'PAYMENT_RECEIVED' : 'EXPENSE_REGISTERED'
      const commission = isIncome ? ((parseFloat(amount) * (method.commission_value || 0)) / 100) + (method.commission_fixed || 0) : 0

      const { data: business } = await supabase.from('businesses').select('id').eq('workspace_id', activeWorkspaceId).limit(1)
      const bizId = business?.[0]?.id || '00000000-0000-0000-0000-000000000000'

      const { error } = await supabase.from('transactions').insert([{
        workspace_id: activeWorkspaceId,
        business_id: bizId,
        branch_id: bizId,
        cash_point_id: bizId,
        shift_id: bizId,
        type,
        amount: parseFloat(amount),
        commission_amount: commission,
        payment_method_id: method.id,
        payment_status: 'ACREDITED',
        description,
        category: formType === 'INCOME' ? 'Ventas' : 'Gastos',
        created_by: user.id
      }])

      if (error) throw error
      
      setShowForm(false)
      loadData(user.id)
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', fontSize: '18px' }}>Cargando libreta...</div>

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: '800' }}>{businessName}</h1>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>Caja del Día • {new Date().toLocaleDateString('es-AR')}</p>
          </div>
          <button onClick={handleSignOut} style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', color: '#64748b', cursor: 'pointer', fontSize: '0.875rem' }}>Salir</button>
        </div>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>
        {/* Resumen de Caja */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ backgroundColor: '#dcfce7', padding: '1.5rem', borderRadius: '12px', border: '1px solid #86efac' }}>
            <div style={{ fontSize: '0.875rem', color: '#166534', fontWeight: '600', marginBottom: '0.5rem' }}>ENTRADAS</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#15803d' }}>${totals.in.toFixed(2)}</div>
          </div>
          <div style={{ backgroundColor: '#fee2e2', padding: '1.5rem', borderRadius: '12px', border: '1px solid #fca5a5' }}>
            <div style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: '600', marginBottom: '0.5rem' }}>SALIDAS</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#b91c1c' }}>${totals.out.toFixed(2)}</div>
          </div>
        </div>
        
        <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Saldo en Caja</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#ffffff' }}>${(totals.in - totals.out).toFixed(2)}</div>
        </div>

        {/* Botones de Acción */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <button 
            onClick={() => handleOpenForm('INCOME')}
            style={{ padding: '1.5rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.125rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
          >
            <span style={{ fontSize: '2rem' }}>💰</span>
            COBRO
          </button>
          <button 
            onClick={() => handleOpenForm('EXPENSE')}
            style={{ padding: '1.5rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.125rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
          >
            <span style={{ fontSize: '2rem' }}>💸</span>
            GASTO
          </button>
        </div>

        {/* Lista de Movimientos */}
        <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#334155', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📖 Últimos Movimientos
        </h3>
        
        {movements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', backgroundColor: 'white', borderRadius: '12px', border: '2px dashed #cbd5e1' }}>
            La libreta está vacía.<br/>Registrá tu primer movimiento.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {movements.map(m => {
              const isIncome = m.type === 'PAYMENT_RECEIVED' || m.type === 'CASH_OPENED'
              const method = paymentMethods.find(pm => pm.id === m.payment_method_id)
              const net = m.amount - (m.commission_amount || 0)
              
              return (
                <div key={m.id} style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: isIncome ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                      {isIncome ? '' : '📤'}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '1rem' }}>{m.description}</div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        {new Date(m.created_at).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})} • {method?.name || 'Efectivo'}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', fontSize: '1.125rem', color: isIncome ? '#15803d' : '#b91c1c' }}>
                      {isIncome ? '+' : '-'}${net.toFixed(2)}
                    </div>
                    {m.commission_amount > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Comisión: ${m.commission_amount.toFixed(2)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Formulario */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '600px', margin: '0 auto', borderRadius: '20px 20px 0 0', padding: '2rem', boxShadow: '0 -10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: formType === 'INCOME' ? '#15803d' : '#b91c1c' }}>
                {formType === 'INCOME' ? '💰 Registrar Cobro' : '💸 Registrar Gasto'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#334155' }}>¿Cuánto?</label>
                <input 
                  type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} 
                  placeholder="0.00" required autoFocus
                  style={{ width: '100%', padding: '1rem', fontSize: '2rem', fontWeight: '800', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box', textAlign: 'right', color: '#0f172a' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#334155' }}>¿Por qué concepto?</label>
                <input 
                  type="text" value={description} onChange={e => setDescription(e.target.value)} 
                  placeholder={formType === 'INCOME' ? 'Ej: Venta del día, Pago de Juan...' : 'Ej: Proveedor, Luz, Gas...'} required
                  style={{ width: '100%', padding: '1rem', fontSize: '1.125rem', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '700', color: '#334155' }}>¿Cómo te pagaron? / ¿Cómo pagaste?</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  {paymentMethods.map(method => (
                    <label 
                      key={method.id}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', 
                        border: selectedMethod === method.id ? `2px solid ${formType === 'INCOME' ? '#16a34a' : '#dc2626'}` : '2px solid #e2e8f0',
                        borderRadius: '12px', cursor: 'pointer', backgroundColor: selectedMethod === method.id ? (formType === 'INCOME' ? '#f0fdf4' : '#fef2f2') : 'white'
                      }}
                    >
                      <input type="radio" name="method" value={method.id} checked={selectedMethod === method.id} onChange={() => setSelectedMethod(method.id)} style={{ width: '20px', height: '20px' }} />
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{method.name}</div>
                        {method.subtype && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{method.subtype}</div>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button 
                type="submit" disabled={creating}
                style={{ width: '100%', padding: '1.25rem', backgroundColor: formType === 'INCOME' ? '#16a34a' : '#dc2626', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.25rem', fontWeight: '800', cursor: 'pointer', opacity: creating ? 0.7 : 1 }}
              >
                {creating ? 'Guardando...' : (formType === 'INCOME' ? '✅ CONFIRMAR COBRO' : '✅ CONFIRMAR GASTO')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav activeTab="caja" />
    </main>
  )
}
