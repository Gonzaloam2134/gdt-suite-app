import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    // Verificar si hay un hash en la URL (Supabase lo agrega)
    const hash = window.location.hash
    if (hash.includes('error_code=403')) {
      setError('El link de recuperación expiró o es inválido.')
    }
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
      setTimeout(() => router.push('/'), 1500)
    } catch (err) {
      toast.error(err.message || 'Error al actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl text-center">
          <div className="text-5xl mb-3">️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h1>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer"
          >
            Volver al login
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