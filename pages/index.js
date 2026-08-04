import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'

export default function Home() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignUp = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) alert(error.message)
    else alert('Cuenta creada!')
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>🚀 GDT Suite - Panel de Control</h1>
      
      {user ? (
        <div>
          <p>✅ Logueado como: <strong>{user.email}</strong></p>
          <button onClick={handleSignOut}>Cerrar Sesión</button>
        </div>
      ) : (
        <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '8px' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '8px' }} />
          <button type="submit" style={{ padding: '10px' }}>Iniciar Sesión</button>
          <button type="button" onClick={handleSignUp} style={{ padding: '10px' }}>Registrarse</button>
        </form>
      )}
    </main>
  )
}
