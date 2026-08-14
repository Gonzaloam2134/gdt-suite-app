import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import toast from 'react-hot-toast'

export default function InviteUserModal({ isOpen, onClose, localId, userId, onUserAdded }) {
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('cajero')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const generarPasswordTemporal = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let password = 'Temp'
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const limpiarRegistrosHuerfanos = async (email) => {
    try {
      // Buscar registros huérfanos
      const { data: orphanData } = await supabase
        .from('perfiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (orphanData) {
        // Verificar si existe en auth.users
        const { data: authUser } = await supabase.rpc('get_user_by_email', { user_email: email })
        
        if (!authUser?.[0]?.exists_in_auth) {
          // Eliminar registros huérfanos
          await supabase.from('miembros_locales').delete().eq('user_id', orphanData.id)
          await supabase.from('perfiles').delete().eq('id', orphanData.id)
          console.log('Registros huérfanos eliminados para:', email)
        }
      }
    } catch (err) {
      console.error('Error limpiando huérfanos:', err)
    }
  }

  const handleInvite = async () => {
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

      // 1. Verificar si el usuario ya existe
      const { data: existingUser, error: checkError } = await supabase
        .rpc('get_user_by_email', { user_email: email })

      if (checkError) throw checkError

      const userExists = existingUser?.[0]?.exists_in_auth
      const hasOrphans = existingUser?.[0]?.has_orphan_records
      const orphanUserId = existingUser?.[0]?.user_id

      // 2. Si tiene registros huérfanos, limpiarlos
      if (hasOrphans && !userExists) {
        await limpiarRegistrosHuerfanos(email)
      }

      // 3. Si el usuario ya existe en auth, no permitir duplicados
      if (userExists) {
        toast.error('Este usuario ya existe en el sistema')
        setLoading(false)
        return
      }

      // 4. Generar password temporal
      const password = generarPasswordTemporal()

      // 5. Crear usuario en Authentication
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            nombre: nombre,
            rol: rol
          }
        }
      })

      if (authError) throw authError

      // 6. Crear perfil en perfiles
      const { error: perfilError } = await supabase.from('perfiles').insert([{
        id: authData.user.id,
        email: email,
        nombre: nombre,
        rol_global: rol
      }])

      if (perfilError) throw perfilError

      // 7. Asignar al local inmediatamente
      const { error: miembroError } = await supabase.from('miembros_locales').insert([{
        local_id: localId,
        user_id: authData.user.id,
        rol: rol,
        activo: true,
        aceptado_en: new Date().toISOString()
      }])

      if (miembroError) throw miembroError

      // 8. Enviar email para cambiar contraseña
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/dashboard'
      })

      if (resetError) {
        console.warn('No se pudo enviar email de reset:', resetError)
      }

      toast.success(`✅ ${nombre} agregado como ${rol}. Email enviado.`)
      setSuccess(true)
      onUserAdded?.()
      
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const cerrarYLimpiar = () => {
    setEmail('')
    setNombre('')
    setSuccess(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="m-0 text-xl font-bold">👤 Invitar Usuario al Local</h2>
          <button onClick={cerrarYLimpiar} className="bg-none border-none text-2xl cursor-pointer text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {!success ? (
          <>
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
                <option value="cajero">👨💼 Cajero - Opera caja, ventas y gastos</option>
                <option value="empleado">👷 Empleado - Solo registra ventas</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={cerrarYLimpiar} 
                className="flex-1 p-3 bg-gray-100 text-gray-700 rounded-lg font-semibold cursor-pointer hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button 
                onClick={handleInvite} 
                disabled={loading || !email || !nombre}
                className="flex-1 p-3 bg-blue-500 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
              >
                {loading ? 'Creando...' : 'Invitar Usuario'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-green-50 p-4 rounded-lg mb-4 border-2 border-green-200">
              <div className="text-4xl mb-2">✅</div>
              <div className="text-green-800 font-bold mb-2">¡Usuario creado exitosamente!</div>
              <div className="text-sm text-green-700">
                Se envió un email a <strong>{email}</strong> con instrucciones para cambiar su contraseña.
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg mb-4 text-xs text-blue-800 border border-blue-200">
              💡 El usuario debe revisar su email y hacer clic en el link para establecer su contraseña. Una vez hecho eso, podrá iniciar sesión con su email y la nueva contraseña.
            </div>

            <button 
              onClick={cerrarYLimpiar}
              className="w-full p-3 bg-blue-500 text-white rounded-lg font-bold cursor-pointer hover:bg-blue-600"
            >
              Listo
            </button>
          </>
        )}
      </div>
    </div>
  )
}