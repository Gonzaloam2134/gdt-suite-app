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
        const { data: perfil, error: perfilError } = await supabase
          .from('perfiles')
          .select('rol_global')
          .eq('id', session.user.id)
          .maybeSingle()

        if (perfilError) console.error('Error al obtener perfil:', perfilError)

        const rol = perfil?.rol_global || 'owner'
        setUserRole(rol)

        if (rol === 'super_user') {
          router.push('/admin')
          return
        }

        await loadMisLocales(session.user.id, rol)

      } catch (err) {
        console.error('Error al cargar datos del usuario:', err)
        toast.error('Error al cargar datos del usuario')
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  const loadMisLocales = async (userId, currentRole) => {
    try {
      const { data: membresias, error: errorMembresia } = await supabase
        .from('miembros_locales')
        .select('local_id, rol')
        .eq('user_id', userId)
        .eq('activo', true)

      if (errorMembresia) throw errorMembresia

      if (!membresias || membresias.length === 0) {
        setMisLocales([])
        if (currentRole !== 'cajero' && currentRole !== 'empleado') {
          setShowOnboarding(true)
        }
        return
      }

      const localIds = membresias.map(m => m.local_id)
      const { data: localesData, error: errorLocales } = await supabase
        .from('locales')
        .select('id, nombre, rubro, condicion_fiscal')
        .in('id', localIds)

      if (errorLocales) throw errorLocales

      setMisLocales(localesData || [])

      // ✅ Redirección automática para Cajeros/Empleados a /dashboard
      if ((currentRole === 'cajero' || currentRole === 'empleado') && localesData && localesData.length > 0) {
        const primerLocalId = localesData[0].id
        localStorage.setItem('activeLocalId', primerLocalId)
        toast.success('Local seleccionado automáticamente')
        setTimeout(() => {
          router.push('/dashboard') // ✅ CORRECTO
        }, 500)
        return
      }

    } catch (err) {
      console.error('Error al cargar tus locales:', err)
      toast.error('Error al cargar tus locales: ' + err.message)
    }
  }

  const handleOnboardingComplete = async (formData) => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      toast.error('No hay sesión activa.')
      router.push('/')
      return
    }

    if (userRole === 'cajero' || userRole === 'empleado') {
      toast.error('⛔ No tenés permisos para crear locales.')
      setShowOnboarding(false)
      return
    }

    try {
      setCreating(true)
      
      const payload = {
        nombre: formData.businessName?.trim() || 'Negocio Sin Nombre',
        rubro: formData.rubro || 'Otro',
        condicion_fiscal: formData.condicionFiscal || 'Consumidor Final',
        creado_por: session.user.id
      }
      
      const { data: localData, error: localError } = await supabase
        .from('locales')
        .insert([payload])
        .select()
        .single()
      
      if (localError) throw new Error(`Error en tabla LOCALES: ${localError.message}`)

      // Registrar al creador como 'owner'
      const { error: miembroError } = await supabase
        .from('miembros_locales')
        .insert([{
          local_id: localData.id,
          user_id: session.user.id,
          rol: 'owner',
          activo: true,
          aceptado_en: new Date().toISOString()
        }])

      if (miembroError) throw new Error(`Error al registrar miembro: ${miembroError.message}`)

      // ✅ NUEVO: Insertar medios de pago seleccionados (Fase 2.5)
      if (formData.mediosPago && formData.mediosPago.length > 0) {
        const mediosAInsertar = formData.mediosPago
          .filter(m => m.habilitado)
          .map((m, i) => ({
            local_id: localData.id,
            nombre: m.nombre,
            tipo: m.tipo,
            icono: m.icono,
            comision_porcentaje: m.comision,
            plazo_acreditacion_dias: m.plazo,
            habilitado: true,
            es_default: true,
            orden: i,
            creado_por: session.user.id
          }))

        if (mediosAInsertar.length > 0) {
          const { error: mediosError } = await supabase.from('medios_pago').insert(mediosAInsertar)
          if (mediosError) console.warn('Error en medios de pago:', mediosError)
        }
      }

      toast.success(' Local creado correctamente')
      localStorage.setItem('activeLocalId', localData.id)
      localStorage.removeItem('onboarding_temp_data')
      
      // ✅ Redirección a /dashboard
      setTimeout(() => {
        router.push('/dashboard') // ✅ CORRECTO
      }, 1500)

    } catch (err) {
      console.error('Error al crear local:', err)
      toast.error('Error al crear local: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleSelectLocal = (localId) => {
    if (userRole === 'cajero' || userRole === 'empleado') {
      toast.error('⛔ Los cajeros y empleados son redirigidos automáticamente')
      return
    }

    localStorage.setItem('activeLocalId', localId)
    toast.success('Local seleccionado')
    // ✅ Redirección a /dashboard
    router.push('/dashboard') // ✅ CORRECTO
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-center">
          <div className="text-4xl mb-3"></div>
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
          <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer hover:bg-gray-200">
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        {misLocales.length === 0 && (userRole === 'cajero' || userRole === 'empleado') ? (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-amber-300">
            <div className="text-5xl mb-3">⏳</div>
            <h3 className="m-0 mb-2 text-gray-900 text-base font-bold">Esperando asignación</h3>
            <p className="m-0 mb-6 text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">
              Tu cuenta ha sido creada, pero el dueño aún no te ha asignado a un local.
            </p>
            <button onClick={handleSignOut} className="px-6 py-3 bg-gray-200 text-gray-700 border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-300 transition-colors">
              Volver al inicio
            </button>
          </div>
        ) : misLocales.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
            <div className="text-5xl mb-3">🏪</div>
            <h3 className="m-0 mb-2 text-gray-900 text-base font-bold">Sin locales registrados</h3>
            <p className="m-0 mb-4 text-gray-500 text-sm">Creá tu primer local para empezar a operar</p>
            <button onClick={() => setShowOnboarding(true)} className="px-6 py-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 transition-colors">
              + Crear mi primer local
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {misLocales.map((local, index) => (
              <div key={local.id || index} className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-lg transition-all">
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
                  {/* ✅ Texto cambiado, pero ruta correcta a /dashboard */}
                  <button
                    onClick={() => handleSelectLocal(local.id)}
                    className="w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    → Ir a Caja
                  </button>

                  {userRole === 'owner' && (
                    <button
                      onClick={() => {
                        localStorage.setItem('activeLocalId', local.id)
                        router.push('/admin?tab=miembros')
                      }}
                      className="w-full p-3 bg-purple-50 text-purple-700 border-2 border-purple-200 rounded-lg text-sm font-semibold cursor-pointer hover:bg-purple-100 hover:border-purple-300 transition-colors"
                    >
                      👥 Gestionar Equipo
                    </button>
                  )}
                </div>
              </div>
            ))}

            {userRole === 'owner' && (
              <button onClick={() => setShowOnboarding(true)} className="w-full p-4 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-semibold cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
                + Agregar otro local
              </button>
            )}
          </div>
        )}
      </div>

      {showOnboarding && (
        <OnboardingWizard 
          onComplete={handleOnboardingComplete} 
          onCancel={() => {
            setShowOnboarding(false)
            localStorage.removeItem('onboarding_temp_data')
          }} 
          userEmail={user?.email}
          preloadedData={JSON.parse(localStorage.getItem('onboarding_temp_data') || 'null')}
        />
      )}
    </main>
  )
}
