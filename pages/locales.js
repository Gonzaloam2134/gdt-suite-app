import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'

export default function Locales() {
  const [user, setUser] = useState(null)
  const [locales, setLocales] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newLocalName, setNewLocalName] = useState('')
  const [creating, setCreating] = useState(false)
  const [rubro, setRubro] = useState('')
  const [condicionFiscal, setCondicionFiscal] = useState('')

  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        loadLocales()
      }
    })
  }, [router])

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

  const handleCreateLocal = async (e) => {
    e.preventDefault()
    if (!newLocalName.trim()) {
      toast.error('Ingresá un nombre para el local')
      return
    }

    try {
      setCreating(true)
      const { data, error } = await supabase
        .from('locales')
        .insert([{
          nombre: newLocalName.trim(),
          rubro: rubro || null,
          condicion_fiscal: condicionFiscal || null,
          creado_por: user.id,
          activo: true
        }])
        .select()
        .single()

      if (error) throw error

      toast.success('🏪 Local creado correctamente')
      setLocales([data, ...locales])
      setNewLocalName('')
      setRubro('')
      setCondicionFiscal('')
      setShowCreate(false)
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
          <div className="text-4xl mb-2"></div>
          <p className="text-gray-600 text-sm">Cargando locales...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-20">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="m-0 text-lg font-bold text-gray-900">🏪 Mis Locales</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {locales.length} {locales.length === 1 ? 'local registrado' : 'locales registrados'}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        {/* LISTA DE LOCALES */}
        {locales.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
            <div className="text-5xl mb-3">🏪</div>
            <h3 className="m-0 mb-2 text-gray-900 text-base font-bold">Sin locales registrados</h3>
            <p className="m-0 mb-4 text-gray-500 text-sm">
              Creá tu primer local para empezar a operar
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer"
            >
              + Crear mi primer local
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {locales.map(local => (
              <div
                key={local.id}
                className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => handleSelectLocal(local.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                    🏪
                  </div>
                  <div>
                    <h3 className="m-0 text-base font-bold text-gray-900">{local.nombre}</h3>
                    <div className="flex gap-2 mt-1">
                      {local.rubro && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {local.rubro}
                        </span>
                      )}
                      {local.condicion_fiscal && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {local.condicion_fiscal}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-blue-500 text-xl">→</div>
              </div>
            ))}

            {/* BOTÓN CREAR NUEVO */}
            <button
              onClick={() => setShowCreate(true)}
              className="w-full p-4 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-semibold cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              + Agregar otro local
            </button>
          </div>
        )}
      </div>

      {/* MODAL CREAR LOCAL */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="m-0 text-xl font-bold text-gray-900">🏪 Nuevo Local</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="bg-none border-none text-xl cursor-pointer text-gray-500"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLocal}>
              <div className="mb-4">
                <label className="block mb-2 font-semibold text-gray-700 text-sm">
                  Nombre del local *
                </label>
                <input
                  type="text"
                  value={newLocalName}
                  onChange={e => setNewLocalName(e.target.value)}
                  placeholder="Ej: Local Centro, Sucursal Norte..."
                  required
                  autoFocus
                  className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border"
                />
              </div>

              <div className="mb-4">
                <label className="block mb-2 font-semibold text-gray-700 text-sm">
                  Rubro (opcional)
                </label>
                <select
                  value={rubro}
                  onChange={e => setRubro(e.target.value)}
                  className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border bg-white"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Gastronomía">Gastronomía</option>
                  <option value="Retail">Retail</option>
                  <option value="Servicios">Servicios</option>
                  <option value="Salud">Salud</option>
                  <option value="Educación">Educación</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block mb-2 font-semibold text-gray-700 text-sm">
                  Condición fiscal (opcional)
                </label>
                <select
                  value={condicionFiscal}
                  onChange={e => setCondicionFiscal(e.target.value)}
                  className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border bg-white"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Monotributo">Monotributo</option>
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Exento">Exento</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full p-4 bg-blue-500 text-white border-none rounded-lg text-base font-bold cursor-pointer disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Crear Local'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}