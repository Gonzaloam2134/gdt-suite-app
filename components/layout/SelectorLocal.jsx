import { useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { useUserRole } from '../../lib/UserRoleContext'
import { useClickOutside } from '../../hooks/useClickOutside'

/**
 * Cambia el local activo desde cualquier pantalla.
 * "Todos los locales" solo aparece donde el consolidado significa algo (reportes):
 * una caja o un panel de miembros son siempre de un local puntual.
 */
export default function SelectorLocal({ locales, localId, onCambiar, permiteTodos = false }) {
  const router = useRouter()
  const { cambiarLocal } = useUserRole()
  const [abierto, setAbierto] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setAbierto(false), abierto)

  if (!locales?.length) return null

  const actual = localId === 'todos'
    ? { nombre: 'Todos los locales' }
    : locales.find(l => l.id === localId)

  const elegir = async (id) => {
    setAbierto(false)
    if (id === localId) return
    // En reportes el consolidado se maneja en la página; en el resto cambia el local activo
    if (onCambiar) { onCambiar(id); return }
    setCambiando(true)
    try { await cambiarLocal(id) } finally { setCambiando(false) }
  }

  // Con un solo local y sin consolidado, un desplegable sería ruido
  if (locales.length === 1 && !permiteTodos) {
    return <span className="text-sm font-semibold text-gray-900 truncate">{actual?.nombre}</span>
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setAbierto(o => !o)} aria-expanded={abierto} aria-haspopup="listbox" disabled={cambiando}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 border-none rounded-lg cursor-pointer max-w-[190px] md:max-w-[260px] disabled:opacity-60">
        <span className="text-sm font-semibold text-gray-900 truncate">
          {cambiando ? 'Cambiando…' : (actual?.nombre || 'Elegir local')}
        </span>
        <span className="text-gray-400 text-xs shrink-0">▾</span>
      </button>

      {abierto && (
        <div role="listbox" className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 max-h-80 overflow-y-auto">
          {permiteTodos && (
            <button role="option" aria-selected={localId === 'todos'} onClick={() => elegir('todos')}
              className={`w-full px-4 py-2.5 text-left text-sm bg-transparent border-none cursor-pointer hover:bg-gray-50 ${
                localId === 'todos' ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
              Todos los locales
              <span className="block text-xs text-gray-400 font-normal">Consolidado</span>
            </button>
          )}
          {locales.map(l => (
            <button key={l.id} role="option" aria-selected={localId === l.id} onClick={() => elegir(l.id)}
              className={`w-full px-4 py-2.5 text-left text-sm bg-transparent border-none cursor-pointer hover:bg-gray-50 truncate ${
                localId === l.id ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
              {l.nombre}
              {l.rubro && <span className="block text-xs text-gray-400 font-normal truncate">{l.rubro}</span>}
            </button>
          ))}
          <hr className="my-1 border-gray-200" />
          <button onClick={() => { setAbierto(false); router.push('/locales') }}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-600 bg-transparent border-none cursor-pointer hover:bg-gray-50">
            Ver todos mis locales
          </button>
        </div>
      )}
    </div>
  )
}
