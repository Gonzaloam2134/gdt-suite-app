import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import toast from 'react-hot-toast'
import Icono from '../components/ui/Icono'

/**
 * Pide el email y dispara el mail de recuperación. Antes esta página asumía
 * que siempre se llegaba acá DESPUÉS de hacer clic en el link del mail (leía
 * un token del hash de la URL) — pero es también el destino del botón
 * "¿Olvidaste tu contraseña?" del login, que te trae ACÁ ANTES de tener
 * ningún mail. Sin un token en el hash, la página vieja simplemente te
 * mandaba de vuelta al login sin explicar nada: no había forma de pedir el
 * mail de recuperación en ningún lado de la app.
 */
export default function RecuperarPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (error) throw error
      setEnviado(true)
    } catch (err) {
      console.error('Error al pedir recuperación:', err)
      toast.error('No se pudo enviar el link: ' + (err.message || 'intentá de nuevo'))
    } finally {
      setLoading(false)
    }
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-fondo flex items-center justify-center p-4">
        <div className="bg-white rounded-[26px] shadow-suave border border-black/5 w-full max-w-md p-8 text-center">
          <div className="text-6xl mb-4">📬</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Revisá tu email</h1>
          <p className="text-sm text-gray-600">
            Si <strong>{email}</strong> tiene una cuenta, te mandamos un link para elegir una contraseña nueva.
            Puede tardar unos minutos — revisá también la carpeta de spam.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 w-full py-3 press bg-primary-600 text-white font-semibold rounded-[14px] cursor-pointer hover:bg-primary-700 transition-colors"
          >
            Volver al login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-fondo flex items-center justify-center p-4">
      <div className="bg-white rounded-[26px] shadow-suave border border-black/5 w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-primary-600/70 mb-3 flex justify-center"><Icono nombre="candado" size={56} /></div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">Recuperar contraseña</h1>
          <p className="text-sm text-gray-500 mt-1">Te mandamos un link para elegir una nueva</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              autoFocus
              className="w-full px-4 py-3 border border-gray-300 rounded-[14px] text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 press bg-primary-600 text-white font-semibold rounded-[14px] cursor-pointer hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Enviando...' : 'Enviar link de recuperación'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-primary-700 hover:text-primary-700 cursor-pointer bg-none border-none underline"
          >
            Volver al login
          </button>
        </div>
      </div>
    </div>
  )
}
