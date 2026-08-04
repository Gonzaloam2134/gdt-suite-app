import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  
  // Form state
  const [selectedWorkspace, setSelectedWorkspace] = useState('')
  const [transactionType, setTransactionType] = useState('PAYMENT_RECEIVED')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [creating, setCreating] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        loadData(session.user.id)
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
  }, [router])

  const loadData = async (userId) => {
    try {
      setLoading(true)
      setError(null)

      const { data: wsData, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false })

      if (wsError) throw wsError
      setWorkspaces(wsData || [])

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('created_by', userId)
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

  const createTestWorkspace = async () => {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert([{ name: 'Mi Primer Workspace', slug: `workspace-${Date.now()}` }])
        .select()

      if (error) throw error
      
      setWorkspaces([data[0], ...workspaces])
      alert('✅ Workspace creado!')
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleCreateTransaction = async (e) => {
    e.preventDefault()
    
    if (!selectedWorkspace) {
      alert('Seleccioná un workspace primero!')
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

    try {
      setCreating(true)
      const workspace = workspaces.find(ws => ws.id === selectedWorkspace)
      
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

      let { data: paymentMethods } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('workspace_id', workspace.id)
        .eq('name', 'Efectivo')
        .limit(1)

      if (!paymentMethods || paymentMethods.length === 0) {
        const { data: newPaymentMethod } = await supabase
          .from('payment_methods')
          .insert([{
            workspace_id: workspace.id,
            name: 'Efectivo',
            type: 'EFECTIVO',
            commission_type: 'NONE'
          }])
          .select()
        
        paymentMethods = newPaymentMethod
      }

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
          commission_amount: 0,
          payment_method_id: paymentMethods[0].id,
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

  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#1f2937', color: 'white', borderRadius: '8px' }}>
        <div>
          <h1 style={{ margin: 0 }}>🚀 GDT Suite - Dashboard</h1>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', opacity: 0.8 }}>
            Conectado como: {user.email}
          </p>
        </div>
        <button 
          onClick={handleSignOut}
          style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Cerrar Sesión
        </button>
      </div>

      {/* Info Box - Qué son los Workspaces */}
      <div style={{ padding: '1.5rem', backgroundColor: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '8px', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e40af' }}> ¿Qué son los Workspaces?</h3>
        <p style={{ margin: 0, color: '#1e3a8a', lineHeight: '1.6' }}>
          Los <strong>Workspaces</strong> son espacios de trabajo de alto nivel. Cada workspace puede contener múltiples negocios (Businesses), 
          cada negocio puede tener varias sucursales (Branches), y cada sucursal tiene sus propias cajas (Cash Points) y turnos (Shifts). 
          Es un sistema multi-tenant que te permite gestionar varios clientes o empresas desde una sola cuenta.
        </p>
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
          {/* Workspaces Section */}
          <section style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>📁 Workspaces ({workspaces.length})</h2>
              <button 
                onClick={createTestWorkspace}
                style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                + Crear Workspace
              </button>
            </div>
            
            {workspaces.length === 0 ? (
              <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center', color: '#6b7280' }}>
                No tenés workspaces todavía. Creá uno para empezar!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {workspaces.map(ws => (
                  <div key={ws.id} style={{ padding: '1.5rem', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{ws.name}</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                      Slug: {ws.slug || 'N/A'}
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '12px', color: '#9ca3af' }}>
                      Creado: {new Date(ws.created_at).toLocaleString('es-AR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Transactions Section */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2> Transacciones Recientes ({transactions.length})</h2>
              <button 
                onClick={() => setShowTransactionForm(!showTransactionForm)}
                style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {showTransactionForm ? '✕ Cancelar' : '+ Nueva Transacción'}
              </button>
            </div>

            {/* Transaction Form */}
            {showTransactionForm && (
              <div style={{ padding: '2rem', backgroundColor: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: '8px', marginBottom: '2rem' }}>
                <h3 style={{ marginTop: 0 }}>Crear Nueva Transacción</h3>
                <form onSubmit={handleCreateTransaction}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        Workspace *
                      </label>
                      <select 
                        value={selectedWorkspace}
                        onChange={(e) => setSelectedWorkspace(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      >
                        <option value="">Seleccioná un workspace...</option>
                        {workspaces.map(ws => (
                          <option key={ws.id} value={ws.id}>{ws.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        Tipo de Transacción *
                      </label>
                      <select 
                        value={transactionType}
                        onChange={(e) => setTransactionType(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      >
                        <option value="PAYMENT_RECEIVED">💰 Cobro Recibido</option>
                        <option value="EXPENSE_REGISTERED">💸 Gasto Registrado</option>
                        <option value="SUPPLIER_PAYMENT_MADE">🏭 Pago a Proveedor</option>
                        <option value="CASH_WITHDRAWN">💵 Retiro de Efectivo</option>
                        <option value="CASH_OPENED">🔓 Apertura de Caja</option>
                        <option value="CASH_CLOSED">🔒 Cierre de Caja</option>
                        <option value="MOVEMENT_REVERSED">↩️ Movimiento Revertido</option>
                      </select>
                    </div>
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
                        onChange={(e) => setAmount(e.target.value)}
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
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Categoría</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Monto</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{tx.description}</td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                          <span style={{ padding: '4px 8px', backgroundColor: getTransactionColor(tx.type), color: '#1f2937', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                            {getTransactionTypeLabel(tx.type)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontSize: '14px', color: '#6b7280' }}>
                          {tx.category || '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', fontSize: '16px' }}>
                          ${tx.amount?.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontSize: '14px', color: '#6b7280' }}>
                          {new Date(tx.created_at).toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
