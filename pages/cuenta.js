import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

export default function Cuenta() {
  const [user, setUser] = useState(null)
  const router = useRouter()

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

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderBottom: '2px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: '800' }}>👤 Mi Cuenta</h1>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
        {user && (
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Email</div>
            <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>{user.email}</div>
          </div>
        )}

        <button 
          onClick={handleSignOut}
          style={{ width: '100%', padding: '1rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}
        >
          Cerrar Sesión
        </button>
      </div>

      <BottomNav activeTab="cuenta" />
    </main>
  )
}
