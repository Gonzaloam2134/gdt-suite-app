import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import OnboardingWizard from '../components/OnboardingWizard'

export default function Locales() {
  const [user, setUser] = useState(null)
  const [locales, setLocales] = useState([])
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [creating, setCreating] = useState(false)

  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        
        // 🚀 REDIRECCIÓN DIRECTA PARA SUPER ADMIN
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol_global')
          .eq('id', session.user.id)
          .single()

        if (perfil?.rol_global === 'super_user') {
          router.push('/admin')
          return
        }

        loadLocales()
      }
    })
  }, [router])

  useEffect(() => {
    if (!loading && locales.length === 0 && !showOnboarding) {
      setShowOnboarding(true)
    }
  }, [loading, locales, showOnboarding])

  const loadLocales = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('locales')
        .select('*')
        .order('creado_en', { ascending: false })

      if (error) throw error
      setLocales(data || [])
    } catch (err) {
      toast.error('Error al cargar locales: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOnboardingComplete = async (formData) => {
  try {
    setCreating(true)
    
    // 1. Crear el local con los datos del onboarding
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

    setLocales([localData, ...locales])
    setShowOnboarding(false)
    
    // 2. Si hay invitaciones, crearlas
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

      const { error: inviteError } = await supabase
        .from('invitaciones')
        .insert(invitaciones)

      if (inviteError) {
        console.error('Error creando invitaciones:', inviteError)
        toast.error('Local creado pero hubo un error con las invitaciones')
      } else {
        toast.success(`✅ Local creado y ${formData.invites.length} invitación(es) enviada(s)`)
      }
    } else {
      toast.success('🏪 Local creado correctamente')
    }
    
    // 3. Auto-seleccionar el local y redirigir
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
        <p className="text-gray-600 text-sm">Cargando...</p>
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
              {locales.length} {locales.length === 1 ? 'local registrado' : 'locales registrados'}
            </p>
          </div>
          <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer">Salir</button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        {locales.length === 0 ? (
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
            {locales.map(local => (
              <div key={local.id} className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center cursor-pointer hover:border-blue-300 transition-colors" onClick={() => handleSelectLocal(local.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">🏪</div>
                  <div>
                    <h3 className="m-0 text-base font-bold text-gray-900">{local.nombre}</h3>
                    <div className="flex gap-2 mt-1">
                      {local.rubro && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{local.rubro}</span>}
                      {local.condicion_fiscal && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{local.condicion_fiscal}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-blue-500 text-xl">→</div>
              </div>
            ))}
            <button onClick={() => setShowOnboarding(true)} className="w-full p-4 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-semibold cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
              + Agregar otro local
            </button>
          </div>
        )}
      </div>

      {showOnboarding && (
        <OnboardingWizard onComplete={handleOnboardingComplete} onCancel={() => setShowOnboarding(false)} userEmail={user?.email} />
      )}
    </main>
  )
}