import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

export default function Configuracion() {
  const router = useRouter()
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user)
      else router.push('/')
    })
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const menuItems = [
    { label: '💳 Medios de Pago', desc: 'Configurar tarjetas, QR, comisiones', path: '/payment-methods' },
    { label: '🏢 Mis Workspaces', desc: 'Gestionar negocios y sucursales', path: '/workspaces' },
    { label: ' Mi Cuenta', desc: 'Email y contraseña', path: '/cuenta' }
  ]

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '700' }}>⚙️ Configuración</h1>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => router.push(item.path)}
              style={{
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%'
              }}
            >
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0f172a' }}>{item.label}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{item.desc}</div>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '1.2rem' }}>›</div>
            </button>
          ))}
        </div>

        <button 
          onClick={handleSignOut}
          style={{ width: '100%', padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', marginTop: '1rem' }}
        >
          Cerrar Sesión
        </button>
      </div>

      <BottomNav activeTab="config" />
    </main>
  )
}
