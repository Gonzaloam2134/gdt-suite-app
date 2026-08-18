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
        const { data: perfil, error: perfilError } = await supabase
          .from('perfiles')
          .select('rol_global')
          .eq('id', session.user.id)
          .maybeSingle()

        if (perfilError) {
          console.error('Error al obtener perfil:', perfilError)
        }

        const rol = perfil?.rol_global || 'owner'
        console.log('🔍 [Locales] Rol detectado:', rol)
        setUserRole(rol)

        // 2. Si es Super Admin, al panel global directamente
        if (rol === 'super_user') {
          router.push('/admin')
          return
        }

        // 3. Cargar los locales a los que este usuario pertenece
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
    console.log('🔍 [loadMisLocales] Iniciando para userId:', userId, 'rol:', currentRole)
    try {
      const { data: membresias, error: errorMembresia } = await supabase
        .from('miembros_locales')
        .select('local_id, rol')
        .eq('user_id', userId)
        .eq('activo', true)

      if (errorMembresia) {
        console.error(' [loadMisLocales] Error al obtener membresías:', errorMembresia)
        throw errorMembresia
      }

      console.log(' [loadMisLocales] Membresías encontradas:', membresias)

      if (!membresias || membresias.length === 0) {
        setMisLocales([])

        if (currentRole !== 'cajero' && currentRole !== 'empleado') {
          console.log('✅ [loadMisLocales] Es owner sin locales. Mostrando onboarding.')
          setShowOnboarding(true)
        } else {
          console.log('✅ [loadMisLocales] Es cajero/empleado sin locales. Mostrando espera.')
        }
        return
      }

      const localIds = membresias.map(m => m.local_id)

      if (localIds.length === 0) {
        setMisLocales([])
        return
      }

      const { data: localesData, error: errorLocales } = await supabase
        .from('locales')
        .select('id, nombre, rubro, condicion_fiscal')
        .in('id', localIds)

      if (errorLocales) {
        console.error('❌ [loadMisLocales] Error al obtener locales:', errorLocales)
        throw errorLocales
      }

      console.log('✅ [loadMisLocales] Locales cargados:', localesData)
      setMisLocales(localesData || [])

      // ✅ CAMBIO: Redirección a /caja en lugar de /dashboard
      if ((currentRole === 'cajero' || currentRole === 'empleado') && localesData && localesData.length > 0) {
        console.log('🚀 [loadMisLocales] Cajero/Empleado con local asignado. Redirigiendo automáticamente...')
        const primerLocalId = localesData[0].id
        localStorage.setItem('activeLocalId', primerLocalId)
        toast.success('Local seleccionado automáticamente')
        setTimeout(() => {
          router.push('/caja') // ✅ ANTES ERA '/dashboard'
        }, 500)
        return
      }

    } catch (err) {
      console.error('❌ [loadMisLocales] Error detallado:', err)
      toast.error('Error al cargar tus locales: ' + err.message)
    }
  }

  const handleOnboardingComplete = async (formData) => {
    console.log('🔍 [TEST 1] Iniciando creación de local...')
    
    const { data: { session } } = await supabase.auth.getSession()
    console.log('🔍 [TEST 2] Sesión:', session ? 'ACTIVA' : 'INACTIVA')
    console.log(' [TEST 3] User ID:', session?.user?.id)
    
    if (!session?.user) {
      console.error('❌ [TEST 4] No hay sesión activa')
      toast.error('No hay sesión activa. Por favor, iniciá sesión nuevamente.')
      router.push('/')
      return
    }

    if (userRole === 'cajero' || userRole === 'empleado') {
      console.error('🚫 [TEST 5] Intento bloqueado por rol')
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
      
      console.log('🔍 [TEST 6] Payload a enviar:', payload)
      console.log('🔍 [TEST 7] Ejecutando supabase.from(\'locales\').insert()...')
      
      const { data: localData, error: localError } = await supabase
        .from('locales')
        .insert([payload])
        .select()
        .single()
      
      console.log('🔍 [TEST 8] Respuesta de Supabase:', { localData, localError })
      
      if (localError) {
        console.error('❌ [TEST 9] ERROR DETALLADO DE SUPABASE:', JSON.stringify(localError, null, 2))
        throw new Error(`Error en tabla LOCALES: ${localError.message}`)
      }
      
      console.log('✅ [TEST 10] Local insertado correctamente:', localData)

      // 2. Registrar al creador como 'owner' en miembros_locales
      console.log('🔍 [TEST 11] Insertando en miembros_locales...')
      const { error: miembroError } = await supabase
        .from('miembros_locales')
        .insert([{
          local_id: localData.id,
          user_id: session.user.id,
          rol: 'owner',
          activo: true,
          aceptado_en: new Date().toISOString()
        }])

      if (miembroError) {
        console.error('❌ [TEST 12] Error en miembros_locales:', miembroError)
        throw new Error(`Error al registrar miembro: ${miembroError.message}`)
      }
      
      console.log('✅ [TEST 13] Miembro registrado correctamente')

      // 3. Crear invitaciones si las hay
      if (formData.invites && formData.invites.length > 0) {
        console.log('🔍 [TEST 14] Procesando invitaciones...')
        const invitaciones = formData.invites.map(inv => ({
          email_invitado: inv.email,
          local_id: localData.id,
          rol: inv.rol,
          invitado_por: session.user.id,
          token: crypto.randomUUID(),
          expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          estado: 'pendiente'
        }))

        const { error: invitesError } = await supabase.from('invitaciones').insert(invitaciones)
        if (invitesError) {
          console.warn('⚠️ [TEST 15] Error en invitaciones (no crítico):', invitesError)
          toast.success(`✅ Local creado (hubo un problema con las invitaciones)`)
        } else {
          console.log('✅ [TEST 16] Invitaciones creadas')
          toast.success(`✅ Local creado y ${formData.invites.length} invitación(es) enviada(s)`)
        }
      } else {
        toast.success('🏪 Local creado correctamente')
      }

      localStorage.setItem('activeLocalId', localData.id)
      localStorage.removeItem('onboarding_temp_data')
      
      // ✅ CAMBIO: Redirección a /caja en lugar de /dashboard
      setTimeout(() => {
        router.push('/caja') // ✅ ANTES ERA '/dashboard'
      }, 1500)

    } catch (err) {
      console.error('❌ [TEST 17] Excepción atrapada en handleOnboardingComplete:', err)
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
    // ✅ CAMBIO: Redirección a /caja en lugar de /dashboard
    router.push('/caja') // ✅ ANTES ERA '/dashboard'
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
          <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer hover:bg-gray-200">
            Salir
          </button>
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
                  {/* ✅ CAMBIO: Texto del botón actualizado */}
                  <button
                    onClick={() => handleSelectLocal(local.id)}
                    className="w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    → Ir a Caja {/* ✅ ANTES DECÍA 'Entrar al Dashboard' */}
                  </button>

                  {/* Solo el owner puede gestionar el equipo */}
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