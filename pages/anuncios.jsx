import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useAnuncios } from '../hooks/useAnuncios'
import { useMisLocales } from '../hooks/useMisLocales'
import LoadingScreen from '../components/ui/LoadingScreen'
import AppHeader from '../components/layout/AppHeader'
import BottomNav from '../components/layout/BottomNav'
import Button from '../components/ui/Button'
import Icono, { iconoDeAnuncio } from '../components/ui/Icono'
import EmptyState from '../components/ui/EmptyState'

// Color del ícono según el tipo de aviso (semántico: atención = ámbar, urgente = rojo)
const TONO = {
  warning: 'bg-warning-50 text-warning-700',
  urgent: 'bg-danger-50 text-danger-700',
  success: 'bg-primary-50 text-primary-700',
  feature: 'bg-primary-50 text-primary-700',
  info: 'bg-gray-100 text-gray-600',
}

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'no-leidos', label: 'No leídos' },
  { id: 'leidos', label: 'Leídos' },
]

/** Novedades de la plataforma (antes "Centro de Anuncios"). */
export default function CentroAnuncios() {
  const { user, checking } = useAuthGuard()
  const { todos: anuncios, cargado, marcarComoLeidos, marcarComoNoLeido } = useAnuncios(user?.id)
  const { locales } = useMisLocales(user?.id)
  const [filtro, setFiltro] = useState('todos')

  if (checking || !cargado || !user) return <LoadingScreen mensaje="Cargando novedades…" icono="novedades" />

  const handleNoLeido = async (anuncioId) => {
    await marcarComoNoLeido(anuncioId)
    toast.success('Marcado como no leído')
  }

  const marcarTodos = async () => {
    const pendientes = anuncios.filter(a => !a.leido).map(a => a.id)
    if (pendientes.length === 0) return
    await marcarComoLeidos(pendientes)
    toast.success('Todo marcado como leído')
  }

  const cantNoLeidos = anuncios.filter(a => !a.leido).length
  const cantidad = { todos: anuncios.length, 'no-leidos': cantNoLeidos, leidos: anuncios.length - cantNoLeidos }
  const visibles = anuncios.filter(a => filtro === 'todos' || (filtro === 'no-leidos' ? !a.leido : a.leido))

  return (
    <main className="min-h-screen bg-fondo pb-24 md:pb-10 md:pl-56">
      <AppHeader sinLocal titulo="Novedades" />

      <div className="max-w-3xl mx-auto p-3 md:p-4 space-y-4">
        <div className="bg-white rounded-[20px] border border-black/5 shadow-suave p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex gap-2 flex-wrap">
            {FILTROS.map(f => (
              <button key={f.id} onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}
                className={`press px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer border-none ${
                  filtro === f.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f.label} ({cantidad[f.id]})
              </button>
            ))}
          </div>
          {cantNoLeidos > 0 && (
            <Button variant="secondary" size="sm" onClick={marcarTodos} className="!rounded-[12px]">Marcar todo como leído</Button>
          )}
        </div>

        {visibles.length === 0 ? (
          <div className="bg-white rounded-[20px] border border-black/5 shadow-suave">
            <EmptyState icono="vacio"
              titulo={filtro === 'no-leidos' ? 'No tenés novedades nuevas' : filtro === 'leidos' ? 'Todavía no leíste ninguna novedad' : 'No hay novedades publicadas'}
              descripcion={filtro === 'no-leidos' ? 'Ya estás al día.' : 'Las novedades de GDT Suite van a aparecer acá.'} />
          </div>
        ) : (
          <div className="space-y-3">
            {visibles.map(anuncio => (
              <article key={anuncio.id}
                className={`bg-white rounded-[20px] border shadow-suave overflow-hidden transition-colors ${
                  anuncio.leido ? 'border-black/5 opacity-80' : 'border-primary-500/40'}`}>
                <div className="p-4 flex items-start gap-3">
                  <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${anuncio.leido ? 'bg-gray-100 text-gray-400' : (TONO[anuncio.tipo] || TONO.info)}`}>
                    <Icono nombre={iconoDeAnuncio(anuncio.tipo)} size={22} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="m-0 text-base font-bold text-gray-900">{anuncio.titulo}</h3>
                      {!anuncio.leido && (
                        <span className="shrink-0 px-2 py-0.5 bg-primary-600 text-white rounded-full text-[11px] font-bold">Nuevo</span>
                      )}
                    </div>
                    <p className="m-0 mt-0.5 text-xs text-gray-500">
                      {new Date(anuncio.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="m-0 mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{anuncio.mensaje}</p>
                  </div>
                </div>

                <div className="px-4 pb-4 flex justify-end">
                  {!anuncio.leido ? (
                    <Button size="sm" onClick={async () => { await marcarComoLeidos([anuncio.id]); toast.success('Marcado como leído') }} className="!rounded-[12px]">
                      Marcar como leído
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleNoLeido(anuncio.id)} className="!rounded-[12px]">
                      Marcar como no leído
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <BottomNav activeTab="anuncios" lateral cantidadLocales={locales.length} />
    </main>
  )
}
