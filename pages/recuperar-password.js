import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import toast from 'react-hot-toast'

export default function RecuperarPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Extraer el access_token del hash de la URL
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const type = params.get('type')
        
        if (accessToken && type === 'recovery') {
          // Establecer la sesión con el token de recuperación
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: params.get('refresh_token') || ''
          }).then(({ error }) => {
            if (error) {
              toast.error('Token inválido o expirado')
              router.push('/')
            } else {
              setTokenValid(true)
            }
          })
        } else {
          toast.error('Link de recuperación inválido')
          router.push('/')
        }
      } else {
        router.push('/')
      }
    }
  }, [router])

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase.auth.updateUser({ 
        password: password 
      })
      
      if (error) throw error
      
      toast.success('✅ Contraseña actualizada correctamente')
      
      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-blue-500 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verificando...</h1>
          <p className="text-sm text-gray-600">Validando tu link de recuperación</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-blue-500 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Nueva contraseña</h1>
          <p className="text-sm text-gray-600">Ingresá tu nueva contraseña</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-base"
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-base"
              placeholder="Repetí la contraseña"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full p-4 bg-blue-500 text-white rounded-lg font-bold text-lg cursor-pointer disabled:opacity-50 hover:bg-blue-600 transition-colors"
          >
            {loading ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}