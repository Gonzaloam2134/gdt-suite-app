import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.push('/locales')
      }
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        router.push('/locales')
      }
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [router])

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: { full_name: 'Nuevo Usuario' } }
      })
      
      if (error) {
        alert(`Error: ${error.message || JSON.stringify(error)}`)
      } else {
        alert('✅ Cuenta creada. Redirigiendo...')
        router.push('/locales')
      }
    } catch (err) {
      alert(`Error inesperado: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      
      if (error) {
        alert(`Error: ${error.message || JSON.stringify(error)}`)
      }
    } catch (err) {
      alert(`Error inesperado: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>🚀 GDT Suite</h1>
      
      {user ? (
        <div style={{ padding: '20px', backgroundColor: '#d1fae5', borderRadius: '8px', textAlign: 'center' }}>
          <h2>✅ Sesión iniciada</h2>
          <p><strong>Email:</strong> {user.email}</p>
          <p>Redirigiendo a tus locales...</p>
          <button onClick={handleSignOut} style={{ padding: '10px 20px', cursor: 'pointer', marginTop: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px' }}>
            Cerrar Sesión
          </button>
        </div>
      ) : (
        <div style={{ padding: '20px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Iniciar Sesión / Registrarse</h3>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              style={{ padding: '12px', fontSize: '16px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
            <input 
              type="password" 
              placeholder="Contraseña (mínimo 6 caracteres)" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              minLength="6"
              style={{ padding: '12px', fontSize: '16px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
            <button 
              type="submit" 
              onClick={handleSignIn} 
              disabled={loading}
              style={{ padding: '12px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
            >
              {loading ? 'Procesando...' : 'Iniciar Sesión'}
            </button>
            <button 
              type="button" 
              onClick={handleSignUp} 
              disabled={loading}
              style={{ padding: '12px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
            >
              {loading ? 'Procesando...' : 'Registrarse'}
            </button>
          </form>
        </div>
      )}
    </main>
  )
}
