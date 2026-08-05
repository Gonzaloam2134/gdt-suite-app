import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

export default function PaymentMethodsConfig() {
  const [user, setUser] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [selectedWorkspace, setSelectedWorkspace] = useState('')
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [newMethodName, setNewMethodName] = useState('')
  const [newMethodSubtype, setNewMethodSubtype] = useState('')
  const [newMethodCommissionType, setNewMethodCommissionType] = useState('NONE')
  const [newMethodCommissionValue, setNewMethodCommissionValue] = useState(0)
  const [newMethodCommissionFixed, setNewMethodCommissionFixed] = useState(0)
  const [editingMethod, setEditingMethod] = useState(null)
  const [showEditForm, setShowEditForm] = useState(false)
  
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
      .order('name', { ascending: true })

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

  const handleOpenAddForm = (category) => {
    setSelectedCategory(category)
    setNewMethodName('')
    setNewMethodSubtype('')
    setNewMethodCommissionType('NONE')
    setNewMethodCommissionValue(0)
    setNewMethodCommissionFixed(0)
    setShowAddForm(true)
  }

  const handleAddMethod = async (e) => {
    e.preventDefault()
    if (!newMethodName.trim()) return alert('Ingresá un nombre')

    try {
      const { error } = await supabase
        .from('payment_methods')
        .insert([{
          workspace_id: selectedWorkspace,
          name: newMethodName,
          type: selectedCategory,
          subtype: newMethodSubtype || null,
          commission_type: newMethodCommissionType,
          commission_value: parseFloat(newMethodCommissionValue) || 0,
          commission_fixed: parseFloat(newMethodCommissionFixed) || 0,
          is_active: true
        }])

      if (error) throw error
      
      setShowAddForm(false)
      loadPaymentMethods()
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleOpenEditForm = (method) => {
    setEditingMethod(method)
    setNewMethodName(method.name)
    setNewMethodSubtype(method.subtype || '')
    setNewMethodCommissionType(method.commission_type || 'NONE')
    setNewMethodCommissionValue(method.commission_value || 0)
    setNewMethodCommissionFixed(method.commission_fixed || 0)
    setShowEditForm(true)
  }

  const handleUpdateMethod = async (e) => {
    e.preventDefault()
    if (!newMethodName.trim()) return alert('Ingresá un nombre')

    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({
          name: newMethodName,
          subtype: newMethodSubtype || null,
          commission_type: newMethodCommissionType,
          commission_value: parseFloat(newMethodCommissionValue) || 0,
          commission_fixed: parseFloat(newMethodCommissionFixed) || 0
        })
        .eq('id', editingMethod.id)

      if (error) throw error
      
      setShowEditForm(false)
      setEditingMethod(null)
      loadPaymentMethods()
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleDeleteMethod = async (methodId) => {
    if (!confirm('¿Eliminar este medio de pago?')) return

    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', methodId)

      if (!error) {
        loadPaymentMethods()
      }
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const getCommissionDisplay = (method) => {
    if (method.commission_type === 'NONE') return 'Sin comisión'
    if (method.commission_type === 'PERCENTAGE') return `${method.commission_value}%`
    if (method.commission_type === 'FIXED') return `$${method.commission_fixed}`
    if (method.commission_type === 'MIXED') return `${method.commission_value}% + $${method.commission_fixed}`
    return ''
  }

  const getCategoryIcon = (type) => {
    const icons = {
      'EFECTIVO': '💵',
      'QR': '📱',
      'TARJETA_CREDITO': '💳',
      'TARJETA_DEBITO': '💳',
      'TRANSFERENCIA': '🏦'
    }
    return icons[type] || ''
  }

  const getCategoryLabel = (type) => {
    const labels = {
      'EFECTIVO': 'Efectivo',
      'QR': 'QR / Billeteras',
      'TARJETA_CREDITO': 'Tarjetas de Crédito',
      'TARJETA_DEBITO': 'Tarjetas de Débito',
      'TRANSFERENCIA': 'Transferencias Bancarias'
    }
    return labels[type] || type
  }

  const groupByCategory = () => {
    const groups = {}
    paymentMethods.forEach(method => {
      if (!groups[method.type]) groups[method.type] = []
      groups[method.type].push(method)
    })
    return groups
  }

  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  const categories = ['EFECTIVO', 'QR', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'TRANSFERENCIA']
  const groupedMethods = groupByCategory()

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '700' }}> Medios de Pago</h1>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Configurá cómo cobrás y las comisiones</p>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        {/* Workspace Selector */}
        {workspaces.length > 1 && (
          <div style={{ marginBottom: '1rem' }}>
            <select 
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.875rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Categories */}
        {categories.map(category => {
          const methods = groupedMethods[category] || []
          const isEfectivo = category === 'EFECTIVO'
          
          return (
            <div key={category} style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>
                  {getCategoryIcon(category)} {getCategoryLabel(category)}
                </h3>
                <button
                  onClick={() => handleOpenAddForm(category)}
                  style={{ padding: '0.5rem 0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  + Agregar
                </button>
              </div>

              {methods.length === 0 ? (
                <div style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                  No hay medios configurados en esta categoría
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {methods.map(method => (
                    <div key={method.id} style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '700', fontSize: '0.875rem', color: '#0f172a' }}>{method.name}</div>
                          {method.subtype && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{method.subtype}</div>
                          )}
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox"
                            checked={method.is_active}
                            onChange={() => handleToggleActive(method.id, method.is_active)}
                            style={{ width: '18px', height: '18px' }}
                          />
                          <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Activo</span>
                        </label>
                      </div>

                      {!isEfectivo && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Comisión: <span style={{ fontWeight: '600', color: method.commission_type !== 'NONE' ? '#dc2626' : '#64748b' }}>{getCommissionDisplay(method)}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleOpenEditForm(method)}
                              style={{ padding: '0.25rem 0.5rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteMethod(method.id)}
                              style={{ padding: '0.25rem 0.5rem', backgroundColor: '#fee2e2', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', color: '#dc2626' }}
                            >
                              ️
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal Agregar Medio */}
      {showAddForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
                {getCategoryIcon(selectedCategory)} Agregar {getCategoryLabel(selectedCategory)}
              </h2>
              <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}></button>
            </div>

            <form onSubmit={handleAddMethod}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Nombre *</label>
                <input 
                  type="text" 
                  value={newMethodName} 
                  onChange={e => setNewMethodName(e.target.value)} 
                  placeholder={selectedCategory === 'QR' ? 'Ej: Mercado Pago' : selectedCategory === 'TARJETA_CREDITO' ? 'Ej: Visa' : 'Ej: Banco Galicia'}
                  required
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }}
                />
              </div>

              {selectedCategory !== 'EFECTIVO' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Subtipo (opcional)</label>
                  <input 
                    type="text" 
                    value={newMethodSubtype} 
                    onChange={e => setNewMethodSubtype(e.target.value)} 
                    placeholder="Ej: Crédito, Débito, QR..."
                    style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              {selectedCategory !== 'EFECTIVO' && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={newMethodCommissionType !== 'NONE'}
                        onChange={(e) => setNewMethodCommissionType(e.target.checked ? 'PERCENTAGE' : 'NONE')}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontWeight: '600', fontSize: '0.875rem', color: '#334155' }}>Agregar comisión</span>
                    </label>
                  </div>

                  {newMethodCommissionType !== 'NONE' && (
                    <>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Tipo de comisión</label>
                        <select 
                          value={newMethodCommissionType}
                          onChange={(e) => setNewMethodCommissionType(e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px' }}
                        >
                          <option value="PERCENTAGE">Porcentaje (%)</option>
                          <option value="FIXED">Monto fijo ($)</option>
                          <option value="MIXED">Mixta (% + $)</option>
                        </select>
                      </div>

                      {(newMethodCommissionType === 'PERCENTAGE' || newMethodCommissionType === 'MIXED') && (
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Porcentaje (%)</label>
                          <input 
                            type="number"
                            step="0.01"
                            min="0"
                            value={newMethodCommissionValue}
                            onChange={(e) => setNewMethodCommissionValue(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }}
                          />
                        </div>
                      )}

                      {(newMethodCommissionType === 'FIXED' || newMethodCommissionType === 'MIXED') && (
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Monto fijo ($)</label>
                          <input 
                            type="number"
                            step="0.01"
                            min="0"
                            value={newMethodCommissionFixed}
                            onChange={(e) => setNewMethodCommissionFixed(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <button 
                type="submit"
                style={{ width: '100%', padding: '1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}
              >
                Agregar Medio de Pago
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Medio */}
      {showEditForm && editingMethod && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
                ✏️ Editar {editingMethod.name}
              </h2>
              <button onClick={() => setShowEditForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleUpdateMethod}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Nombre *</label>
                <input 
                  type="text" 
                  value={newMethodName} 
                  onChange={e => setNewMethodName(e.target.value)} 
                  required
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Subtipo (opcional)</label>
                <input 
                  type="text" 
                  value={newMethodSubtype} 
                  onChange={e => setNewMethodSubtype(e.target.value)} 
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={newMethodCommissionType !== 'NONE'}
                    onChange={(e) => setNewMethodCommissionType(e.target.checked ? 'PERCENTAGE' : 'NONE')}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span style={{ fontWeight: '600', fontSize: '0.875rem', color: '#334155' }}>Agregar comisión</span>
                </label>
              </div>

              {newMethodCommissionType !== 'NONE' && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Tipo de comisión</label>
                    <select 
                      value={newMethodCommissionType}
                      onChange={(e) => setNewMethodCommissionType(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px' }}
                    >
                      <option value="PERCENTAGE">Porcentaje (%)</option>
                      <option value="FIXED">Monto fijo ($)</option>
                      <option value="MIXED">Mixta (% + $)</option>
                    </select>
                  </div>

                  {(newMethodCommissionType === 'PERCENTAGE' || newMethodCommissionType === 'MIXED') && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Porcentaje (%)</label>
                      <input 
                        type="number"
                        step="0.01"
                        min="0"
                        value={newMethodCommissionValue}
                        onChange={(e) => setNewMethodCommissionValue(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}

                  {(newMethodCommissionType === 'FIXED' || newMethodCommissionType === 'MIXED') && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Monto fijo ($)</label>
                      <input 
                        type="number"
                        step="0.01"
                        min="0"
                        value={newMethodCommissionFixed}
                        onChange={(e) => setNewMethodCommissionFixed(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                </>
              )}

              <button 
                type="submit"
                style={{ width: '100%', padding: '1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}
              >
                Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      )}

      <BottomNav activeTab="config" />
    </main>
  )
}
