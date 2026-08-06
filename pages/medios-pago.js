import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'
import { useRoleCheck } from '../lib/useRoleCheck'

const TIPOS_COMISION = {
  'NINGUNA': 'Sin comisión',
  'PORCENTAJE': 'Porcentaje (%)',
  'FIJO': 'Monto fijo ($)',
  'MIXTO': 'Porcentaje + Fijo'
}

const CATEGORIAS = [
  { value: 'EFECTIVO', label: ' Efectivo' },
  { value: 'QR', label: '📱 QR / Billeteras' },
  { value: 'TARJETA_CREDITO', label: ' Tarjeta de Crédito' },
  { value: 'TARJETA_DEBITO', label: '💳 Tarjeta de Débito' },
  { value: 'TRANSFERENCIA', label: ' Transferencia' },
  { value: 'CHEQUE', label: '📄 Cheque' },
  { value: 'PERSONALIZADO', label: '🔧 Personalizado' }
]

export default function MediosPago() {
  const [user, setUser] = useState(null)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMethod, setEditingMethod] = useState(null)
  
  const [name, setName] = useState('')
  const [category, setCategory] = useState('EFECTIVO')
  const [subtype, setSubtype] = useState('')
  const [commissionType, setCommissionType] = useState('NINGUNA')
  const [commissionValue, setCommissionValue] = useState('')
  const [commissionFixed, setCommissionFixed] = useState('')
  const [active, setActive] = useState(true)
  
  const router = useRouter()
  const { loading: roleLoading } = useRoleCheck(2) // Nivel 2: Admin y Dueño
  const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        if (activeLocalId) {
          loadPaymentMethods()
        } else {
          router.push('/locales')
        }
      }
    })
  }, [router, activeLocalId])

  const loadPaymentMethods = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('medios_pago')
        .select('*')
        .eq('local_id', activeLocalId)
        .order('nombre', { ascending: true })

      if (error) throw error
      setPaymentMethods(data || [])
    } catch (err) {
      console.error('Error cargando medios de pago:', err)
      alert('Error cargando medios de pago: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingMethod(null)
    setName('')
    setCategory('EFECTIVO')
    setSubtype('')
    setCommissionType('NINGUNA')
    setCommissionValue('')
    setCommissionFixed('')
    setActive(true)
    setShowModal(true)
  }

  const openEditModal = (method) => {
    setEditingMethod(method)
    setName(method.nombre || '')
    setCategory(method.tipo || 'EFECTIVO')
    setSubtype(method.subtipo || '')
    setCommissionType(method.tipo_comision || 'NINGUNA')
    setCommissionValue(method.valor_comision?.toString() || '')
    setCommissionFixed(method.monto_fijo_comision?.toString() || '')
    setActive(method.activo !== false)
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) return alert('El nombre es obligatorio')

    try {
      if (editingMethod) {
        // MODO EDICIÓN
        const { error } = await supabase
          .from('medios_pago')
          .update({
            nombre: name,
            tipo: category,
            subtipo: subtype || null,
            tipo_comision: commissionType,
            valor_comision: commissionValue ? parseFloat(commissionValue) : 0,
            monto_fijo_comision: commissionFixed ? parseFloat(commissionFixed) : 0,
            activo: active
          })
          .eq('id', editingMethod.id)
        
        if (error) throw error
        alert('✅ Medio de pago actualizado')
      } else {
        // MODO CREACIÓN
        const { error } = await supabase
          .from('medios_pago')
          .insert([{
            local_id: activeLocalId,
            nombre: name,
            tipo: category,
            subtipo: subtype || null,
            tipo_comision: commissionType,
            valor_comision: commissionValue ? parseFloat(commissionValue) : 0,
            monto_fijo_comision: commissionFixed ? parseFloat(commissionFixed) : 0,
            activo: active
          }])
        
        if (error) throw error
        alert('✅ Medio de pago creado')
      }
      
      setShowModal(false)
      loadPaymentMethods()
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleToggleActive = async (method) => {
    try {
      const { error } = await supabase
        .from('medios_pago')
        .update({ activo: !method.activo })
        .eq('id', method.id)
      
      if (error) throw error
      loadPaymentMethods()
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`¿Estás seguro de eliminar "${name}"? Esta acción no se puede deshacer.`)) return

    try {
      const { error } = await supabase
        .from('medios_pago')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      loadPaymentMethods()
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading || roleLoading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '700' }}>💳 Medios de Pago</h1>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Configurá tarjetas, QR, transferencias y comisiones</p>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <button 
            onClick={openCreateModal}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
          >
            + Nuevo Medio de Pago
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando medios de pago...</div>
        ) : paymentMethods.length === 0 ? (
          <div style={{ padding: '3rem', backgroundColor: '#f3f4f6', borderRadius: '10px', textAlign: 'center', color: '#6b7280' }}>
            <h3>No hay medios de pago configurados</h3>
            <p>Agregá tu primer medio de pago para empezar a cobrar.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
            {paymentMethods.map(method => {
              const categoria = CATEGORIAS.find(c => c.value === method.tipo)
              return (
                <div key={method.id} style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: `2px solid ${method.activo ? '#10b981' : '#e2e8f0'}`, opacity: method.activo ? 1 : 0.7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{categoria?.label || '🔧 Personalizado'}</div>
                      <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '700' }}>{method.nombre}</h3>
                      {method.subtipo && <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>{method.subtipo}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => openEditModal(method)}
                        style={{ padding: '0.5rem', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDelete(method.id, method.nombre)}
                        style={{ padding: '0.5rem', backgroundColor: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Comisión:</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: method.tipo_comision === 'NINGUNA' ? '#10b981' : '#f59e0b' }}>
                        {method.tipo_comision === 'NINGUNA' ? 'Sin comisión' : 
                         method.tipo_comision === 'PORCENTAJE' ? `${method.valor_comision}%` :
                         method.tipo_comision === 'FIJO' ? `$${method.monto_fijo_comision}` :
                         `${method.valor_comision}% + $${method.monto_fijo_comision}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Estado:</span>
                      <button 
                        onClick={() => handleToggleActive(method)}
                        style={{ padding: '0.5rem 1rem', backgroundColor: method.activo ? '#d1fae5' : '#fee2e2', color: method.activo ? '#065f46' : '#991b1b', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        {method.activo ? '✅ Activo' : '❌ Inactivo'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>{editingMethod ? 'Editar Medio de Pago' : 'Nuevo Medio de Pago'}</h2>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Nombre *</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                  placeholder="Ej: Mercado Pago QR"
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Categoría</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                >
                  {CATEGORIAS.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Subtipo (opcional)</label>
                <input 
                  type="text" 
                  value={subtype} 
                  onChange={e => setSubtype(e.target.value)} 
                  placeholder="Ej: QR, Crédito, Débito, etc."
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Tipo de Comisión</label>
                <select 
                  value={commissionType} 
                  onChange={e => setCommissionType(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                >
                  {Object.entries(TIPOS_COMISION).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {commissionType !== 'NINGUNA' && (
                <>
                  {(commissionType === 'PORCENTAJE' || commissionType === 'MIXTO') && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Porcentaje (%)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        max="100"
                        value={commissionValue} 
                        onChange={e => setCommissionValue(e.target.value)} 
                        placeholder="Ej: 2.5"
                        style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}

                  {(commissionType === 'FIJO' || commissionType === 'MIXTO') && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Monto Fijo ($)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        value={commissionFixed} 
                        onChange={e => setCommissionFixed(e.target.value)} 
                        placeholder="Ej: 10"
                        style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                </>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={active} 
                    onChange={e => setActive(e.target.checked)}
                    style={{ width: '20px', height: '20px' }}
                  />
                  <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>Medio de pago activo</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  {editingMethod ? 'Guardar Cambios' : 'Crear Medio de Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav activeTab="config" />
    </main>
  )
}
