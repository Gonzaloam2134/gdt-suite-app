import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [transactions, setTransactions] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  
  // Form state
  const [transactionType, setTransactionType] = useState('PAYMENT_RECEIVED')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [creating, setCreating] = useState(false)
  
  // Commission calculation
  const [commissionAmount, setCommissionAmount] = useState(0)
  const [netAmount, setNetAmount] = useState(0)
  
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [router, activeWorkspaceId])

  const loadData = async (userId) => {
    try {
      setLoading(true)
      setError(null)

      if (!activeWorkspaceId) {
        router.push('/workspaces')
        return
      }

      const { data: wsData, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', activeWorkspaceId)
        .single()

      if (wsError) throw wsError
      setWorkspaces(wsData ? [wsData] : [])

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (txError) throw txError
      setTransactions(txData || [])

    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadPaymentMethods = async (workspaceId) => {
    if (!workspaceId) return
    
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('type', { ascending: true })
      .order('name', { ascending: true })

    if (!error) {
      setPaymentMethods(data || [])
    }
  }

  const calculateCommission = (amount, method) => {
    if (!method || !amount) return { commission: 0, net: amount }
    
    let commission = 0
    const amountNum = parseFloat(amount)
    
    if (method.commission_type === 'PERCENTAGE') {
      commission = (amountNum * method.commission_value) / 100
    } else if (method.commission_type === 'FIXED') {
      commission = method.commission_fixed || 0
    } else if (method.commission_type === 'MIXED') {
      commission = ((amountNum * method.commission_value) / 100) + (method.commission_fixed || 0)
    }
    
    return { commission, net: amountNum - commission }
  }

  const handleAmountChange = (value) => {
    setAmount(value)
    const method = paymentMethods.find(m => m.id === selectedPaymentMethod)
    if (method && value) {
      const { commission, net } = calculateCommission(value, method)
      setCommissionAmount(commission)
      setNetAmount(net)
    } else {
      setCommissionAmount(0)
      setNetAmount(parseFloat(value) || 0)
    }
  }

  const handlePaymentMethodChange = (methodId) => {
    setSelectedPaymentMethod(methodId)
    const method = paymentMethods.find(m => m.id === methodId)
    if (method && amount) {
      const { commission, net } = calculateCommission(amount, method)
      setCommissionAmount(commission)
      setNetAmount(net)
    } else {
      setCommissionAmount(0)
      setNetAmount(parseFloat(amount) || 0)
    }
  }

  const handleCreateTransaction = async (e) => {
    e.preventDefault()
    
    if (!activeWorkspaceId) {
      alert('No hay workspace activo!')
      return
    }
    
    if (!amount || amount <= 0) {
      alert('Ingresá un monto válido!')
      return
    }

    if (!description.trim()) {
      alert('Ingresá una descripción!')
      return
    }

    if (!selectedPaymentMethod) {
      alert('Seleccioná un medio de pago!')
      return
    }

    try {
      setCreating(true)
      const workspace = workspaces[0]
      const paymentMethod = paymentMethods.find(pm => pm.id === selectedPaymentMethod)
      
      // Crear jerarquía completa
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .insert([{
          workspace_id: workspace.id,
          name: 'Negocio Demo',
          legal_name: 'Negocio Demo S.A.',
          tax_id: '30-12345678-9'
        }])
        .select()

      if (businessError) throw businessError

      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .insert([{
          business_id: business[0].id,
          name: 'Sucursal Centro',
          code: 'SUC-001',
          address: 'Av. Principal 123'
        }])
        .select()

      if (branchError) throw branchError

      const { data: cashPoint, error: cashPointError } = await supabase
        .from('cash_points')
        .insert([{
          branch_id: branch[0].id,
          name: 'Caja Principal',
          code: 'CAJA-001'
        }])
        .select()

      if (cashPointError) throw cashPointError

      const { data: shift, error: shiftError } = await supabase
        .from('shifts')
        .insert([{
          cash_point_id: cashPoint[0].id,
          opened_by: user.id,
          status: 'OPEN',
          initial_amount: 1000.00
        }])
        .select()

      if (shiftError) throw shiftError

      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert([{
          shift_id: shift[0].id,
          workspace_id: workspace.id,
          business_id: business[0].id,
          branch_id: branch[0].id,
          cash_point_id: cashPoint[0].id,
          type: transactionType,
          amount: parseFloat(amount),
          commission_amount: commissionAmount,
          payment_method_id: paymentMethod.id,
          payment_status: 'ACREDITED',
          description: description,
          category: category || 'General',
          created_by: user.id
        }])
        .select()

      if (txError) throw txError
      
      setTransactions([transaction[0], ...transactions])
      setShowTransactionForm(false)
      setAmount('')
      setDescription('')
      setCategory('')
      setSelectedPaymentMethod('')
      setCommissionAmount(0)
      setNetAmount(0)
      alert('✅ Transacción creada exitosamente!')
      loadData(user.id)
      
    } catch (err) {
      console.error('Error creating transaction:', err)
      alert(`Error: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getTransactionTypeLabel = (type) => {
    const labels = {
      'PAYMENT_RECEIVED': '💰 Cobro Recibido',
      'EXPENSE_REGISTERED': '💸 Gasto Registrado',
      'SUPPLIER_PAYMENT_MADE': '🏭 Pago a Proveedor',
      'CASH_WITHDRAWN': '💵 Retiro de Efectivo',
      'CASH_OPENED': '🔓 Apertura de Caja',
      'CASH_CLOSED': '🔒 Cierre de Caja',
      'MOVEMENT_REVERSED': '↩️ Movimiento Revertido'
    }
    return labels[type] || type
  }

  const getTransactionColor = (type) => {
    if (type === 'PAYMENT_RECEIVED') return '#d1fae5'
    if (type === 'EXPENSE_REGISTERED' || type === 'SUPPLIER_PAYMENT_MADE') return '#fee2e2'
    return '#fef3c7'
  }

  const groupPaymentMethodsByType = () => {
    const groups = {}
    paymentMethods.forEach(method => {
      if (!groups[method.type]) {
        groups[method.type] = []
      }
      groups[method.type].push(method)
    })
    return groups
  }

  const getPaymentMethodIcon = (type) => {
    const icons = {
      'EFECTIVO': '💵',
      'TARJETA_CREDITO': '',
      'TARJETA_DEBITO': '💳',
      'TRANSFERENCIA': '🏦',
      'CHEQUE': '',
      'PERSONALIZADO': '⚙️'
    }
    return icons[type] || '💰'
  }

  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#1f2937', color: 'white', borderRadius: '8px' }}>
        <div>
          <h1 style={{ margin: 0 }}> GDT Suite - Dashboard</h1>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', opacity: 0.8 }}>
            Workspace: {workspaces[0]?.name || 'Cargando...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => router.push('/workspaces')}
            style={{ padding: '10px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            🏢 Workspaces
          </button>
          <button 
            onClick={() => router.push('/payment-methods')}
            style={{ padding: '10px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            ⚙️ Medios de Pago
          </button>
          <button 
            onClick={handleSignOut}
            style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', fontSize: '18px' }}>Cargando datos...</div>
      ) : (
        <>
          {/* Transactions Section */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>📊 Transacciones Recientes ({transactions.length})</h2>
              <button 
                onClick={() => {
                  setShowTransactionForm(!showTransactionForm)
                  if (activeWorkspaceId) {
                    loadPaymentMethods(activeWorkspaceId)
                  }
                }}
                style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {showTransactionForm ? '❌ Cancelar' : '+ Nueva Transacción'}
              </button>
            </div>

            {/* Transaction Form */}
            {showTransactionForm && (
              <div style={{ padding: '2rem', backgroundColor: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: '8px', marginBottom: '2rem' }}>
                <h3 style={{ marginTop: 0 }}>Crear Nueva Transacción</h3>
                <form onSubmit={handleCreateTransaction}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Tipo de Transacción *
                    </label>
                    <select 
                      value={transactionType}
                      onChange={(e) => setTransactionType(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                    >
                      <option value="PAYMENT_RECEIVED"> Cobro Recibido</option>
                      <option value="EXPENSE_REGISTERED">💸 Gasto Registrado</option>
                      <option value="SUPPLIER_PAYMENT_MADE">🏭 Pago a Proveedor</option>
                      <option value="CASH_WITHDRAWN">💵 Retiro de Efectivo</option>
                      <option value="CASH_OPENED">🔓 Apertura de Caja</option>
                      <option value="CASH_CLOSED"> Cierre de Caja</option>
                      <option value="MOVEMENT_REVERSED">↩️ Movimiento Revertido</option>
                    </select>
                  </div>

                  {/* Payment Method Selection */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Medio de Pago *
                    </label>
                    {paymentMethods.length === 0 ? (
                      <div style={{ padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '4px', color: '#92400e' }}>
                        ⚠️ No hay medios de pago configurados. 
                        <a href="/payment-methods" style={{ marginLeft: '5px', color: '#3b82f6' }}>Configurar →</a>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        {Object.entries(groupPaymentMethodsByType()).map(([type, methods]) => (
                          <div key={type}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '14px', color: '#6b7280' }}>
                              {getPaymentMethodIcon(type)} {type.replace('_', ' ')}
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                              {methods.map(method => (
                                <label 
                                  key={method.id}
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    padding: '10px', 
                                    backgroundColor: selectedPaymentMethod === method.id ? '#dbeafe' : 'white',
                                    border: selectedPaymentMethod === method.id ? '2px solid #3b82f6' : '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <input 
                                    type="radio"
                                    name="paymentMethod"
                                    value={method.id}
                                    checked={selectedPaymentMethod === method.id}
                                    onChange={() => handlePaymentMethodChange(method.id)}
                                    style={{ marginRight: '8px' }}
                                  />
                                  <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{method.name}</div>
                                    {method.subtype && (
                                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{method.subtype}</div>
                                    )}
                                    {method.commission_type !== 'NONE' && (
                                      <div style={{ fontSize: '11px', color: '#ef4444' }}>
                                        {method.commission_type === 'PERCENTAGE' && `${method.commission_value}%`}
                                        {method.commission_type === 'FIXED' && `$${method.commission_fixed}`}
                                        {method.commission_type === 'MIXED' && `${method.commission_value}% + $${method.commission_fixed}`}
                                      </div>
                                    )}
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        Monto *
                      </label>
                      <input 
                        type="number"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="0.00"
                        required
                        style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        Categoría
                      </label>
                      <input 
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="Ej: Ventas, Compras, Servicios..."
                        style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      />
                    </div>
                  </div>

                  {/* Commission Summary */}
                  {selectedPaymentMethod && amount && (
                    <div style={{ padding: '1rem', backgroundColor: '#dbeafe', borderRadius: '4px', marginBottom: '1rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0' }}>📝 Resumen de la Transacción</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>Monto Bruto</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>${parseFloat(amount).toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>Comisión</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>-${commissionAmount.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>Monto Neto</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>${netAmount.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Descripción *
                    </label>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describí la transacción..."
                      required
                      rows="3"
                      style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #d1d5db', borderRadius: '4px', resize: 'vertical' }}
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={creating}
                    style={{ padding: '12px 24px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
                  >
                    {creating ? 'Creando...' : '✅ Crear Transacción'}
                  </button>
                </form>
              </div>
            )}
            
            {transactions.length === 0 ? (
              <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center', color: '#6b7280' }}>
                No tenés transacciones todavía. Creá tu primera transacción!
              </div>
            ) : (
              <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Descripción</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Tipo</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Medio de Pago</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Monto</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Comisión</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Neto</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => {
                      const method = paymentMethods.find(pm => pm.id === tx.payment_method_id)
                      const net = tx.amount - (tx.commission_amount || 0)
                      return (
                        <tr key={tx.id}>
                          <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{tx.description}</td>
                          <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                            <span style={{ padding: '4px 8px', backgroundColor: getTransactionColor(tx.type), color: '#1f2937', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                              {getTransactionTypeLabel(tx.type)}
                            </span>
                          </td>
                          <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontSize: '14
