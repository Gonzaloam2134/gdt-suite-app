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

const BANCOS_ARGENTINA = [
  'Galicia', 'Santander Río', 'BBVA', 'Macro', 'Nación', 'ICBC',
  'Brubank', 'Supervielle', 'HSBC', 'Citibank', 'Patagonia',
  'Provincia', 'Ciudad', 'Comafi', 'Hipotecario', 'Itaú',
  'BMA', 'Credicoop', 'Industrial', 'BICA'
]

export default function MediosPago() {
  const [user, setUser] = useState(null)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [showModal, setShowModal] = useState(false)
  const [editingMethod, setEditingMethod] = useState(null)
  
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [bancoEmisor, setBancoEmisor] = useState('')
  const [commissionType, setCommissionType] = useState('NINGUNA')
  const [commissionValue, setCommissionValue] = useState('')
  const [commissionFixed, setCommissionFixed] = useState('')
  const [diasAcreditacion, setDiasAcreditacion] = useState('0')
  const [active, setActive] = useState(true)
  
  // Estados para "Nuevo" en cada campo
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [showNewOperator, setShowNewOperator] = useState(false)
  const [showNewBanco, setShowNewBanco] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newOperatorName, setNewOperatorName] = useState('')
  const [newBancoName, setNewBancoName] = useState('')
  
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
    setCommissionType('NINGUNA')
    setCommissionValue('')
    setCommissionFixed('')
    setDiasAcreditacion('0')
    setActive(true)
    setShowNewCategory(false)
    setShowNewOperator(false)
    setShowNewBanco(false)
    setNewCategoryName('')
    setNewOperatorName('')
    setNewBancoName('')
    setShowModal(true)
  }

  const openEditModal = (method) => {
    setEditingMethod(method)
    const subcat = method.subcategorias_pago
    const cat = subcat?.categorias_pago
    setSelectedCategory(cat?.id || '')
    setSelectedSubcategory(subcat?.id || '')
    setBancoEmisor(method.banco_emisor || '')
    setCommissionType(method.tipo_comision || 'NINGUNA')
    setCommissionValue(method.valor_comision?.toString() || '')
    setCommissionFixed(method.monto_fijo_comision?.toString() || '')
    setDiasAcreditacion((method.dias_acreditacion || 0).toString())
    setActive(method.activo !== false)
    setShowNewCategory(false)
    setShowNewOperator(false)
    setShowNewBanco(false)
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    
    if (!selectedCategory) return alert('Seleccioná un medio de pago')
    if (!selectedSubcategory) return alert('Seleccioná un operador')

    try {
      const payload = {
        subcategoria_id: selectedSubcategory,
        banco_emisor: bancoEmisor || null,
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
            <p>Hacé clic en "+ Nuevo Medio de Pago" para agregar el primero.</p>
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

      {/* Modal */}
      {showModal && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'flex-start',
            paddingTop: '2rem',
            zIndex: 1000, 
            overflowY: 'auto',
            padding: '2rem 1rem'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div 
            style={{ 
              backgroundColor: 'white', 
              padding: '2rem', 
              borderRadius: '12px', 
              width: '100%', 
              maxWidth: '600px',
              marginBottom: '2rem'
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>{editingMethod ? 'Editar Medio de Pago' : 'Nuevo Medio de Pago'}</h2>
            <form onSubmit={handleSave}>
              
              {/* 1. MEDIO DE PAGO (Categoría) */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Medio de pago *</label>
                {!showNewCategory ? (
                  <select 
                    value={selectedCategory} 
                    onChange={e => {
                      if (e.target.value === 'NEW') {
                        setShowNewCategory(true)
                        setSelectedCategory('')
                      } else {
                        setSelectedCategory(e.target.value)
                        setSelectedSubcategory('')
                      }
                    }}
                    required
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', backgroundColor: 'white' }}
                  >
                    <option value="">Seleccionar...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icono} {cat.nombre}</option>
                    ))}
                    <option value="NEW">+ Nuevo medio de pago</option>
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="Nombre (ej: Cripto)"
                      required
                      style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                    />
                    <button 
                      type="button"
                      onClick={async () => {
                        if (!newCategoryName.trim()) return alert('Ingresá un nombre')
                        try {
                          const { data, error } = await supabase.from('categorias_pago').insert([{ 
                            nombre: newCategoryName.trim(), 
                            icono: '💳',
                            orden: 99,
                            activo: true
                          }]).select().single()
                          if (error) throw error
                          setCategories([...categories, data])
                          setSelectedCategory(data.id)
                          setShowNewCategory(false)
                          setNewCategoryName('')
                        } catch (err) {
                          alert('Error: ' + err.message)
                        }
                      }}
                      style={{ padding: '0.75rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Guardar
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }}
                      style={{ padding: '0.75rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* 2. OPERADOR (Subcategoría) */}
              {selectedCategory && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Operador *</label>
                  {!showNewOperator ? (
                    <select 
                      value={selectedSubcategory} 
                      onChange={e => {
                        if (e.target.value === 'NEW') {
                          setShowNewOperator(true)
                          setSelectedSubcategory('')
                        } else {
                          setSelectedSubcategory(e.target.value)
                        }
                      }}
                      required
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', backgroundColor: 'white' }}
                    >
                      <option value="">Seleccionar...</option>
                      {filteredSubcategories.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.nombre}</option>
                      ))}
                      <option value="NEW">+ Nuevo operador</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text"
                        value={newOperatorName}
                        onChange={e => setNewOperatorName(e.target.value)}
                        placeholder="Nombre (ej: Naranja X)"
                        required
                        style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                      />
                      <button 
                        type="button"
                        onClick={async () => {
                          if (!newOperatorName.trim()) return alert('Ingresá un nombre')
                          try {
                            const { data, error } = await supabase.from('subcategorias_pago').insert([{ 
                              categoria_id: selectedCategory,
                              nombre: newOperatorName.trim(),
                              activo: true
                            }]).select().single()
                            if (error) throw error
                            setSubcategories([...subcategories, data])
                            setSelectedSubcategory(data.id)
                            setShowNewOperator(false)
                            setNewOperatorName('')
                          } catch (err) {
                            alert('Error: ' + err.message)
                          }
                        }}
                        style={{ padding: '0.75rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Guardar
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setShowNewOperator(false); setNewOperatorName(''); }}
                        style={{ padding: '0.75rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 3. BANCO EMISOR */}
              {selectedSubcategory && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Banco Emisor</label>
                  {!showNewBanco ? (
                    <select 
                      value={bancoEmisor} 
                      onChange={e => {
                        if (e.target.value === 'NEW') {
                          setShowNewBanco(true)
                          setBancoEmisor('')
                        } else {
                          setBancoEmisor(e.target.value)
                        }
                      }}
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', backgroundColor: 'white' }}
                    >
                      <option value="">Seleccionar banco...</option>
                      {BANCOS_ARGENTINA.map(banco => (
                        <option key={banco} value={banco}>{banco}</option>
                      ))}
                      <option value="NEW">+ Otro banco</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text"
                        value={newBancoName}
                        onChange={e => setNewBancoName(e.target.value)}
                        placeholder="Nombre del banco"
                        required
                        style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          setBancoEmisor(newBancoName)
                          setShowNewBanco(false)
                          setNewBancoName('')
                        }}
                        style={{ padding: '0.75rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Guardar
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setShowNewBanco(false); setNewBancoName(''); }}
                        style={{ padding: '0.75rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 4. COMISIÓN */}
              {selectedSubcategory && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Tipo de Comisión</label>
                    <select value={commissionType} onChange={e => setCommissionType(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', backgroundColor: 'white' }}>
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

                  {/* 5. SE ACREDITA EN */}
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
                       Ejemplos: Efectivo = 0, Débito = 1-2, QR = 1, Crédito = 14-30, Transferencia = 1-3
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ width: '20px', height: '20px' }} />
                      <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>Medio de pago activo</span>
                    </label>
                  </div>
                </>
              )}

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
