import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Workspaces() {
  const [user, setUser] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState(null)
  
  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('ARS')
  const [timezone, setTimezone] = useState('America/Argentina/Buenos_Aires')
  const [saving, setSaving] = useState(false)
  
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) router.push('/')
      else setUser(session.user)
    })

    return () => subscription.unsubscribe()
  }, [router])

  const loadWorkspaces = async () => {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setWorkspaces(data || [])
    } catch (err) {
      console.error('Error loading workspaces:', err)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingWorkspace(null)
    setName('')
    setDescription('')
    setCurrency('ARS')
    setTimezone('America/Argentina/Buenos_Aires')
    setShowModal(true)
  }

  const openEditModal = (workspace) => {
    setEditingWorkspace(workspace)
    setName(workspace.name || '')
    setDescription(workspace.description || '')
    setCurrency(workspace.currency || 'ARS')
    setTimezone(workspace.timezone || 'America/Argentina/Buenos_Aires')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) return alert('El nombre es obligatorio')

    setSaving(true)
    try {
      const slug = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-4)
      
      if (editingWorkspace) {
        // Update
        const { error } = await supabase
          .from('workspaces')
          .update({ name, description, currency, timezone, slug }) // Note: usually slug doesn't change, but for MVP it's fine
          .eq('id', editingWorkspace.id)
        
        if (error) throw error
        alert('✅ Workspace actualizado')
      } else {
        // Create
        const { error } = await supabase
          .from('workspaces')
          .insert([{ name, description, currency, timezone, slug }])
        
        if (error) throw error
        alert('✅ Workspace creado')
      }
      
      setShowModal(false)
      loadWorkspaces()
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`¿Estás seguro de eliminar "${name}"? Esta acción no se puede deshacer.`)) return

    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      loadWorkspaces()
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const enterWorkspace = (workspaceId) => {
    // Guardamos el ID en localStorage para que el dashboard sepa cuál usar
    localStorage.setItem('activeWorkspaceId', workspaceId)
    router.push('/dashboard')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#1f2937', color: 'white', borderRadius: '8px' }}>
        <div>
          <h1 style={{ margin: 0 }}>🏢 Mis Workspaces</h1>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', opacity: 0.8 }}>
            Seleccioná o gestioná tus espacios de trabajo
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={openCreateModal}
            style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Nuevo Workspace
          </button>
          <button 
            onClick={handleSignOut}
            style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Salir
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando workspaces...</div>
      ) : workspaces.length === 0 ? (
        <div style={{ padding: '4rem', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center', color: '#6b7280' }}>
          <h3>No tenés workspaces todavía</h3>
          <p>Creá tu primer espacio de trabajo para empezar a operar.</p>
          <button 
            onClick={openCreateModal}
            style={{ marginTop: '1rem', padding: '12px 24px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
          >
            Crear mi primer Workspace
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {workspaces.map(ws => (
            <div key={ws.id} style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#111827' }}>{ws.name}</h3>
                <p style={{ margin: '0 0 1rem 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                  {ws.description || 'Sin descripción'}
                </p>
                <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: '#9ca3af', marginBottom: '1rem' }}>
                  <span>💰 {ws.currency || 'ARS'}</span>
                  <span> {ws.timezone ? ws.timezone.split('/')[1] : 'Default'}</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                <button 
                  onClick={() => enterWorkspace(ws.id)}
                  style={{ flex: 1, padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Entrar
                </button>
                <button 
                  onClick={() => openEditModal(ws)}
                  style={{ padding: '10px 15px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                  title="Editar"
                >
                  ✏️
                </button>
                <button 
                  onClick={() => handleDelete(ws.id, ws.name)}
                  style={{ padding: '10px 15px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}
                  title="Eliminar"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginTop: 0 }}>{editingWorkspace ? 'Editar Workspace' : 'Crear Nuevo Workspace'}</h2>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '14px' }}>Nombre *</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                  placeholder="Ej: Mi Empresa S.A."
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '14px' }}>Descripción</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  rows="3"
                  placeholder="Breve descripción del negocio..."
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '14px' }}>Moneda</label>
                  <select 
                    value={currency} 
                    onChange={e => setCurrency(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  >
                    <option value="ARS">🇷 ARS (Peso Argentino)</option>
                    <option value="USD">🇸 USD (Dólar)</option>
                    <option value="EUR">🇺 EUR (Euro)</option>
                    <option value="BRL">🇧 BRL (Real)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '14px' }}>Zona Horaria</label>
                  <select 
                    value={timezone} 
                    onChange={e => setTimezone(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  >
                    <option value="America/Argentina/Buenos_Aires">Buenos Aires (GMT-3)</option>
                    <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
                    <option value="America/Bogota">Bogotá (GMT-5)</option>
                    <option value="Europe/Madrid">Madrid (GMT+1)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={{ padding: '10px 20px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
