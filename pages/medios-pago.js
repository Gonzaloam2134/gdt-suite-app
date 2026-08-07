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

// Bancos más comunes en Argentina
const BANCOS_ARGENTINA = [
  'Galicia',
  'Santander Río',
  'BBVA',
  'Macro',
  'Nación',
  'ICBC',
  'Brubank',
  'Supervielle',
  'HSBC',
  'Citibank',
  'Patagonia',
  'Provincia',
  'Ciudad',
  'Comafi',
  'Hipotecario',
  'Itaú',
  'BMA',
  'Credicoop',
  'Industrial',
  'BICA'
]

export default function MediosPago() {
  const [user, setUser] = useState(null)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [showModal, setShowModal] = useState(false)
  const [editingMethod, setEditingMethod] = useState(null)
  
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('')
  
  const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false)
  const [newSubcategoryName, setNewSubcategoryName] = useState('')

  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [bancoEmisor, setBancoEmisor] = useState('')
  const [customBanco, setCustomBanco] = useState('')
  const [useCustomBanco, setUseCustomBanco] = useState(false)
  const [commissionType, setCommissionType] = useState('NINGUNA')
  const [commissionValue, setCommissionValue] = useState('')
  const [commissionFixed, setCommissionFixed] = useState('')
  const [diasAcreditacion, setDiasAcreditacion] = useState('0')
  const [active, setActive] = useState(true)
  
  const router = useRouter()
  const { loading: roleLoading } = useRoleCheck(2)
  const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        if (activeLocalId) {
          loadData()
        } else {
          router.push('/locales')
        }
      }
    })
  }, [router, activeLocalId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const { data: catData } = await supabase
        .from('categorias_pago')
        .select('*')
        .eq('activo', true)
        .order('orden', { ascending: true })
      setCategories(catData || [])

      const { data: subcatData } = await supabase
        .from('subcategorias_pago')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true })
      setSubcategories(subcatData || [])

      const { data: pmData } = await supabase
        .from('medios_pago')
        .select(`
          *,
          subcategorias_pago (
            id,
            nombre,
            categorias_pago (id, nombre, icono)
          )
        `)
        .eq('local_id', activeLocalId)
        .order('creado_en', { ascending: false })
      setPaymentMethods(pmData || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
      alert('Error cargando datos: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingMethod(null)
    setSelectedCategory('')
    setSelectedSubcategory('')
    setBancoEmisor('')
    setCustomBanco('')
    setUseCustomBanco(false)
    setCommissionType('NINGUNA')
    setCommissionValue('')
    setCommissionFixed('')
    setDiasAcreditacion('0')
    setActive(true)
    setShowNewCategoryInput(false)
    setNewCategoryName('')
    setNewCategoryIcon('')
    setShowNewSubcategoryInput(false)
    setNewSubcategoryName('')
    setShowModal(true)
  }

  const openEditModal = (method) => {
    setEditingMethod(method)
    const subcat = method.subcategorias_pago
    const cat = subcat?.categorias_pago
    setSelectedCategory(cat?.id || '')
    setSelectedSubcategory(subcat?.id || '')
    
    // Verificar si el banco está en la lista predefinida
    if (method.banco_emisor && BANCOS_ARGENTINA.includes(method.banco_emisor)) {
      setBancoEmisor(method.banco_emisor)
      setUseCustomBanco(false)
      setCustomBanco('')
    } else if (method.banco_emisor) {
      setBancoEmisor('OTRO')
      setUseCustomBanco(true)
      setCustomBanco(method.banco_emisor)
    } else {
      setBancoEmisor('')
      setUseCustomBanco(false)
      setCustomBanco('')
    }
    
    setCommissionType(method.tipo_comision || 'NINGUNA')
    setCommissionValue(method.valor_comision?.toString() || '')
    setCommissionFixed(method.monto_fijo_comision?.toString() || '')
    setDiasAcreditacion((method.dias_acreditacion || 0).toString())
    setActive(method.activo !== false)
    setShowNewCategoryInput(false)
    setShowNewSubcategoryInput(false)
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    
    let finalSubcategoryId = selectedSubcategory
    
    if (showNewSubcategoryInput && newSubcategoryName.trim()) {
      const { data: newSubcat, error: subcatError } = await supabase
        .from('subcategorias_pago')
        .insert([{ categoria_id: selectedCategory, nombre: newSubcategoryName.trim() }])
        .select()
        .single()
      
      if (subcatError) {
        alert('Error creando subcategoría: ' + subcatError.message)
        return
      }
      finalSubcategoryId = newSubcat.id
    }

    if (!finalSubcategoryId) {
      alert('Seleccioná o creá una subcategoría')
      return
    }

    // Determinar el banco emisor final
    const finalBanco = useCustomBanco ? customBanco.trim() : bancoEmisor || null

    try {
      const payload = {
        banco_emisor: finalBanco,
        subcategoria_id: finalSubcategoryId,
        tipo_comision: commissionType,
        valor_comision: commissionValue ? parseFloat(commissionValue) : 0,
        monto_fijo_comision: commissionFixed ? parseFloat(commissionFixed) : 0,
        dias_acreditacion: parseInt(diasAcreditacion) || 0,
        activo: active
      }

      if (editingMethod) {
        const { error } = await supabase
          .from('medios_pago')
          .update(payload)
          .eq('id', editingMethod.id)
        
        if (error) throw error
        alert('✅ Medio de pago actualizado')
      } else {
        const { error } = await supabase
          .from('medios_pago')
          .insert([{ local_id: activeLocalId, ...payload }])
        
        if (error) throw error
        alert('✅ Medio de pago creado')
      }
      
      setShowModal(false)
      loadData()
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
      loadData()
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este medio de pago?')) return
    try {
      const { error } = await supabase.from('medios_pago').delete().eq('id', id)
      if (error) throw error
      loadData()
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const filteredSubcategories = subcategories.filter(s => s.categoria_id === selectedCategory)

  const groupedMethods = categories.map(cat => ({
    category: cat,
    methods: paymentMethods.filter(m => m.subcategorias_pago?.categorias_pago?.id === cat.id)
  })).filter(g => g.methods.length > 0)

  if (loading || roleLoading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '700' }}>💳 Medios de Pago</h1>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Configurá tarjetas, QR, transferencias y comisiones</p>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={openCreateModal}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
          >
            + Nuevo Medio de Pago
          </button>
        </div>

        {groupedMethods.length === 0 ? (
          <div style={{ padding: '3rem', backgroundColor: '#f3f4f6', borderRadius: '10px', textAlign: 'center', color: '#6b7280' }}>
            <h3>No hay medios de pago configurados</h3>
            <p>Agregá tu primer medio de pago para empezar a cobrar.</p>
          </div>
        ) : (
          groupedMethods.map(group => (
            <div key={group.category.id} style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.75rem' }}>
                {group.category.icono} {group.category.nombre}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
                {group.methods.map(method => (
                  <div key={method.id} style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', border: `2px solid ${method.activo ? '#10b981' : '#e2e8f0'}`, opacity: method.activo ? 1 : 0.7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: '700' }}>
                          {method.subcategorias_pago?.nombre || 'Sin nombre'}
                        </h4>
                        {method.banco_emisor && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                             {method.banco_emisor}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => openEditModal(method)} style={{ padding: '0.5rem', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>✏️</button>
                        <button onClick={() => handleDelete(method.id)} style={{ padding: '0.5rem', backgroundColor: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>️</button>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ color: '#64748b' }}>Comisión:</span>
                        <span style={{ fontWeight: '600', color: method.tipo_comision === 'NINGUNA' ? '#10b981' : '#f59e0b' }}>
                          {method.tipo_comision === 'NINGUNA' ? 'Sin comisión' : 
                           method.tipo_comision === 'PORCENTAJE' ? `${method.valor_comision}%` :
                           method.tipo_comision === 'FIJO' ? `$${method.monto_fijo_comision}` :
                           `${method.valor_comision}% + $${method.monto_fijo_comision}`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ color: '#64748b' }}>Acreditación:</span>
                        <span style={{ fontWeight: '600', color: '#0f172a' }}>
                          {method.dias_acreditacion === 0 ? 'Inmediata' : `${method.dias_acreditacion} días`}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleToggleActive(method)}
                        style={{ width: '100%', padding: '0.5rem', backgroundColor: method.activo ? '#d1fae5' : '#fee2e2', color: method.activo ? '#065f46' : '#991b1b', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        {method.activo ? '✅ Activo' : '❌ Inactivo'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>{editingMethod ? 'Editar Medio de Pago' : 'Nuevo Medio de Pago'}</h2>
            <form onSubmit={handleSave}>
              
              {/* CATEGORÍA */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Categoría *</label>
                {!showNewCategoryInput ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select 
                      value={selectedCategory} 
                      onChange={e => { setSelectedCategory(e.target.value); setSelectedSubcategory(''); setBancoEmisor(''); setShowNewSubcategoryInput(false); }}
                      required
                      style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                    >
                      <option value="">Seleccionar categoría...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icono} {cat.nombre}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setShowNewCategoryInput(true)} style={{ padding: '0.75rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '1.25rem' }}>+</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nombre..." required style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }} />
                    <input type="text" value={newCategoryIcon} onChange={e => setNewCategoryIcon(e.target.value)} placeholder="Ícono" maxLength="2" style={{ width: '60px', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', textAlign: 'center' }} />
                    <button type="button" onClick={async () => {
                      if (!newCategoryName.trim()) return alert('El nombre es obligatorio')
                      try {
                        const { data, error } = await supabase.from('categorias_pago').insert([{ nombre: newCategoryName.trim(), icono: newCategoryIcon || '' }]).select().single()
                        if (error) throw error
                        setCategories([...categories, data])
                        setSelectedCategory(data.id)
                        setNewCategoryName('')
                        setNewCategoryIcon('')
                        setShowNewCategoryInput(false)
                      } catch (err) { alert('Error: ' + err.message) }
                    }} style={{ padding: '0.75rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>✓</button>
                    <button type="button" onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(''); setNewCategoryIcon(''); }} style={{ padding: '0.75rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>✕</button>
                  </div>
                )}
              </div>

              {/* SUBCATEGORÍA */}
              {selectedCategory && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Subcategoría *</label>
                  {!showNewSubcategoryInput ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select 
                        value={selectedSubcategory} 
                        onChange={e => {
                          setSelectedSubcategory(e.target.value)
                          // Resetear banco al cambiar subcategoría
                          setBancoEmisor('')
                          setUseCustomBanco(false)
                          setCustomBanco('')
                        }}
                        required
                        style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                      >
                        <option value="">Seleccionar subcategoría...</option>
                        {filteredSubcategories.map(sub => (<option key={sub.id} value={sub.id}>{sub.nombre}</option>))}
                      </select>
                      <button type="button" onClick={() => setShowNewSubcategoryInput(true)} style={{ padding: '0.75rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '1.25rem' }}>+</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input type="text" value={newSubcategoryName} onChange={e => setNewSubcategoryName(e.target.value)} placeholder="Nombre..." required style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }} />
                      <button type="button" onClick={async () => {
                        if (!newSubcategoryName.trim()) return alert('El nombre es obligatorio')
                        try {
                          const { data, error } = await supabase.from('subcategorias_pago').insert([{ categoria_id: selectedCategory, nombre: newSubcategoryName.trim() }]).select().single()
                          if (error) throw error
                          setSubcategories([...subcategories, data])
                          setSelectedSubcategory(data.id)
                          setNewSubcategoryName('')
                          setShowNewSubcategoryInput(false)
                        } catch (err) { alert('Error: ' + err.message) }
                      }} style={{ padding: '0.75rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>✓</button>
                      <button type="button" onClick={() => { setShowNewSubcategoryInput(false); setNewSubcategoryName(''); }} style={{ padding: '0.75rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}></button>
                    </div>
                  )}
                </div>
              )}

              {/* BANCO EMISOR - NUEVO */}
              {selectedSubcategory && (
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.875rem', color: '#0f172a' }}>
                    🏦 Banco Emisor
                  </label>
                  {!useCustomBanco ? (
                    <select 
                      value={bancoEmisor} 
                      onChange={e => {
                        if (e.target.value === 'OTRO') {
                          setUseCustomBanco(true)
                          setBancoEmisor('OTRO')
                        } else {
                          setBancoEmisor(e.target.value)
                        }
                      }}
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', marginBottom: '0.5rem' }}
                    >
                      <option value="">Seleccionar banco...</option>
                      {BANCOS_ARGENTINA.map(banco => (
                        <option key={banco} value={banco}>{banco}</option>
                      ))}
                      <option value="OTRO">Otro (especificar)...</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text"
                        value={customBanco}
                        onChange={e => setCustomBanco(e.target.value)}
                        placeholder="Nombre del banco..."
                        required
                        style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                      />
                      <button 
                        type="button"
                        onClick={() => { setUseCustomBanco(false); setCustomBanco(''); setBancoEmisor(''); }}
                        style={{ padding: '0.75rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                    💡 Opcional para Efectivo. Obligatorio para tarjetas y transferencias.
                  </div>
                </div>
              )}

              {/* COMISIÓN */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Tipo de Comisión</label>
                <select value={commissionType} onChange={e => setCommissionType(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}>
                  {Object.entries(TIPOS_COMISION).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                </select>
              </div>

              {commissionType !== 'NINGUNA' && (
                <>
                  {(commissionType === 'PORCENTAJE' || commissionType === 'MIXTO') && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Porcentaje (%)</label>
                      <input type="number" step="0.01" min="0" max="100" value={commissionValue} onChange={e => setCommissionValue(e.target.value)} placeholder="Ej: 2.5" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }} />
                    </div>
                  )}
                  {(commissionType === 'FIJO' || commissionType === 'MIXTO') && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Monto Fijo ($)</label>
                      <input type="number" step="0.01" min="0" value={commissionFixed} onChange={e => setCommissionFixed(e.target.value)} placeholder="Ej: 10" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }} />
                    </div>
                  )}
                </>
              )}

              {/* DÍAS DE ACREDITACIÓN - SEPARADO */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.875rem', color: '#0369a1' }}>
                  ⏱️ Se acredita en
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input 
                    type="number" 
                    min="0" 
                    max="60"
                    value={diasAcreditacion} 
                    onChange={e => setDiasAcreditacion(e.target.value)} 
                    style={{ width: '80px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem', textAlign: 'center', fontWeight: '700' }} 
                  />
                  <span style={{ fontSize: '0.875rem', color: '#0369a1' }}>
                    {diasAcreditacion === '0' ? 'días (Acreditación inmediata)' : 'días'}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.5rem' }}>
                  💡 Ejemplos: Efectivo = 0, Débito = 1-2, QR = 1, Crédito = 14-30, Transferencia = 1-3
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ width: '20px', height: '20px' }} />
                  <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>Medio de pago activo</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
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
