import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import toast from 'react-hot-toast'

export default function AddUserModal({ isOpen, onClose, localId, userId, onUserAdded }) {
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('cajero')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleAddUser = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Ingresá un email válido')
      return
    }
    if (!nombre.trim()) {
      toast.error('Ingresá el nombre del usuario')
      return
    }

    try {
      setLoading(true)

      // 1. Crear usuario en Authentication
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: 'Admin2026!',
        options: {
          data: {
            nombre: nombre,
            rol: rol
          }
        }
      })

      if (authError) throw authError

      // 2. Crear perfil en perfiles
      const { error: perfilError } = await supabase.from('perfiles').insert([{
        id: authData.user.id,
        email: email,
        nombre: nombre,
        rol_global: rol
      }])

      if (perfilError) throw perfilError

      // 3. Asignar al local inmediatamente
      const { error: miembroError } = await supabase.from('miembros_locales').insert([{
        local_id: localId,
        user_id: authData.user.id,
        rol: rol,
        activo: true,
        aceptado_en: new Date().toISOString()
      }])

      if (miembroError) throw miembroError

      toast.success(`✅ ${nombre} agregado como ${rol}`)
      setEmail('')
      setNombre('')
      onUserAdded?.()
      onClose()
      
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="m-0 text-xl font-bold">👤 Agregar Usuario al Local</h2>
          <button onClick={onClose} className="bg-none border-none text-2xl cursor-pointer text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        
        <div className="mb-4">
          <label className="block mb-2 font-semibold text-sm text-gray-700">Email del usuario *</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="empleado@ejemplo.com"
            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2 font-semibold text-sm text-gray-700">Nombre completo *</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Juan Pérez"
            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2 font-semibold text-sm text-gray-700">Rol *</label>
          <select
            value={rol}
            onChange={e => setRol(e.target.value)}
            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          >
            <option value="cajero">👨‍💼 Cajero - Opera caja, ventas y gastos</option>
            <option value="empleado">👷 Empleado - Solo registra ventas</option>
          </select>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg mb-4 text-sm text-blue-800 border border-blue-200">
          <strong>📧 Credenciales de acceso:</strong><br/>
          Email: {email || '(por definir)'}<br/>
          Contraseña temporal: <code className="bg-blue-100 px-2 py-0.5 rounded">Admin2026!</code><br/>
          <small className="text-blue-600">El usuario podrá cambiarla al iniciar sesión</small>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 p-3 bg-gray-100 text-gray-700 rounded-lg font-semibold cursor-pointer hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button 
            onClick={handleAddUser} 
            disabled={loading || !email || !nombre}
            className="flex-1 p-3 bg-blue-500 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
          >
            {loading ? 'Agregando...' : 'Agregar Usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}