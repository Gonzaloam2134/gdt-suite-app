import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'

export default function Registro() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegistro = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            nombre: nombre.trim(),
          },
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('No se pudo crear el usuario')

      // 2. Crear o actualizar perfil (usamos upsert para evitar conflictos con triggers)
      const { error: perfilError } = await supabase
        .from('perfiles')
        .upsert({
          id: authData.user.id,
          email: email.trim(),
          nombre: nombre.trim(),
          rol_global: 'owner',
          creado_en: new Date().toISOString(),
        }, {
          onConflict: 'id'
        })

      if (perfilError) throw perfilError

      toast.success('✅ Cuenta creada! Redirigiendo...')
      
      // 3. Redirigir a locales
      setTimeout(() => {
        router.push('/locales')
      }, 1500)
      
    } catch (err) {
      console.error('Error al registrar:', err)
      
      let mensaje = 'No se pudo crear la cuenta'
      if (err.message?.includes('already registered')) {
        mensaje = 'Este email ya está registrado. ¿Querés iniciar sesión?'
      } else if (err.message?.includes('duplicate key')) {
        mensaje = 'Ya existe una cuenta con estos datos'
      } else if (err.message) {
        mensaje = err.message
      }
      
      toast.error(mensaje)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">💼</div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">Crear Cuenta</h1>
          <p className="text-sm text-gray-500 mt-1">Comenzá a gestionar tu negocio</p>
        </div>

        <form onSubmit={handleRegistro} className="space-y-4">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="Juan Pérez"
              autoComplete="name"
            />
          </div>

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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
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
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-500 text-white font-semibold rounded-lg cursor-pointer hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <div className="text-sm text-gray-600">
            ¿Ya tenés cuenta?{' '}
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:text-blue-700 cursor-pointer bg-none border-none underline font-semibold"
            >
              Ingresá
            </button>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            © 2026 GDT Suite. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}