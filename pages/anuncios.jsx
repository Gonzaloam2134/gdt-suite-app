import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'

export default function CentroAnuncios() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [anuncios, setAnuncios] = useState([])
  const [filtro, setFiltro] = useState('todos') // todos, no-leidos, leidos
  
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
        return
      }
      setUser(session.user)
      await cargarAnuncios(session.user.id)
    })
  }, [router])

  const cargarAnuncios = async (userId) => {
    try {
      setLoading(true)
      
      const { data: anunciosData } = await supabase
        .from('anuncios')
        .select('*')
        .eq('activo', true)
        .order('creado_en', { ascending: false })
      
      if (anunciosData) {
        // Obtener IDs de anuncios leídos
        const leidosKey = `anuncios_leidos_${userId}`
        const leidos = JSON.parse(localStorage.getItem(leidosKey) || '[]')
        
        // Marcar cada anuncio con su estado de lectura
        const anunciosConEstado = anunciosData.map(a => ({
          ...a,
          leido: leidos.includes(a.id),
          fechaLeido: null // Podríamos guardar esto en localStorage también si querés
        }))
        
        setAnuncios(anunciosConEstado)
      }
    } catch (err) {
      console.error('Error cargando anuncios:', err)
      toast.error('Error al cargar anuncios')
    } finally {
      setLoading(false)
    }
  }

  const marcarComoNoLeido = (anuncioId) => {
    if (!user) return
    
    const leidosKey = `anuncios_leidos_${user.id}`
    const leidos = JSON.parse(localStorage.getItem(leidosKey) || '[]')
    const nuevosLeidos = leidos.filter(id => id !== anuncioId)
    localStorage.setItem(leidosKey, JSON.stringify(nuevosLeidos))
    
    // Actualizar el estado local
    setAnuncios(anuncios.map(a => 
      a.id === anuncioId ? { ...a, leido: false } : a
    ))
    
    toast.success(' Anuncio marcado como no leído')
  }

  const marcarTodosComoLeidos = () => {
    if (!user) return
    
    const leidosKey = `anuncios_leidos_${user.id}`
    const todosIds = anuncios.map(a => a.id)
    localStorage.setItem(leidosKey, JSON.stringify(todosIds))
    
    setAnuncios(anuncios.map(a => ({ ...a, leido: true })))
    toast.success('✅ Todos los anuncios marcados como leídos')
  }

  const getIconoTipo = (tipo) => {
    const iconos = {
      warning: '⚠️',
      success: '✅',
      feature: '',
      urgent: '🚨',
      info: 'ℹ️'
    }
    return iconos[tipo] || 'ℹ️'
  }

  const getColorHeader = (tipo, leido) => {
    if (leido) return 'bg-gray-400'
    const colores = {
      warning: 'bg-amber-500',
      success: 'bg-green-500',
      feature: 'bg-purple-500',
      urgent: 'bg-red-500',
      info: 'bg-blue-500'
    }
    return colores[tipo] || 'bg-blue-500'
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-gray-600">Cargando anuncios...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    )
  }

  const anunciosFiltrados = anuncios.filter(a => {
    if (filtro === 'todos') return true
    if (filtro === 'no-leidos') return !a.leido
    if (filtro === 'leidos') return a.leido
    return true
  })

  const cantNoLeidos = anuncios.filter(a => !a.leido).length
  const cantLeidos = anuncios.filter(a => a.leido).length

  return (
    <main className="min-h-screen bg-slate-100 pb-8">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="m-0 text-lg font-bold text-gray-900">📢 Centro de Anuncios</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {cantNoLeidos > 0 
                ? `${cantNoLeidos} anuncio${cantNoLeidos > 1 ? 's' : ''} nuevo${cantNoLeidos > 1 ? 's' : ''}` 
                : 'Todos los anuncios leídos'}
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => router.push('/locales')} 
              className="px-3 py-1.5 bg-gray-100 text-gray-600 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200"
            >
              ← Volver
            </button>
            <button 
              onClick={handleSignOut} 
              className="px-3 py-1.5 bg-gray-100 text-gray-500 border-none rounded-md text-xs font-medium cursor-pointer hover:bg-gray-200"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        {/* Controles */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFiltro('todos')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none ${
                  filtro === 'todos' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                📋 Todos ({anuncios.length})
              </button>
              <button
                onClick={() => setFiltro('no-leidos')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none ${
                  filtro === 'no-leidos' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🔴 No leídos ({cantNoLeidos})
              </button>
              <button
                onClick={() => setFiltro('leidos')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none ${
                  filtro === 'leidos' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ✅ Leídos ({cantLeidos})
              </button>
            </div>

            {/* Acción masiva */}
            {cantNoLeidos > 0 && (
              <button
                onClick={marcarTodosComoLeidos}
                className="px-3 py-1.5 bg-green-500 text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-green-600"
              >
                ✅ Marcar todos como leídos
              </button>
            )}
          </div>
        </div>

        {/* Lista de anuncios */}
        {anunciosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">📭</div>
            <h3 className="m-0 mb-2 text-gray-900 text-base font-bold">
              {filtro === 'no-leidos' ? '¡No tenés anuncios nuevos!' : 
               filtro === 'leidos' ? 'No leíste ningún anuncio aún' : 
               'No hay anuncios publicados'}
            </h3>
            <p className="m-0 text-gray-500 text-sm">
              {filtro === 'no-leidos' ? 'Ya estás al día con todas las novedades.' : 'Los anuncios de la plataforma aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {anunciosFiltrados.map(anuncio => (
              <div 
                key={anuncio.id} 
                className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
                  anuncio.leido ? 'border-gray-200 opacity-75' : 'border-blue-300 shadow-md'
                }`}
              >
                {/* Header del anuncio */}
                <div className={`${getColorHeader(anuncio.tipo, anuncio.leido)} p-4 text-white`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="text-3xl">{getIconoTipo(anuncio.tipo)}</div>
                      <div className="flex-1">
                        <h3 className="m-0 text-base font-bold">{anuncio.titulo}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-white/80">
                            Publicado: {new Date(anuncio.creado_en).toLocaleDateString('es-AR', { 
                              day: '2-digit', month: 'long', year: 'numeric' 
                            })}
                          </span>
                          {anuncio.leido && (
                            <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-semibold">
                              ✅ Leído
                            </span>
                          )}
                          {!anuncio.leido && (
                            <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded text-xs font-bold animate-pulse">
                              🔴 NUEVO
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contenido */}
                <div className="p-4">
                  <p className="m-0 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {anuncio.mensaje}
                  </p>
                </div>

                {/* Footer con acciones */}
                <div className="px-4 pb-4 flex justify-end">
                  {!anuncio.leido ? (
                    <button
                      onClick={() => {
                        // Marcar como leído
                        const leidosKey = `anuncios_leidos_${user.id}`
                        const leidos = JSON.parse(localStorage.getItem(leidosKey) || '[]')
                        if (!leidos.includes(anuncio.id)) {
                          leidos.push(anuncio.id)
                          localStorage.setItem(leidosKey, JSON.stringify(leidos))
                        }
                        setAnuncios(anuncios.map(a => 
                          a.id === anuncio.id ? { ...a, leido: true } : a
                        ))
                        toast.success('✅ Anuncio marcado como leído')
                      }}
                      className="px-4 py-2 bg-blue-500 text-white border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-blue-600"
                    >
                      ✓ Marcar como leído
                    </button>
                  ) : (
                    <button
                      onClick={() => marcarComoNoLeido(anuncio.id)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-semibold cursor-pointer hover:bg-gray-200"
                    >
                      📌 Marcar como no leído
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
