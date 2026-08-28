import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'

/**
 * Página a la que apunta el link del mail de recuperación (ver `redirectTo`
 * en recuperar-password.js). El SDK de Supabase detecta el token del hash de
 * la URL solo (`detectSessionInUrl`, prendido por default) y emite el evento
 * `PASSWORD_RECOVERY`; no hay que parsear el hash a mano. Si el link venció o
 * ya se usó, Supabase agrega `#error=...&error_code=...` al hash — se chequea
 * de forma genérica, no contra un código puntual (el link viejo comparaba
 * contra `error_code=403`, que no es el formato real que usa Supabase).
 */
export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [estado, setEstado] = useState('verificando') // verificando | listo | invalido
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=') || hash.includes('error_code=')) {
      setEstado('invalido')
      return
    }

    const { data: suscripcion } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setEstado('listo')
    })

    // Si la página se recarga después de que el evento ya disparó (o el SDK
    // ya había procesado el hash antes de que este efecto corriera), la
    // sesión de recuperación puede estar lista sin que el evento vuelva a emitirse.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setEstado((actual) => (actual === 'verificando' ? 'listo' : actual))
    })

    // Si no pasó nada de esto en 6 segundos, el link no era válido para empezar.
    const timeout = setTimeout(() => {
      setEstado((actual) => (actual === 'verificando' ? 'invalido' : actual))
    }, 6000)

    return () => { suscripcion.subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  const handleReset = async (e) => {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase.auth.updateUser({ password })

      if (error) throw error

      toast.success('✅ Contraseña actualizada correctamente')
      setTimeout(() => router.push('/locales'), 1500)
    } catch (err) {
      toast.error(err.message || 'Error al actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  if (estado === 'verificando') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl text-center">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Verificando tu link…</h1>
          <p className="text-sm text-gray-600 m-0">Un segundo, estamos validando el link de recuperación.</p>
        </div>
      </main>
    )
  }

  if (estado === 'invalido') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link inválido o vencido</h1>
          <p className="text-sm text-gray-600 mb-4">Pedí uno nuevo para poder cambiar tu contraseña.</p>
          <button
            onClick={() => router.push('/recuperar-password')}
            className="px-6 py-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600"
          >
            Pedir un nuevo link
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🔐</div>
          <h1 className="m-0 text-2xl font-extrabold text-gray-900">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ingresá tu nueva contraseña
          </p>
        </div>

        <form onSubmit={handleReset}>
          <div className="mb-4">
            <label className="block mb-2 font-semibold text-gray-700 text-sm">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              autoFocus
              className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border"
            />
          </div>

          <div className="mb-6">
            <label className="block mb-2 font-semibold text-gray-700 text-sm">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repetí la contraseña"
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
            {loading ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </main>
  )
}
