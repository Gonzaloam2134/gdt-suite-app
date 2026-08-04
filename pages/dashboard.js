import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const router = useRouter()

  useEffect(() => {
    // Verificar sesión
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

      // Cargar workspaces
      const { data: wsData, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (wsError) throw wsError
      setWorkspaces(wsData || [])

      // Cargar transacciones
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })
        .limit(10)

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
        .insert([{ name: 'Mi Primer Workspace', slug: 'mi-primer-workspace' }])
        .select()

      if (error) throw error
      
      setWorkspaces([data[0], ...workspaces])
      alert('✅ Workspace creado!')
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const createTestTransaction = async () => {
    if (workspaces.length === 0) {
      alert('Primero creá un workspace!')
      return
    }

    try {
      const workspace = workspaces[0]
      
      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          workspace_id: workspace.id,
          business_id: null,
          branch_id: null,
          cash_point_id: null,
          shift_id: null,
          type: 'PAYMENT_RECEIVED',
          amount: 1500.00,
          description: 'Venta de prueba - Dashboard',
          created_by: user.id
        }])
        .select()

      if (error) throw error
      
      setTransactions([data[0], ...transactions])
      alert('✅ Transacción creada!')
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) return <div>Cargando...</div>

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', backgroundColor: '#1f2937', color: 'white', borderRadius: '8px' }}>
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
                + Crear Workspace de Prueba
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
                onClick={createTestTransaction}
                style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                + Crear Transacción de Prueba
              </button>
            </div>
            
            {transactions.length === 0 ? (
              <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center', color: '#6b7280' }}>
                No tenés transacciones todavía.
              </div>
            ) : (
              <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Descripción</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Tipo</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Monto</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{tx.description}</td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                          <span style={{ padding: '4px 8px', backgroundColor: tx.type === 'PAYMENT_RECEIVED' ? '#d1fae5' : '#fee2e2', color: tx.type === 'PAYMENT_RECEIVED' ? '#065f46' : '#991b1b', borderRadius: '4px', fontSize: '12px' }}>
                            {tx.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold' }}>
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
