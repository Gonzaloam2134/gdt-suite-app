import { supabase } from '../lib/supabaseClient'
import { useState } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [businessName, setBusinessName] = useState('')

  const router = useRouter()

const handleSubmit = async (e) => {
  e.preventDefault()
  if (!email || !password) {
    toast.error('Completá email y contraseña')
    return
  }

  try {
    setLoading(true)

    if (isSignUp) {
      if (!businessName.trim()) {
        toast.error('Ingresá el nombre de tu negocio')
        return
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { business_name: businessName.trim() }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        const { error: localError } = await supabase
          .from('locales')
          .insert([{
            nombre: businessName.trim(),
            creado_por: authData.user.id,
            activo: true
          }])

        if (localError) throw localError

        toast.success('✅ Cuenta creada. Revisá tu email para confirmar.')
        setIsSignUp(false)
        setEmail('')
        setPassword('')
        setBusinessName('')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      toast.success('👋 Bienvenido de vuelta')
      
      // ✅ REDIRECCIÓN DESPUÉS DEL LOGIN
      router.push('/locales')
    }
  } catch (err) {
    toast.error(err.message || 'Error en la operación')
  } finally {
    setLoading(false)
  }
}

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl">
        {/* LOGO */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">💼</div>
          <h1 className="m-0 text-2xl font-extrabold text-gray-900">GDT Suite</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestión contable para tu negocio
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="mb-4">
              <label className="block mb-2 font-semibold text-gray-700 text-sm">
                Nombre del negocio *
              </label>
              <input
                type="text"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="Ej: Mi Negocio SRL"
                required
                className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block mb-2 font-semibold text-gray-700 text-sm">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border"
            />
          </div>

          <div className="mb-6">
            <label className="block mb-2 font-semibold text-gray-700 text-sm">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full p-4 bg-blue-500 text-white border-none rounded-lg text-base font-bold cursor-pointer disabled:opacity-50 hover:bg-blue-600 transition-colors"
          >
            {loading
              ? 'Procesando...'
              : isSignUp
              ? 'Crear cuenta'
              : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-blue-600 bg-none border-none cursor-pointer font-medium hover:underline"
          >
            {isSignUp
              ? '¿Ya tenés cuenta? Ingresá'
              : '¿No tenés cuenta? Creá una'}
          </button>
        </div>
      </div>
    </main>
  )
}