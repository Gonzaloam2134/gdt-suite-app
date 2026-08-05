import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

// Conceptos predefinidos
const CONCEPTOS_INGRESO = ['Venta del día', 'Venta mostrador', 'Delivery', 'Servicios', 'Otros ingresos']
const CONCEPTOS_GASTO = ['Proveedor', 'Luz', 'Gas', 'Agua', 'Internet', 'Alquiler', 'Sueldos', 'Impuestos', 'Insumos', 'Otros gastos']

export default function CajaDelDia() {
  const [user, setUser] = useState(null)
  const [businessName, setBusinessName] = useState('Mi Negocio')
  const [movements, setMovements] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('INCOME')
  const [activeShift, setActiveShift] = useState(null)
  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [selectedConcept, setSelectedConcept] = useState('')
  const [customConcept, setCustomConcept] = useState('')
  const [showCustomConcept, setShowCustomConcept] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState('')
  const [openingAmount, setOpeningAmount] = useState('')
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

      const { data: shiftData } = await supabase
        .from('shifts')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      setActiveShift(shiftData || null)

      if (shiftData) {
        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('shift_id', shiftData.id)
          .order('created_at', { ascending: false })
          .limit(50)
        setMovements(txData || [])
      } else {
        setMovements([])
      }
      
      const { data: pmData } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .eq('is_active', true)
        .order('name', { ascending: true })
      setPaymentMethods(pmData || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Cálculo de totales: Bruto, Comisiones, Neto y Salidas
  const totals = movements.reduce((acc, curr) => {
    const isIncome = curr.type === 'PAYMENT_RECEIVED' || curr.type === 'CASH_OPENED'
    const commission = curr.commission_amount || 0
    const net = curr.amount - commission
    
    if (isIncome) {
      acc.in += curr.amount
      acc.commissions += commission
      acc.net += net
    } else {
      acc.out += curr.amount
    }
    return acc
  }, { in: 0, commissions: 0, net: 0, out: 0 })

  const currentBalance = (activeShift?.initial_amount || 0) + totals.net - totals.out

  const handleOpenForm = (type) => {
    setFormType(type)
    setAmount('')
    setDescription('')
    setSelectedConcept('')
    setCustomConcept('')
    setShowCustomConcept(false)
    setSelectedMethod('')
    setShowForm(true)
  }

  const handleOpenShift = async (e) => {
    e.preventDefault()
    if (!openingAmount || openingAmount <= 0) return alert('Ingresá un monto válido')

    try {
      setCreating(true)
      
      let { data: businesses } = await supabase.from('businesses').select('id').eq('workspace_id', activeWorkspaceId).limit(1)
      let bizId
      if (businesses && businesses.length > 0) {
        bizId = businesses[0].id
      } else {
        const { data: newBiz, error: bizError } = await supabase.from('businesses').insert([{ 
          workspace_id: activeWorkspaceId, 
          name: 'Principal', 
          legal_name: 'Negocio Principal', 
          tax_id: '00-00000000-0' 
        }]).select('id').single()
        if (bizError) throw bizError
        bizId = newBiz.id
      }

      let { data: branches } = await supabase.from('branches').select('id').eq('business_id', bizId).limit(1)
      let branchId
      if (branches && branches.length > 0) {
        branchId = branches[0].id
      } else {
        const { data: newBranch, error: branchError } = await supabase.from('branches').insert([{ 
          business_id: bizId, 
          name: 'Sucursal Principal', 
          code: 'SUC-01' 
        }]).select('id').single()
        if (branchError) throw branchError
        branchId = newBranch.id
      }

      let { data: cashPoints } = await supabase.from('cash_points').select('id').eq('branch_id', branchId).limit(1)
      let cashPointId
      if (cashPoints && cashPoints.length > 0) {
        cashPointId = cashPoints[0].id
      } else {
        const { data: newCP, error: cpError } = await supabase.from('cash_points').insert([{ 
          branch_id: branchId, 
          name: 'Caja Principal', 
          code: 'CAJA-01' 
        }]).select('id').single()
        if (cpError) throw cpError
        cashPointId = newCP.id
      }

      const { data: shift, error } = await supabase
        .from('shifts')
        .insert([{
          workspace_id: activeWorkspaceId,
          business_id: bizId,
          branch_id: branchId,
          cash_point_id: cashPointId,
          opened_by: user.id,
          status: 'OPEN',
          initial_amount: parseFloat(openingAmount)
        }])
        .select()
        .single()

      if (error) throw error
      
      setShowOpenShift(false)
      setOpeningAmount('')
      loadData(user.id)
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  const handleCloseShift = async () => {
    if (!activeShift) return

    try {
      setCreating(true)
      const { error } = await supabase
        .from('shifts')
        .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
        .eq('id', activeShift.id)

      if (error) throw error
      
      setShowCloseShift(false)
      setActiveShift(null)
      setMovements([])
      alert(`Caja cerrada. Saldo final real: $${currentBalance.toFixed(2)}`)
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || amount <= 0) return alert('Ingresá un monto válido')
    if (!selectedMethod) return alert('Seleccioná un medio de pago')
    if (!activeShift) return alert('Primero abrí la caja')

    try {
      setCreating(true)
      const method = paymentMethods.find(m => m.id === selectedMethod)
      const isIncome = formType === 'INCOME'
      const type = isIncome ? 'PAYMENT_RECEIVED' : 'EXPENSE_REGISTERED'
      const commission = isIncome ? ((parseFloat(amount) * (method.commission_value || 0)) / 100) + (method.commission_fixed || 0) : 0
      
      const finalConcept = showCustomConcept ? customConcept : selectedConcept

      const { error } = await supabase.from('transactions').insert([{
        shift_id: activeShift.id,
        workspace_id: activeWorkspaceId,
        business_id: activeShift.business_id,
        branch_id: activeShift.branch_id,
        cash_point_id: activeShift.cash_point_id,
        type,
        amount: parseFloat(amount),
        commission_amount: commission,
        payment_method_id: method.id,
        payment_status: 'ACREDITED',
        description: finalConcept || (isIncome ? 'Cobro' : 'Gasto'),
        category: finalConcept || (isIncome ? 'Ventas' : 'Gastos'),
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

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', fontSize: '14px' }}>Cargando...</div>

  const conceptosList = formType === 'INCOME' ? CONCEPTOS_INGRESO : CONCEPTOS_GASTO

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1rem', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '700' }}>{businessName}</h1>
            <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
              {activeShift ? `Turno activo • ${new Date().toLocaleDateString('es-AR')}` : 'Caja cerrada'}
            </p>
          </div>
          <button onClick={handleSignOut} style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}>Salir</button>
        </div>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        {!activeShift ? (
          <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'white', borderRadius: '10px', border: '2px dashed #cbd5e1', marginBottom: '1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1rem' }}>Caja Cerrada</h3>
            <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.875rem' }}>Abrí la caja para empezar a operar</p>
            <button 
              onClick={() => setShowOpenShift(true)}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '700', cursor: 'pointer' }}
            >
              Abrir Caja
            </button>
          </div>
        ) : (
          <>
            {/* Resumen de Caja: Bruto, Comisiones, Neto */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#dcfce7', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#166534', fontWeight: '700', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Bruto</div>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: '#15803d' }}>${totals.in.toFixed(2)}</div>
              </div>
              <div style={{ backgroundColor: '#fee2e2', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#991b1b', fontWeight: '700', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Comisiones</div>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: '#b91c1c' }}>-${totals.commissions.toFixed(2)}</div>
              </div>
              <div style={{ backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: '700', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Neto</div>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: '#ffffff' }}>${totals.net.toFixed(2)}</div>
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <button 
                onClick={() => handleOpenForm('INCOME')}
                style={{ padding: '1rem', backgroundColor: '#86efac', color: '#14532d', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '700', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}
              >
                <span style={{ fontSize: '1.5rem' }}>💰</span>
                COBRO
              </button>
              <button 
                onClick={() => handleOpenForm('EXPENSE')}
                style={{ padding: '1rem', backgroundColor: '#fca5a5', color: '#7f1d1d', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '700', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}
              >
                <span style={{ fontSize: '1.5rem' }}>💸</span>
                GASTO
              </button>
            </div>

            <button 
              onClick={() => setShowCloseShift(true)}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', marginBottom: '1rem' }}
            >
              Cerrar Caja
            </button>
          </>
        )}

        {/* Lista de Movimientos */}
        <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#334155', marginBottom: '0.75rem' }}>
          📖 Movimientos del Turno
        </h3>
        
        {movements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', backgroundColor: 'white', borderRadius: '8px', border: '1px dashed #cbd5e1', fontSize: '0.875rem' }}>
            Sin movimientos en este turno
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {movements.map(m => {
              const isIncome = m.type === 'PAYMENT_RECEIVED' || m.type === 'CASH_OPENED'
              const method = paymentMethods.find(pm => pm.id === m.payment_method_id)
              const commission = m.commission_amount || 0
              const net = m.amount - commission
              
              return (
                <div key={m.id} style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: isIncome ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                        {isIncome ? '📥' : '📤'}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.875rem' }}>{m.description}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(m.created_at).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})} • {method?.name || 'Efectivo'}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.875rem', color: isIncome ? '#15803d' : '#b91c1c' }}>
                        {isIncome ? '+' : '-'}${m.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  {isIncome && commission > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px dashed #e2e8f0', fontSize: '0.75rem' }}>
                      <div style={{ color: '#64748b' }}>Comisión ({method?.name}):</div>
                      <div style={{ color: '#dc2626', fontWeight: '600' }}>-${commission.toFixed(2)}</div>
                    </div>
                  )}
                  
                  {isIncome && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.25rem', fontSize: '0.75rem' }}>
                      <div style={{ color: '#059669', fontWeight: '600' }}>Neto a caja:</div>
                      <div style={{ color: '#059669', fontWeight: '700' }}>+${net.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Apertura de Caja */}
      {showOpenShift && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>🔓 Abrir Caja</h2>
              <button onClick={() => setShowOpenShift(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleOpenShift}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Monto inicial en caja</label>
                <input 
                  type="number" step="0.01" min="0" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} 
                  placeholder="0.00" required autoFocus
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1.5rem', fontWeight: '700', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box', textAlign: 'right' }}
                />
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                  Ingresá el dinero físico que hay en caja al iniciar el turno
                </p>
              </div>

              <button 
                type="submit" disabled={creating}
                style={{ width: '100%', padding: '1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}
              >
                {creating ? 'Abriendo...' : 'Abrir Caja'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cierre de Caja */}
      {showCloseShift && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>🔒 Cerrar Caja</h2>
              <button onClick={() => setShowCloseShift(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Monto inicial:</span>
                <span style={{ fontWeight: '600' }}>${activeShift?.initial_amount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Entradas Brutas:</span>
                <span style={{ fontWeight: '600', color: '#15803d' }}>+${totals.in.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Comisiones:</span>
                <span style={{ fontWeight: '600', color: '#dc2626' }}>-${totals.commissions.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Entradas Netas:</span>
                <span style={{ fontWeight: '600', color: '#059669' }}>+${totals.net.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Salidas (Gastos):</span>
                <span style={{ fontWeight: '600', color: '#b91c1c' }}>-${totals.out.toFixed(2)}</span>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '700' }}>Saldo final real:</span>
                <span style={{ fontWeight: '700', fontSize: '1.125rem' }}>${currentBalance.toFixed(2)}</span>
              </div>
            </div>

            <button 
              onClick={handleCloseShift}
              disabled={creating}
              style={{ width: '100%', padding: '1rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}
            >
              {creating ? 'Cerrando...' : 'Confirmar Cierre'}
            </button>
          </div>
        </div>
      )}

      {/* Modal de Formulario Cobro/Gasto */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: formType === 'INCOME' ? '#15803d' : '#b91c1c' }}>
                {formType === 'INCOME' ? '💰 Cobro' : '💸 Gasto'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Monto */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>¿Cuánto?</label>
                <input 
                  type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} 
                  placeholder="0.00" required autoFocus
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1.5rem', fontWeight: '700', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box', textAlign: 'right' }}
                />
              </div>

              {/* Concepto */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Concepto (opcional)</label>
                
                {!showCustomConcept ? (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {conceptosList.map(concepto => (
                        <button
                          key={concepto}
                          type="button"
                          onClick={() => setSelectedConcept(concepto)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            backgroundColor: selectedConcept === concepto ? (formType === 'INCOME' ? '#dcfce7' : '#fee2e2') : '#f1f5f9',
                            border: selectedConcept === concepto ? `2px solid ${formType === 'INCOME' ? '#16a34a' : '#dc2626'}` : '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: selectedConcept === concepto ? '700' : '500',
                            color: '#0f172a',
                            cursor: 'pointer'
                          }}
                        >
                          {concepto}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCustomConcept(true)}
                      style={{ fontSize: '0.75rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                    >
                      + Escribir otro concepto
                    </button>
                  </>
                ) : (
                  <>
                    <input 
                      type="text" 
                      value={customConcept} 
                      onChange={e => setCustomConcept(e.target.value)} 
                      placeholder="Escribí el concepto..."
                      style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => { setShowCustomConcept(false); setCustomConcept('') }}
                      style={{ fontSize: '0.75rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0 0 0' }}
                    >
                      ← Volver a la lista
                    </button>
                  </>
                )}
              </div>

              {/* Medio de pago */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Medio de pago *</label>
                {paymentMethods.length === 0 ? (
                  <div style={{ padding: '0.75rem', backgroundColor: '#fef3c7', borderRadius: '6px', color: '#92400e', fontSize: '0.875rem' }}>
                    ⚠️ No hay medios de pago configurados
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    {paymentMethods.map(method => (
                      <label 
                        key={method.id}
                        style={{ 
                          display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', 
                          border: selectedMethod === method.id ? `2px solid ${formType === 'INCOME' ? '#16a34a' : '#dc2626'}` : '1px solid #e2e8f0',
                          borderRadius: '8px', cursor: 'pointer', backgroundColor: selectedMethod === method.id ? (formType === 'INCOME' ? '#f0fdf4' : '#fef2f2') : 'white'
                        }}
                      >
                        <input type="radio" name="method" value={method.id} checked={selectedMethod === method.id} onChange={() => setSelectedMethod(method.id)} style={{ width: '16px', height: '16px' }} />
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{method.name}</div>
                          {method.subtype && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{method.subtype}</div>}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button 
                type="submit" disabled={creating}
                style={{ width: '100%', padding: '1rem', backgroundColor: formType === 'INCOME' ? '#16a34a' : '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}
              >
                {creating ? 'Guardando...' : 'Confirmar'}
              </button>
            </form>
          </div>
        </div>
      )}

      <BottomNav activeTab="caja" />
    </main>
  )
}
