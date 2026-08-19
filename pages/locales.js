import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import OnboardingWizard from '../components/OnboardingWizard'
import RoleGate from '../components/RoleGate'
import ContactModal from '../components/ContactModal'

export default function Locales() {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [misLocales, setMisLocales] = useState([])
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [skipScaleStep, setSkipScaleStep] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [subEstado, setSubEstado] = useState('active')
  
  // NUEVO: Estado para anuncios
  const [anuncios, setAnuncios] = useState([])
  const [anuncioActual, setAnuncioActual] = useState(0)
  const [showAnuncioModal, setShowAnuncioModal] = useState(false)

  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
        setLoading(false)
        return
      }
      setUser(session.user)
      try {
        const { data: perfil } = await supabase.from('perfiles').select('rol_global').eq('id', session.user.id).maybeSingle()
        const rol = perfil?.rol_global || 'owner'
        setUserRole(rol)
        if (rol === 'super_user') { 
          router.push('/superadmin')
          setLoading(false)
          return 
        }
        await loadMisLocales(session.user.id, rol)
        await cargarAnuncios() // NUEVO: Cargar anuncios
      } catch (err) {
        console.error('Error al cargar datos:', err)
        toast.error('Error al cargar datos del usuario')
      } finally {
        setLoading(false)
      }
    }).catch(err => {
      console.error('Error de sesión:', err)
      setLoading(false)
    })
  }, [router])

  // NUEVO: Función para cargar anuncios
  const cargarAnuncios = async () => {
    try {
      const { data: anunciosData } = await supabase
        .from('anuncios')
        .select('*')
        .eq('activo', true)
        .order('creado_en', { ascending: false })
        .limit(5) // Mostrar máximo 5 anuncios
      
      if (anunciosData && anunciosData.length > 0) {
        setAnuncios(anunciosData)
        setAnuncioActual(0)
        setShowAnuncioModal(true)
      }
    } catch (err) {
      console.error('Error cargando anuncios:', err)
    }
  }

  const loadMisLocales = async (userId, currentRole) => {
    try {
      const { data: membresias } = await supabase.from('miembros_locales').select('local_id, rol').eq('user_id', userId).eq('activo', true)
      if (!membresias || membresias.length === 0) {
        setMisLocales([])
        if (currentRole !== 'cajero' && currentRole !== 'empleado') setShowOnboarding(true)
        return
      }
      const localIds = membresias.map(m => m.local_id)
      const { data: localesData } = await supabase.from('locales').select('id, nombre, rubro, condicion_fiscal').in('id', localIds)
      setMisLocales(localesData || [])

      // VERIFICAR SUSCRIPCIÓN DEL PRIMER LOCAL
      if (localesData && localesData.length > 0) {
        const localId = localesData[0].id
        const { data: subData } = await supabase
          .from('suscripciones')
          .select('estado')
          .eq('local_id', localId)
          .single()

        const estado = subData?.estado || 'active'
        setSubEstado(estado)
        localStorage.setItem('subEstado', estado)

        if (currentRole === 'owner') {
          if (estado === 'suspended') {
            toast.error('⛔ Tu cuenta está suspendida. Contactá a soporte para regularizar tu pago.')
          } else if (estado === 'restricted') {
            toast.warning('⚠️ Tu cuenta está restringida. Solo podés acceder a Reportes.')
          }
        }
      }

      if ((currentRole === 'cajero' || currentRole === 'empleado') && localesData && localesData.length > 0) {
        localStorage.setItem('activeLocalId', localesData[0].id)
        toast.success('Local seleccionado automáticamente')
        setTimeout(() => router.push('/dashboard'), 500)
        return
      }
    } catch (err) {
      toast.error('Error al cargar tus locales: ' + err.message)
    }
  }

  const handleOnboardingComplete = async (formData) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { toast.error('No hay sesión activa.'); router.push('/'); return }
    if (userRole === 'cajero' || userRole === 'empleado') { toast.error('⛔ No tenés permisos para crear locales.'); setShowOnboarding(false); return }

    try {
      const payload = { nombre: formData.businessName?.trim() || 'Negocio', rubro: formData.rubro || 'Otro', condicion_fiscal: formData.condicionFiscal || 'Consumidor Final', creado_por: session.user.id }
      const { data: localData, error: localError } = await supabase.from('locales').insert([payload]).select().single()
      if (localError) throw new Error(`Error en LOCALES: ${localError.message}`)

      await supabase.from('miembros_locales').insert([{ local_id: localData.id, user_id: session.user.id, rol: 'owner', activo: true, aceptado_en: new Date().toISOString() }])

      // Crear suscripción default para el nuevo local
      await supabase.from('suscripciones').insert([{
        local_id: localData.id,
        plan: 'free',
        estado: 'active',
        fecha_vencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }])

      if (formData.mediosPago && formData.mediosPago.length > 0) {
        const mediosAInsertar = formData.mediosPago.filter(m => m.habilitado).map((m, i) => ({
          local_id: localData.id, nombre: m.nombre, tipo: m.tipo, icono: m.icono,
          comision_porcentaje: m.comision, plazo_acreditacion_dias: m.plazo,
          habilitado: true, es_default: true, orden: i, creado_por: session.user.id
        }))
        if (mediosAInsertar.length > 0) await supabase.from('medios_pago').insert(mediosAInsertar)
      }

      toast.success('🏪 Local creado correctamente')
      localStorage.setItem('activeLocalId', localData.id)
      localStorage.setItem('subEstado', 'active')
      setSubEstado('active')
      localStorage.removeItem('onboarding_temp_data')
      
      await loadMisLocales(session.user.id, userRole)
      setShowOnboarding(false)
      setSkipScaleStep(false)
    } catch (err) {
      toast.error('Error al crear local: ' + err.message)
    }
  }

  const handleSelectLocal = (localId) => {
    if (userRole === 'cajero' || userRole === 'empleado') return
    
    if (subEstado === 'suspended') {
      toast.error('⛔ Local suspendido. Regularizá tu pago para acceder.')
      return
    }
    
    if (subEstado === 'restricted') {
      toast.warning('️ Acceso restringido. Redirigiendo a Reportes...')
      localStorage.setItem('activeLocalId', localId)
      setTimeout(() => router.push('/reportes'), 1000)
      return
    }

    localStorage.setItem('activeLocalId', localId)
    toast.success('Local seleccionado')
    router.push('/dashboard')
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const handleAddNewLocal = () => {
    setSkipScaleStep(true)
    setShowOnboarding(true)
  }

  // NUEVO: Navegación entre anuncios
  const handleSiguienteAnuncio = () => {
    if (anuncioActual < anuncios.length - 1) {
      setAnuncioActual(anuncioActual + 1)
    } else {
      setShowAnuncioModal(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-100"><p>Cargando...</p></div>

  return (
    <main className="min-h-screen bg-slate-100 pb-20">
      {/* MODAL DE ANUNCIOS */}
      {showAnuncioModal && anuncios.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header según tipo */}
            <div className={`p-5 text-white ${
              anuncios[anuncioActual].tipo === 'warning' ? 'bg-amber-500' :
              anuncios[anuncioActual].tipo === 'success' ? 'bg-green-500' :
              anuncios[anuncioActual].tipo === 'feature' ? 'bg-purple-500' :
              anuncios[anuncioActual].tipo === 'urgent' ? 'bg-red-500' :
              'bg-blue-500'
            }`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold m-0">
                  {anuncios[anuncioActual].tipo === 'warning' ? '⚠️' :
                   anuncios[anuncioActual].tipo === 'success' ? '✅' :
                   anuncios[anuncioActual].tipo === 'feature' ? '🚀' :
                   anuncios[anuncioActual].tipo === 'urgent' ? '🚨' : ''}{' '}
                  {anuncios[anuncioActual].titulo}
                </h2>
                <button
                  onClick={() => setShowAnuncioModal(false)}
                  className="text-white hover:text-gray-200 text-2xl font-bold cursor-pointer bg-none border-none"
                >
                  ×
                </button>
              </div>
              {anuncios.length > 1 && (
                <div className="text-xs text-white/80 mt-1">
                  Anuncio {anuncioActual + 1} de {anuncios.length}
                </div>
              )}
            </div>

            {/* Contenido */}
            <div className="p-6">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {anuncios[anuncioActual].mensaje}
              </p>
              <div className="text-xs text-gray-500 mt-4">
                Publicado: {new Date(anuncios[anuncioActual].creado_en).toLocaleDateString('es-AR')}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 bg-gray-50 border-t border-gray-200 flex gap-2">
              {anuncioActual < anuncios.length - 1 ? (
                <button
                  onClick={handleSiguienteAnuncio}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-blue-600"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  onClick={() => setShowAnuncioModal(false)}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-green-600"
                >
                  ✓ Entendido
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="m-0 text-lg font-bold text-gray-900">🏪 Mis Locales</h1>
            <p className="mt-0.5 text-xs text-gray-500">{misLocales.length} {misLocales.length === 1 ? 'local asignado' : 'locales asignados'}</p>
          </div>
          <div className="flex gap-2">
            <RoleGate allowedRoles={['owner', 'super_user']}>
              <button onClick={() => router.push('/reportes')} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-emerald-200">
                📊 Reportes
              </button>
            </RoleGate>
            <RoleGate allowedRoles={['owner', 'super_user']}>
              <button onClick={() => router.push('/admin')} className="px-3 py-1.5 bg-purple-100 text-purple-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-purple-200">
                ⚙️ Administración
              </button>
            </RoleGate>
            
            {userRole === 'super_user' && (
              <button 
                onClick={() => router.push('/superadmin')} 
                className="px-3 py-1.5 bg-red-100 text-red-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-red-200"
              >
                👑 Super Admin
              </button>
            )}
            
            <button 
              onClick={() => setShowContactModal(true)} 
              className="px-3 py-1.5 bg-blue-100 text-blue-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-200"
            >
              💬 Ayuda
            </button>
            
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 text-gray-500 border-none rounded-md text-xs font-medium cursor-pointer hover:bg-gray-200">
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* BANNERS DE SUSCRIPCIÓN */}
      {userRole === 'owner' && (
        <>
          {subEstado === 'suspended' && (
            <div className="max-w-2xl mx-auto p-4">
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 text-center">
                <div className="text-4xl mb-3">🚫</div>
                <h3 className="text-lg font-bold text-red-900 mb-2">Acceso Suspendido</h3>
                <p className="text-sm text-red-700 mb-4">
                  Tu suscripción está vencida o suspendida. No podés acceder a la Caja ni a la Administración hasta regularizar tu pago.
                </p>
                <button 
                  onClick={() => setShowContactModal(true)}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-red-700"
                >
                   Contactar a Soporte para Pagar
                </button>
              </div>
            </div>
          )}

          {subEstado === 'restricted' && (
            <div className="max-w-2xl mx-auto p-4">
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 text-center">
                <div className="text-4xl mb-3">⚠️</div>
                <h3 className="text-lg font-bold text-amber-900 mb-2">Modo Solo Lectura</h3>
                <p className="text-sm text-amber-800 mb-4">
                  Tu cuenta está restringida. Podés ver tus <strong>Reportes</strong> históricos, pero no podés registrar nuevas ventas ni cambiar configuraciones.
                </p>
                <div className="flex justify-center gap-3">
                  <button 
                    onClick={() => router.push('/reportes')}
                    className="px-6 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-amber-700"
                  >
                    📊 Ir a mis Reportes
                  </button>
                  <button 
                    onClick={() => setShowContactModal(true)}
                    className="px-6 py-2 bg-white border border-amber-600 text-amber-700 rounded-lg text-sm font-bold cursor-pointer hover:bg-amber-50"
                  >
                    💬 Regularizar Pago
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="max-w-2xl mx-auto p-4">
        {misLocales.length === 0 && (userRole === 'cajero' || userRole === 'empleado') ? (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-amber-300">
            <div className="text-5xl mb-3"></div>
            <h3 className="m-0 mb-2 text-gray-900 text-base font-bold">Esperando asignación</h3>
            <p className="m-0 mb-6 text-gray-500 text-sm">Tu cuenta ha sido creada, pero el dueño aún no te ha asignado a un local.</p>
            <button onClick={handleSignOut} className="px-6 py-3 bg-gray-200 text-gray-700 border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-300">Volver al inicio</button>
          </div>
        ) : misLocales.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
            <div className="text-5xl mb-3">🏪</div>
            <h3 className="m-0 mb-2 text-gray-900 text-base font-bold">Sin locales registrados</h3>
            <p className="m-0 mb-4 text-gray-500 text-sm">Creá tu primer local para empezar a operar</p>
            <button onClick={() => setShowOnboarding(true)} className="px-6 py-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">+ Crear mi primer local</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {misLocales.map((local) => (
              <div key={local.id} className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-lg transition-all">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-3xl shadow-sm">🏪</div>
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
                    disabled={subEstado === 'suspended' || subEstado === 'restricted'}
                    className={`w-full p-3 border-none rounded-lg text-sm font-bold cursor-pointer transition-colors ${
                      subEstado === 'suspended' || subEstado === 'restricted'
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {subEstado === 'suspended' ? '🚫 Acceso Suspendido' : subEstado === 'restricted' ? '⚠️ Solo Reportes' : '→ Ir a Caja'}
                  </button>
                  {userRole === 'owner' && subEstado === 'active' && (
                    <button onClick={() => { localStorage.setItem('activeLocalId', local.id); router.push('/admin?tab=medios-pago') }} className="w-full p-3 bg-purple-50 text-purple-700 border-2 border-purple-200 rounded-lg text-sm font-semibold cursor-pointer hover:bg-purple-100">💳 Gestionar Medios de Pago</button>
                  )}
                </div>
              </div>
            ))}
            {userRole === 'owner' && subEstado === 'active' && (
              <button onClick={handleAddNewLocal} className="w-full p-4 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-semibold cursor-pointer hover:border-blue-400 hover:text-blue-500">+ Agregar otro local</button>
            )}
          </div>
        )}
      </div>
      {showOnboarding && (
        <OnboardingWizard 
          onComplete={handleOnboardingComplete} 
          onCancel={() => { setShowOnboarding(false); setSkipScaleStep(false); localStorage.removeItem('onboarding_temp_data') }} 
          userEmail={user?.email} 
          preloadedData={JSON.parse(localStorage.getItem('onboarding_temp_data') || 'null')}
          skipScaleStep={skipScaleStep}
        />
      )}

      <ContactModal 
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        user={user}
        localId={misLocales[0]?.id || null}
        paginaOrigen="Mis Locales"
      />
    </main>
  )
}
// Force new build
