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
  const [showResetPassword, setShowResetPassword] = useState(false) // NUEVO
  const [resetEmailSent, setResetEmailSent] = useState(false) // NUEVO

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
          // Creamos el perfil con rol 'owner'
          const { error: perfilError } = await supabase
            .from('perfiles')
            .insert([{
              id: authData.user.id,
              email: email,
              nombre: businessName.trim(), 
              rol_global: 'owner' 
            }])

          if (perfilError) {
            console.error('Error creando perfil:', perfilError)
            // Si falla el perfil, igual continuamos pero logueamos el error
          }

          // Guardamos temporalmente los datos en localStorage para el onboarding
          localStorage.setItem('onboarding_temp_data', JSON.stringify({
            businessName: businessName.trim(),
            userId: authData.user.id,
            email: email
          }))

          toast.success('✅ Cuenta creada. Completá la configuración de tu local.')
          
          setIsSignUp(false)
          setEmail('')
          setPassword('')
          setBusinessName('')
          
          // Redirigimos con query params para indicar que viene del registro
          router.push('/locales?new_user=true&businessName=' + encodeURIComponent(businessName.trim()))
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success(' Bienvenido de vuelta')
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

        {/* MODAL RECUPERAR CONTRASEÑA */}
        {showResetPassword ? (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recuperar contraseña</h2>
            {!resetEmailSent ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Ingresá tu email y te enviaremos un link para restablecer tu contraseña.
                </p>
                <form onSubmit={handleResetPassword}>
                  <div className="mb-4">
                    <label className="block mb-2 font-semibold text-gray-700 text-sm">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      required
                      className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full p-4 bg-blue-500 text-white border-none rounded-lg text-base font-bold cursor-pointer disabled:opacity-50 hover:bg-blue-600 transition-colors"
                  >
                    {loading ? 'Enviando...' : 'Enviar link de recuperación'}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="text-5xl mb-3">📧</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Email enviado</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Revisá tu bandeja de entrada (y spam) para restablecer tu contraseña.
                </p>
              </div>
            )}
            <button
              onClick={() => { setShowResetPassword(false); setResetEmailSent(false); }}
              className="w-full mt-4 p-3 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200 transition-colors"
            >
              ← Volver al login
            </button>
          </div>
        ) : (
          <>
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

            {/* NUEVO: Link de recuperación de contraseña */}
            {!isSignUp && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowResetPassword(true)}
                  className="text-sm text-blue-600 bg-none border-none cursor-pointer font-medium hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <div className="mt-4 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-blue-600 bg-none border-none cursor-pointer font-medium hover:underline"
              >
                {isSignUp
                  ? '¿Ya tenés cuenta? Ingresá'
                  : '¿No tenés cuenta? Creá una'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}