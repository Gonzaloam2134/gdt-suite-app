// components/UserInfo.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function UserInfo() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    getCurrentUser()
  }, [])

  const getCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      setUser(session.user)
      
      // Obtener perfil completo desde la tabla perfiles
      const { data: perfilData } = await supabase
        .from('perfiles')
        .select('nombre, rol_global, email')
        .eq('id', session.user.id)
        .single()
      
      setProfile(perfilData)
    }
  }

  if (!user) return null

  return (
    <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
        {profile?.nombre?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
      </div>
      <div className="text-sm">
        <div className="font-semibold text-gray-900">
          {profile?.nombre || 'Usuario'}
        </div>
        <div className="text-xs text-gray-500">
          {profile?.rol_global === 'owner' ? '👑 Owner' : 
           profile?.rol_global === 'cajero' ? '👨‍💼 Cajero' : 
           profile?.rol_global === 'empleado' ? '👷 Empleado' : 'Usuario'}
        </div>
      </div>
    </div>
  )
}