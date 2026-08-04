import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'

export default function Home() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Verificar sesión activa
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: 'Usuario Test'
          }
        }
      })
      
      if (error) {
        console.error('Signup error:', error)
        alert(`Error: ${error.message || JSON.stringify(error)}`)
      } else {
        console.log('Signup success:', data)
        alert('Cuenta creada! Revisa tu email para confirmar.')
      }
    } catch (err) {
      console.error('Unexpected error:', err)
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
        console.error('Login error:', error)
        alert(`Error: ${error.message || JSON.stringify(error)}`)
      } else {
        console.log('Login success:', data)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
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
      <h1>🚀 GDT Suite - Panel de Control</h1>
      
      {user ? (
        <div style={{ padding: '20px', backgroundColor: '#d1fae5', borderRadius: '8px' }}>
          <h2>✅ Sesión iniciada</h2>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>ID:</strong> {user.id}</p>
          <button onClick={handleSignOut} style={{ padding: '10px 20px', cursor: 'pointer', marginTop: '10px' }}>
            Cerrar Sesión
          </button>
        </div>
      ) : (
        <div style={{ padding: '20px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <h3>Iniciar Sesión / Registrarse</h3>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              style={{ padding: '10px', fontSize: '16px' }}
            />
            <input 
              type="password" 
              placeholder="Contraseña (mínimo 6 caracteres)" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              minLength="6"
              style={{ padding: '10px', fontSize: '16px' }}
            />
            <button 
              type="submit" 
              onClick={handleSignIn} 
              disabled={loading}
              style={{ padding: '12px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              {loading ? 'Procesando...' : 'Iniciar Sesión'}
            </button>
            <button 
              type="button" 
              onClick={handleSignUp} 
              disabled={loading}
              style={{ padding: '12px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              {loading ? 'Procesando...' : 'Registrarse'}
            </button>
          </form>
        </div>
      )}
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fef3c7', borderRadius: '8px', fontSize: '14px' }}>
        <strong>ℹ️ Debug:</strong>
        <pre style={{ marginTop: '10px', overflow: 'auto' }}>
          {JSON.stringify({
            hasSupabase: !!supabase,
            hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            userEmail: email
          }, null, 2)}
        </pre>
      </div>
    </main>
  )
}
