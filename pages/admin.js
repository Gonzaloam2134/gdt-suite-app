import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Admin() {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [locales, setLocales] = useState([])
  const [stats, setStats] = useState({ total: 0, activos: 0, prueba: 0, suspendidos: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')
  const [searchTerm, setSearchTerm] = useState('')
  
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        checkSuperAdmin(session.user.id)
      }
    })
  }, [router])

  const checkSuperAdmin = async (userId) => {
    try {
      const { data } = await supabase
        .from('roles_usuario')
        .select('rol')
        .eq('usuario_id', userId)
        .eq('rol', 'SUPER_ADMIN')
        .single()

      if (!data) {
        alert('No tienes permisos de Super Administrador')
        router.push('/locales')
        return
      }

      setUserRole('SUPER_ADMIN')
      loadAdminData()
    } catch (err) {
      console.error('Error verificando rol:', err)
      router.push('/locales')
    }
  }

  const loadAdminData = async () => {
    try {
      setLoading(true)

      // Cargar todos los locales
      const { data: localesData } = await supabase
        .from('locales')
        .select('*')
        .order('created_at', { ascending: false })

      setLocales(localesData || [])

      // Calcular estadísticas
      const total = localesData?.length || 0
      const activos = localesData?.filter(l => l.estado_suscripcion === 'activo').length || 0
      const prueba = localesData?.filter(l => l.estado_suscripcion === 'prueba').length || 0
      const suspendidos = localesData?.filter(l => l.estado_suscripcion === 'suspendido').length || 0

      setStats({ total, activos, prueba, suspendidos })
    } catch (err) {
      console.error('Error cargando datos admin:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExtendTrial = async (localId) => {
    const days = prompt('¿Cuántos días adicionales de prueba?', '7')
    if (!days || isNaN(days)) return

    try {
      const { error } = await supabase
        .from('locales')
        .update({ 
          fin_prueba: new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000).toISOString(),
          estado_suscripcion: 'prueba'
        })
        .eq('id', localId)

      if (error) throw error
      alert(`✅ Prueba extendida ${days} días`)
      loadAdminData()
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleSuspend = async (localId) => {
    if (!confirm('¿Suspender este local? El usuario no podrá crear transacciones.')) return

    try {
      const { error } = await supabase
        .from('locales')
        .update({ estado_suscripcion: 'suspendido' })
        .eq('id', localId)

      if (error) throw error
      alert('✅ Local suspendido')
      loadAdminData()
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleReactivate = async (localId) => {
    if (!confirm('¿Reactivar este local?')) return

    try {
      const { error } = await supabase
        .from('locales')
        .update({ estado_suscripcion: 'activo' })
        .eq('id', localId)

      if (error) throw error
      alert('✅ Local reactivado')
      loadAdminData()
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const filteredLocales = locales.filter(local => {
    const matchesFilter = filter === 'todos' || local.estado_suscripcion === filter
    const matchesSearch = local.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const getStatusBadge = (status) => {
    const styles = {
      'activo': { bg: '#dcfce7', color: '#166534', text: 'Activo' },
      'prueba': { bg: '#fef3c7', color: '#92400e', text: 'Prueba' },
      'suspendido': { bg: '#fee2e2', color: '#991b1b', text: 'Suspendido' }
    }
    const style = styles[status] || styles['prueba']
    return (
      <span style={{ padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: style.bg, color: style.color }}>
        {style.text}
      </span>
    )
  }

  if (!user || !userRole) return <div style={{ padding: '2rem', textAlign: 'center' }}>Verificando permisos...</div>
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando consola...</div>

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: '700' }}>👑 Consola Super Admin</h1>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>Gestión global de la plataforma GDT Suite</p>
          </div>
          <button 
            onClick={() => router.push('/locales')}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            ← Volver a Mis Locales
          </button>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem' }}>TOTAL LOCALES</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a' }}>{stats.total}</div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem' }}>ACTIVOS (PAGOS)</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#16a34a' }}>{stats.activos}</div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem' }}>EN PRUEBA</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#f59e0b' }}>{stats.prueba}</div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem' }}>SUSPENDIDOS</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#dc2626' }}>{stats.suspendidos}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', flex: 1, minWidth: '200px' }}
          />
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', backgroundColor: 'white' }}
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="prueba">En Prueba</option>
            <option value="suspendido">Suspendidos</option>
          </select>
        </div>

        {/* Locales Table */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', fontWeight: '700', color: '#0f172a' }}>
            Lista de Locales ({filteredLocales.length})
          </div>
          
          {filteredLocales.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              No hay locales que coincidan con los filtros
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Nombre</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Plan</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Estado</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Creado</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLocales.map(local => (
                    <tr key={local.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#0f172a' }}>{local.nombre}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>{local.plan || 'UN_LOCAL'}</td>
                      <td style={{ padding: '0.75rem' }}>{getStatusBadge(local.estado_suscripcion)}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>
                        {new Date(local.created_at).toLocaleDateString('es-AR')}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          {local.estado_suscripcion === 'prueba' && (
                            <button 
                              onClick={() => handleExtendTrial(local.id)}
                              style={{ padding: '0.375rem 0.75rem', backgroundColor: '#fef3c7', color: '#92400e', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                              Extender Prueba
                            </button>
                          )}
                          {local.estado_suscripcion === 'suspendido' ? (
                            <button 
                              onClick={() => handleReactivate(local.id)}
                              style={{ padding: '0.375rem 0.75rem', backgroundColor: '#dcfce7', color: '#166534', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                              Reactivar
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleSuspend(local.id)}
                              style={{ padding: '0.375rem 0.75rem', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                              Suspender
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
