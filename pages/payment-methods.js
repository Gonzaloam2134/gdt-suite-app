import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function PaymentMethodsConfig() {
  const [user, setUser] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [selectedWorkspace, setSelectedWorkspace] = useState('')
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        loadWorkspaces()
      }
    })
  }, [router])

  useEffect(() => {
    if (selectedWorkspace) {
      loadPaymentMethods()
    }
  }, [selectedWorkspace])

  const loadWorkspaces = async () => {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setWorkspaces(data)
      if (data.length > 0) setSelectedWorkspace(data[0].id)
    }
    setLoading(false)
  }

  const loadPaymentMethods = async () => {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('workspace_id', selectedWorkspace)
      .order('type', { ascending: true })

    if (!error) {
      setPaymentMethods(data || [])
    }
  }

  const handleToggleActive = async (methodId, isActive) => {
    const { error } = await supabase
      .from('payment_methods')
      .update({ is_active: !isActive })
      .eq('id', methodId)

    if (!error) {
      loadPaymentMethods()
    }
  }

  const handleUpdateCommission = async (methodId, field, value) => {
    const update = { [field]: value }
    const { error } = await supabase
      .from('payment_methods')
      .update(update)
      .eq('id', methodId)

    if (!error) {
      loadPaymentMethods()
    }
  }

  const handleAddPaymentMethod = async () => {
    const name = prompt('Nombre del medio de pago:')
    if (!name) return

    const type = prompt('Tipo (EFECTIVO, TARJETA_CREDITO, TARJETA_DEBITO, TRANSFERENCIA, CHEQUE, PERSONALIZADO):')
    if (!type) return

    const subtype = prompt('Subtipo (VISA, MASTERCARD, MERCADO_PAGO, GALICIA, etc.):') || null

    const { error } = await supabase
      .from('payment_methods')
      .insert([{
        workspace_id: selectedWorkspace,
        name,
        type,
        subtype,
        commission_type: 'NONE',
        commission_value: 0,
        commission_fixed: 0,
        is_active: true
      }])

    if (!error) {
      loadPaymentMethods()
    } else {
      alert(`Error: ${error.message}`)
    }
  }

  const getCommissionTypeLabel = (type) => {
    const labels = {
      'NONE': 'Sin comisión',
      'PERCENTAGE': 'Porcentaje (%)',
      'FIXED': 'Monto fijo ($)',
      'MIXED': 'Mixta (% + $)'
    }
    return labels[type] || type
  }

  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#1f2937', color: 'white', borderRadius: '8px' }}>
        <div>
          <h1 style={{ margin: 0 }}>⚙️ Configuración de Medios de Pago</h1>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', opacity: 0.8 }}>
            Gestioná los medios de pago y comisiones de tu negocio
          </p>
        </div>
        <button 
          onClick={() => router.push('/dashboard')}
          style={{ padding: '10px 20px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          ← Volver al Dashboard
        </button>
      </div>

      {/* Workspace Selector */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Seleccionar Workspace:
        </label>
        <select 
          value={selectedWorkspace}
          onChange={(e) => setSelectedWorkspace(e.target.value)}
          style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #d1d5db', borderRadius: '4px' }}
        >
          {workspaces.map(ws => (
            <option key={ws.id} value={ws.id}>{ws.name}</option>
          ))}
        </select>
      </div>

      {/* Add Button */}
      <div style={{ marginBottom: '1rem' }}>
        <button 
          onClick={handleAddPaymentMethod}
          style={{ padding: '12px 24px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
        >
          + Agregar Medio de Pago
        </button>
      </div>

      {/* Payment Methods List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {paymentMethods.map(method => (
            <div key={method.id} style={{ padding: '1.5rem', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{method.name}</h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                    {method.type} {method.subtype && `• ${method.subtype}`}
                  </p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={method.is_active}
                    onChange={() => handleToggleActive(method.id, method.is_active)}
                    style={{ width: '20px', height: '20px' }}
                  />
                  <span style={{ fontWeight: 'bold' }}>Activo</span>
                </label>
              </div>

              {/* Commission Configuration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    Tipo de Comisión
                  </label>
                  <select 
                    value={method.commission_type}
                    onChange={(e) => handleUpdateCommission(method.id, 'commission_type', e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  >
                    <option value="NONE">Sin comisión</option>
                    <option value="PERCENTAGE">Porcentaje (%)</option>
                    <option value="FIXED">Monto fijo ($)</option>
                    <option value="MIXED">Mixta (% + $)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    Comisión %
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    value={method.commission_value || 0}
                    onChange={(e) => handleUpdateCommission(method.id, 'commission_value', parseFloat(e.target.value))}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    Comisión Fija ($)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    value={method.commission_fixed || 0}
                    onChange={(e) => handleUpdateCommission(method.id, 'commission_fixed', parseFloat(e.target.value))}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <p style={{ margin: '0.5rem 0 0 0', fontSize: '12px', color: '#9ca3af' }}>
                {method.description || 'Sin descripción'}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
