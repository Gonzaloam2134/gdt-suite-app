import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

export default function Equipo() {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('OPERADOR')
  const [sending, setSending] = useState(false)
  
  const router = useRouter()
  const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        if (activeLocalId) {
          loadData(session.user.id)
        } else {
          router.push('/locales')
        }
      }
    })
  }, [router, activeLocalId])

  const loadData = async (userId) => {
    try {
      setLoading(true)
      
      // 1. Obtener el rol del usuario actual en este local
      const { data: roleData } = await supabase
        .from('roles_usuario')
        .select('rol')
        .eq('local_id', activeLocalId)
        .eq('usuario_id', userId)
        .single()
      
      setUserRole(roleData?.rol || null)

      // Si no es DUEÑO ni SUPER_ADMIN, redirigir
      if (roleData?.rol !== 'DUEÑO' && roleData?.rol !== 'SUPER_ADMIN') {
        alert('No tienes permisos para gestionar el equipo.')
        router.push('/dashboard')
        return
      }

      // 2. Obtener miembros actuales
      const { data: membersData } = await supabase
        .from('roles_usuario')
        .select(`
          usuario_id,
          rol,
          perfiles (email, nombre)
        `)
        .eq('local_id', activeLocalId)

      setMembers(membersData || [])

      // 3. Obtener invitaciones pendientes
      const { data: invData } = await supabase
        .from('invitaciones')
        .select('*')
        .eq('local_id', activeLocalId)
        .eq('estado', 'pendiente')
        .order('creado_en', { ascending: false })

      setInvitations(invData || [])

    } catch (err) {
      console.error('Error cargando equipo:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return alert('Ingresá un email válido')

    setSending(true)
    try {
      const { error } = await supabase
        .from('invitaciones')
        .insert([{
          local_id: activeLocalId,
          email: inviteEmail.trim().toLowerCase(),
          rol: inviteRole,
          estado: 'pendiente'
        }])

      if (error) throw error
      
      alert(`✅ Invitación enviada a ${inviteEmail}. El usuario verá la invitación al iniciar sesión.`)
      setInviteEmail('')
      loadData(user.id)
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setSending(false)
    }
  }

  const handleCancelInvite = async (inviteId) => {
    if (!confirm('¿Cancelar esta invitación?')) return
    try {
      await supabase.from('invitaciones').update({ estado: 'cancelada' }).eq('id', inviteId)
      loadData(user.id)
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleRemoveMember = async (memberUserId) => {
    if (!confirm('¿Eliminar a este usuario del local?')) return
    try {
      await supabase
        .from('roles_usuario')
        .delete()
        .eq('local_id', activeLocalId)
        .eq('usuario_id', memberUserId)
      loadData(user.id)
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando equipo...</div>
  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '700' }}>👥 Mi Equipo</h1>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Gestioná los roles y accesos de tu local</p>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        
        {/* Formulario de Invitación */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>Invitar nuevo miembro</h3>
          <form onSubmit={handleInvite}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#334155' }}>Correo electrónico</label>
              <input 
                type="email" 
                value={inviteEmail} 
                onChange={e => setInviteEmail(e.target.value)} 
                placeholder="empleado@ejemplo.com"
                required
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: '#334155' }}>Rol asignado</label>
              <select 
                value={inviteRole} 
                onChange={e => setInviteRole(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', backgroundColor: 'white' }}
              >
                <option value="ADMINISTRADOR">Administrador (Gestión completa)</option>
                <option value="OPERADOR">Operador (Solo caja y cobros)</option>
              </select>
            </div>
            <button 
              type="submit" 
              disabled={sending}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', opacity: sending ? 0.7 : 1 }}
            >
              {sending ? 'Enviando...' : 'Enviar Invitación'}
            </button>
          </form>
        </div>

        {/* Lista de Invitaciones Pendientes */}
        {invitations.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Invitaciones Pendientes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {invitations.map(inv => (
                <div key={inv.id} style={{ backgroundColor: '#fef3c7', padding: '0.75rem', borderRadius: '8px', border: '1px solid #fcd34d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#92400e' }}>{inv.email}</div>
                    <div style={{ fontSize: '0.75rem', color: '#a16207' }}>Rol: {inv.rol}</div>
                  </div>
                  <button 
                    onClick={() => handleCancelInvite(inv.id)}
                    style={{ padding: '0.5rem', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de Miembros Activos */}
        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Miembros del Local</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {members.map((member, index) => {
              const profile = member.perfiles
              const isCurrentUser = profile?.email === user.email
              
              return (
                <div key={index} style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#0f172a' }}>
                      {profile?.nombre || 'Usuario'} {isCurrentUser && '(Tú)'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{profile?.email}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '999px', 
                      fontSize: '0.75rem', 
                      fontWeight: '700',
                      backgroundColor: member.rol === 'DUEÑO' ? '#dbeafe' : member.rol === 'ADMINISTRADOR' ? '#f3e8ff' : '#f1f5f9',
                      color: member.rol === 'DUEÑO' ? '#1e40af' : member.rol === 'ADMINISTRADOR' ? '#6b21a8' : '#475569'
                    }}>
                      {member.rol}
                    </span>
                    {!isCurrentUser && member.rol !== 'DUEÑO' && (
                      <button 
                        onClick={() => handleRemoveMember(member.usuario_id)} // Nota: necesitas agregar usuario_id a la consulta si lo usas, o manejarlo diferente. 
                        // Para simplificar el MVP, si el perfil no tiene usuario_id en la consulta, podemos omitir la eliminación por ahora o agregarla en la consulta.
                        // Corregimos la consulta arriba para incluir usuario_id:
                        style={{ padding: '0.5rem', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      <BottomNav activeTab="config" />
    </main>
  )
}
