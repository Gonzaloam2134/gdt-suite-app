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
    // Verificar si hay datos temporales del registro
    const tempData = localStorage.getItem('onboarding_temp_data')
    if (tempData) {
      const parsed = JSON.parse(tempData)
      // Precargar el nombre del negocio en el onboarding
      // Esto lo manejaremos pasando props al OnboardingWizard
    }

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

        if (perfilError) {
          console.error('Error al obtener perfil:', perfilError)
        }

        const rol = perfil?.rol_global || 'owner'
        console.log('🔍 [Locales] Rol detectado:', rol)
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
    console.log('🔍 [loadMisLocales] Iniciando para userId:', userId, 'rol:', currentRole)
    try {
      // PASO 1: Obtener solo los IDs de los locales a los que pertenece el usuario
      const { data: membresias, error: errorMembresia } = await supabase
        .from('miembros_locales')
        .select('local_id, rol')
        .eq('user_id', userId)
        .eq('activo', true)

      if (errorMembresia) {
        console.error('❌ [loadMisLocales] Error al obtener membresías:', errorMembresia)
        throw errorMembresia
      }

      console.log('🔍 [loadMisLocales] Membresías encontradas:', membresias)

      // Si no tiene membresías
      if (!membresias || membresias.length === 0) {
        setMisLocales([])

        // BUG CRÍTICO CORREGIDO: Solo mostramos onboarding si NO es cajero ni empleado
        if (currentRole !== 'cajero' && currentRole !== 'empleado') {
          console.log('✅ [loadMisLocales] Es owner sin locales. Mostrando onboarding.')
          setShowOnboarding(true)
        } else {
          console.log('✅ [loadMisLocales] Es cajero/empleado sin locales. Mostrando espera.')
          // No hacemos nada, el JSX de abajo se encargará de mostrar "Esperando asignación"
        }
        return
      }

      // PASO 2: Extraer los IDs y consultar la tabla de locales directamente
      const localIds = membresias.map(m => m.local_id)

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

      // BUG CRÍTICO CORREGIDO: Si es cajero o empleado y YA tiene un local asignado,
      // redirigirlo automáticamente al dashboard de ese local
      if ((currentRole === 'cajero' || currentRole === 'empleado') && localesData && localesData.length > 0) {
        console.log('🚀 [loadMisLocales] Cajero/Empleado con local asignado. Redirigiendo automáticamente...')
        const primerLocalId = localesData[0].id
        localStorage.setItem('activeLocalId', primerLocalId)
        toast.success('Local seleccionado automáticamente')
        setTimeout(() => {
          router.push('/dashboard')
        }, 500)
        return
      }

    } catch (err) {
      console.error('❌ [loadMisLocales] Error detallado:', err)
      toast.error('Error al cargar tus locales: ' + err.message)
    }
  }

      const handleOnboardingComplete = async (formData) => {
  // ✅ NUEVA VALIDACIÓN: Evitar duplicación
  if (misLocales && misLocales.length > 0) {
    console.warn('⚠️ El usuario ya tiene al menos un local');
    toast.error('Ya tenés un local registrado. No se pueden crear múltiples locales en esta versión.');
    setShowOnboarding(false);
    return;
  }


    try {
      setCreating(true)
      
      const payload = {
        nombre: formData.businessName?.trim() || 'Negocio Sin Nombre',
        rubro: formData.rubro || 'Otro',
        condicion_fiscal: formData.condicionFiscal || 'Consumidor Final',
        creado_por: session?.user?.id
      };
      
      console.log('🔍 [DEBUG 4] Payload:', payload);
      
      // PASO A: Insertar en locales
      console.log('🔍 [DEBUG 5] Intentando INSERT en tabla LOCALES...');
      const { data: localData, error: localError } = await supabase
        .from('locales')
        .insert([payload])
        .select()
        .single();

      if (localError) {
        console.error('❌ [DEBUG 6] FALLÓ INSERT EN LOCALES:', localError);
        throw new Error(`Error en tabla LOCALES: ${localError.message}`);
      }
      
      console.log('✅ [DEBUG 7] Local creado:', localData.id);
      
      // PASO B: Insertar en miembros_locales
      console.log('🔍 [DEBUG 8] Intentando INSERT en tabla MIEMBROS_LOCALES...');
      const { error: miembroError } = await supabase
        .from('miembros_locales')
        .insert([{
          local_id: localData.id,
          user_id: session?.user?.id,
          rol: 'owner',
          activo: true,
          aceptado_en: new Date().toISOString()
        }]);

      if (miembroError) {
        console.error('❌ [DEBUG 9] FALLÓ INSERT EN MIEMBROS_LOCALES:', miembroError);
        throw new Error(`Error en tabla MIEMBROS_LOCALES: ${miembroError.message}`);
      }
      
      console.log('✅ [DEBUG 10] Miembro creado correctamente');

      // PASO C: Insertar invitaciones (si hay)
      if (formData.invites && formData.invites.length > 0) {
        console.log(' [DEBUG 11] Intentando INSERT en tabla INVITACIONES...');
        const invitaciones = formData.invites.map(inv => ({
          email_invitado: inv.email,
          local_id: localData.id,
          rol: inv.rol,
          invitado_por: session?.user?.id,
          token: crypto.randomUUID(),
          expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          estado: 'pendiente'
        }));

        const { error: invitesError } = await supabase.from('invitaciones').insert(invitaciones);
        if (invitesError) {
          console.error('❌ [DEBUG 12] FALLÓ INSERT EN INVITACIONES:', invitesError);
          toast.success(`✅ Local creado (error en invitaciones: ${invitesError.message})`);
        } else {
          console.log('✅ [DEBUG 13] Invitaciones creadas');
          toast.success(`✅ Local creado y ${formData.invites.length} invitación(es) enviada(s)`);
        }
      } else {
        toast.success('🏪 Local creado correctamente');
      }

      localStorage.setItem('activeLocalId', localData.id);
      localStorage.removeItem('onboarding_temp_data');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (err) {
      console.error('❌ [DEBUG 14] Error final:', err);
      toast.error('Error al crear local: ' + err.message);
    } finally {
      setCreating(false);
    }
  }
  const handleSelectLocal = (localId) => {
    // Validación adicional: solo owners pueden seleccionar manualmente
    if (userRole === 'cajero' || userRole === 'empleado') {
      toast.error('⛔ Los cajeros y empleados son redirigidos automáticamente')
      return
    }

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
                  <button
                    onClick={() => handleSelectLocal(local.id)}
                    className="w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    → Entrar al Dashboard
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