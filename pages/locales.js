import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import OnboardingWizard from '../components/OnboardingWizard'

export default function Locales() {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [misLocales, setMisLocales] = useState([])
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [creating, setCreating] = useState(false)

  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
        return
      }
      
      setUser(session.user)
      
      try {
        // 1. Obtener el rol global del usuario
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol_global')
          .eq('id', session.user.id)
          .single()

        const rol = perfil?.rol_global || 'owner'
        setUserRole(rol)

        // 2. Si es Super Admin, al panel global directamente
        if (rol === 'super_user') {
          router.push('/admin')
          return
        }

        // 3. Cargar SOLO los locales a los que este usuario pertenece (pasamos el rol)
        await loadMisLocales(session.user.id, rol)

      } catch (err) {
        console.error('Error al cargar perfil:', err)
        toast.error('Error al cargar datos del usuario')
      } finally {
        setLoading(false)
      }
    })
  }, [router])

      const loadMisLocales = async (userId, currentRole) => {
    try {
      // PASO 1: Obtener solo los IDs de los locales a los que pertenece el usuario
      const { data: membresias, error: errorMembresia } = await supabase
        .from('miembros_locales')
        .select('local_id, rol')
        .eq('user_id', userId)
        .eq('activo', true)

      if (errorMembresia) throw errorMembresia
      
      // Si no tiene membresías
      if (!membresias || membresias.length === 0) {
        setMisLocales([])
        if (currentRole !== 'cajero' && currentRole !== 'empleado') {
          setShowOnboarding(true)
        }
        return
      }

      // PASO 2: Extraer los IDs y consultar la tabla de locales directamente
      const localIds = membresias.map(m => m.local_id)

      const { data: localesData, error: errorLocales } = await supabase
        .from('locales')
        .select('id, nombre, rubro, condicion_fiscal')
        .in('id', localIds)

      if (errorLocales) throw errorLocales
      
      setMisLocales(localesData || [])

    } catch (err) {
      console.error('Error detallado:', err)
      toast.error('Error al cargar tus locales: ' + err.message)
    }
  }

  const handleOnboardingComplete = async (formData) => {
    try {
      setCreating(true)
      
      // 1. Crear el local
      const { data: localData, error: localError } = await supabase
        .from('locales')
        .insert([{
          nombre: formData.businessName.trim(),
          rubro: formData.rubro,
          condicion_fiscal: formData.condicionFiscal,
          creado_por: user.id
        }])
        .select()
        .single()

      if (localError) throw localError

      // 2. Registrar al creador como 'owner' en miembros_locales
      await supabase
        .from('miembros_locales')
        .insert([{
          local_id: localData.id,
          user_id: user.id,
          rol: 'owner',
          activo: true,
          aceptado_en: new Date().toISOString()
        }])

      // 3. Crear invitaciones si las hay
      if (formData.invites && formData.invites.length > 0) {
        const invitaciones = formData.invites.map(inv => ({
          email_invitado: inv.email,
          local_id: localData.id,
          rol: inv.rol,
          invitado_por: user.id,
          token: crypto.randomUUID(),
          expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          estado: 'pendiente'
        }))

        await supabase.from('invitaciones').insert(invitaciones)
        toast.success(`✅ Local creado y ${formData.invites.length} invitación(es) enviada(s)`)
      } else {
        toast.success('🏪 Local creado correctamente')
      }
      
      // 4. Auto-seleccionar y redirigir
      localStorage.setItem('activeLocalId', localData.id)
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
      
    } catch (err) {
      toast.error('Error al crear local: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleSelectLocal = (localId) => {
    localStorage.setItem('activeLocalId', localId)
    toast.success('Local seleccionado')
    router.push('/dashboard')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-gray-600 text-sm">Cargando tus locales...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="m-0 text-lg font-bold text-gray-900">🏪 Mis Locales</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {misLocales.length} {misLocales.length === 1 ? 'local asignado' : 'locales asignados'}
            </p>
          </div>
          <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer">Salir</button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        {/* CASO 1: No tiene locales y es Cajero/Empleado */}
        {misLocales.length === 0 && (userRole === 'cajero' || userRole === 'empleado') ? (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-amber-300">
            <div className="text-5xl mb-3">⏳</div>
            <h3 className="m-0 mb-2 text-gray-900 text-base font-bold">Esperando asignación</h3>
            <p className="m-0 mb-6 text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">
              Tu cuenta ha sido creada, pero el dueño aún no te ha asignado a un local. 
              <br /><br />
              Por favor, contactá al administrador para que te agregue al equipo.
            </p>
            <button onClick={handleSignOut} className="px-6 py-3 bg-gray-200 text-gray-700 border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-300 transition-colors">
              Volver al inicio
            </button>
          </div>

        /* CASO 2: No tiene locales y es Dueño (Owner) */
        ) : misLocales.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
            <div className="text-5xl mb-3">🏪</div>
            <h3 className="m-0 mb-2 text-gray-900 text-base font-bold">Sin locales registrados</h3>
            <p className="m-0 mb-4 text-gray-500 text-sm">Creá tu primer local para empezar a operar</p>
            <button onClick={() => setShowOnboarding(true)} className="px-6 py-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 transition-colors">
              + Crear mi primer local
            </button>
          </div>

        /* CASO 3: Ya tiene locales asignados */
        ) : (
          <div className="flex flex-col gap-3">
            {misLocales.map((local, index) => (
  <div 
    key={local.id || index} 
    className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-lg transition-all"
  >
    <div className="flex items-start gap-3 mb-4">
      <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-3xl shadow-sm">
        🏪
      </div>
      <div>
        <h3 className="m-0 text-lg font-bold text-gray-900">{local.nombre}</h3>
        <div className="flex gap-2 mt-1">
          {local.rubro && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{local.rubro}</span>}
          {local.condicion_fiscal && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">{local.condicion_fiscal}</span>}
        </div>
      </div>
    </div>
    
    <div className="flex flex-col gap-2">
      <button 
        onClick={() => handleSelectLocal(local.id)}
        className="w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 transition-colors"
      >
        → Entrar al Dashboard
      </button>
      
      <button 
        onClick={() => {
          localStorage.setItem('activeLocalId', local.id)
          router.push('/admin?tab=miembros')
        }}
        className="w-full p-3 bg-purple-50 text-purple-700 border-2 border-purple-200 rounded-lg text-sm font-semibold cursor-pointer hover:bg-purple-100 hover:border-purple-300 transition-colors"
      >
         Gestionar Equipo
      </button>
    </div>
  </div>
))}
            
            {/* Solo el owner puede agregar más locales */}
            {userRole === 'owner' && (
              <button onClick={() => setShowOnboarding(true)} className="w-full p-4 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-semibold cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
                + Agregar otro local
              </button>
            )}
          </div>
        )}
      </div>

      {showOnboarding && (
        <OnboardingWizard onComplete={handleOnboardingComplete} onCancel={() => setShowOnboarding(false)} userEmail={user?.email} />
      )}
    </main>
  )
}
