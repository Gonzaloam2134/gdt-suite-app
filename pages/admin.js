import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'

export default function AdminPanel() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({ locales: 0, usuarios: 0, transacciones: 0 })
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
        return
      }
      
      const { data: perfil } = await supabase.from('perfiles').select('rol_global').eq('id', session.user.id).single()
      if (perfil?.rol_global !== 'super_user') {
        toast.error('Acceso denegado')
        router.push('/locales')
        return
      }

      setUser(session.user)
      loadStats()
    })
  }, [router])

  const loadStats = async () => {
    try {
      const { count: countLocales } = await supabase.from('locales').select('*', { count: 'exact', head: true })
      const { count: countUsuarios } = await supabase.from('perfiles').select('*', { count: 'exact', head: true })
      const { count: countTx } = await supabase.from('transacciones').select('*', { count: 'exact', head: true })
      
      setStats({
        locales: countLocales || 0,
        usuarios: countUsuarios || 0,
        transacciones: countTx || 0
      })
    } catch (err) {
      console.error('Error cargando stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">Cargando panel...</div>

  return (
    <main className="min-h-screen bg-slate-900 text-white pb-20">
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="m-0 text-xl font-bold text-white">👑 Panel de Super Administrador</h1>
            <p className="mt-0.5 text-xs text-slate-400">Bienvenido, {user?.email}</p>
          </div>
          <button onClick={handleSignOut} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-md text-white text-xs font-medium cursor-pointer transition-colors">Cerrar Sesión</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="text-slate-400 text-sm font-semibold mb-2">LOCALES REGISTRADOS</div>
            <div className="text-4xl font-extrabold text-blue-400">{stats.locales}</div>
          </div>
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="text-slate-400 text-sm font-semibold mb-2">USUARIOS TOTALES</div>
            <div className="text-4xl font-extrabold text-emerald-400">{stats.usuarios}</div>
          </div>
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="text-slate-400 text-sm font-semibold mb-2">TRANSACCIONES GLOBALES</div>
            <div className="text-4xl font-extrabold text-purple-400">{stats.transacciones}</div>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h2 className="text-lg font-bold mb-4">Gestión del Sistema</h2>
          <p className="text-slate-400 text-sm mb-4">Aquí podrás gestionar planes, usuarios y configuraciones globales (Próximamente en la Fase 2).</p>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold cursor-pointer transition-colors">Ver Todos los Locales</button>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold cursor-pointer transition-colors">Configuración Global</button>
          </div>
        </div>
      </div>
    </main>
  )
}