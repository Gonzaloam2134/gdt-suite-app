import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Si ya hay sesión (por ejemplo, después de cambiar la contraseña desde el
  // flujo de recuperación), no tiene sentido mostrar el formulario de login.
  // Si además ya hay un local activo de una sesión anterior, vamos directo a
  // la caja — es la pantalla que se usa todos los días, /locales es solo
  // para elegir/cambiar de local. dashboard.jsx ya corre su propio guard de
  // suscripción (local suspendido/restringido), así que saltear /locales acá
  // no pierde esa validación.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      const localId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null
      router.replace(localId ? '/dashboard' : '/locales')
    })
  }, [router])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (error) throw error

      toast.success('Bienvenido')
      // Si llegó desde un link de invitación, lo devolvemos ahí para aceptarla
      const { invitacion } = router.query
      router.push(invitacion ? `/invitacion?token=${invitacion}` : '/locales')
    } catch (err) {
      console.error('Error al iniciar sesión:', err)
      toast.error('Error: ' + (err.message || 'Credenciales inválidas'))
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = () => {
    const { invitacion } = router.query
    router.push(invitacion ? `/registro?invitacion=${invitacion}` : '/registro')
  }

  return (
    <div className="min-h-screen bg-fondo flex items-center justify-center p-4">
      <div className="bg-white rounded-[26px] shadow-suave border border-black/5 w-full max-w-md p-8">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">💼</div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">GDT Suite</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión contable para tu negocio</p>
        </div>

        {/* Formulario de login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-[14px] text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-[14px] text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 press bg-primary-600 text-white font-semibold rounded-[14px] cursor-pointer hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* Links adicionales */}
        <div className="mt-6 text-center space-y-2">
          <button
            onClick={() => router.push('/recuperar-password')}
            className="text-sm text-primary-700 hover:text-primary-700 cursor-pointer bg-none border-none underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
          <div className="text-sm text-gray-600">
            ¿No tenés cuenta?{' '}
            <button
              onClick={handleSignUp}
              className="text-primary-700 hover:text-primary-700 cursor-pointer bg-none border-none underline font-semibold"
            >
              Creá una
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            © 2026 GDT Suite. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
