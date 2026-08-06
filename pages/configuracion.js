import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'
import { useRoleCheck } from '../lib/useRoleCheck'

export default function Configuracion() {
  const [user, setUser] = useState(null)
  const router = useRouter()
  const { loading: roleLoading, role } = useRoleCheck(2) // Nivel 2: Admin y Dueño

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) router.push('/')
      else setUser(session.user)
    })
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (roleLoading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

  const menuItems = [
    { label: ' Mi Equipo', desc: 'Invitar y gestionar roles', path: '/equipo', minRole: 3 }, // Solo Dueño
    { label: '💳 Medios de Pago', desc: 'Configurar tarjetas, QR, comisiones', path: '/medios-pago', minRole: 2 },
    { label: '🏢 Mis Locales', desc: 'Gestionar negocios', path: '/locales', minRole: 1 },
  ]

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '700' }}>⚙️ Ajustes</h1>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
          Configuración de tu local y cuenta
        </p>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {menuItems.map((item, index) => {
            // Ocultar opciones si el rol no es suficiente
            if (role && (role === 'OPERADOR' && item.minRole > 1) || (role === 'ADMINISTRADOR' && item.minRole > 2)) {
              return null
            }
            
            return (
              <button
                key={index}
                onClick={() => router.push(item.path)}
                style={{
                  backgroundColor: 'white',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0f172a' }}>{item.label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{item.desc}</div>
                </div>
                <div style={{ fontSize: '1.25rem', color: '#94a3b8' }}>▶</div>
              </button>
            )
          })}
        </div>

        <button 
          onClick={handleSignOut}
          style={{ width: '100%', marginTop: '2rem', padding: '1rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
        >
          Cerrar Sesión
        </button>
      </div>

      <BottomNav activeTab="config" />
    </main>
  )
}
