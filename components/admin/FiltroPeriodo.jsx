import { useState } from 'react'
import { formatFecha } from '../../lib/format'

const PRESETS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Últimos 7 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mes-anterior', label: 'Mes anterior' },
]

/** Selector de período reutilizable (admin y reportes usaban dos copias distintas). */
export default function FiltroPeriodo({ periodo, onPreset, onFechas }) {
  const [desde, setDesde] = useState(periodo.desde)
  const [hasta, setHasta] = useState(periodo.hasta)
  const personalizado = periodo.preset === 'personalizado'

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200">
      <h3 className="text-sm font-bold text-gray-700 mb-3 m-0">Período</h3>
      <div className="flex gap-2 mb-3 flex-wrap">
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => onPreset(p.id)}
            className={`px-3 py-1.5 border-none rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              periodo.preset === p.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {p.label}
          </button>
        ))}
        <button onClick={() => onFechas(desde, hasta)}
          className={`px-3 py-1.5 border-none rounded-md text-xs font-semibold cursor-pointer transition-colors ${
            personalizado ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          Personalizado
        </button>
      </div>

      {personalizado && (
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label htmlFor="p-desde" className="block text-xs text-gray-500 mb-1">Desde</label>
            <input id="p-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              className="p-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label htmlFor="p-hasta" className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input id="p-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              className="p-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <button onClick={() => onFechas(desde, hasta)}
            className="px-4 py-2 bg-blue-500 text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-600">
            Aplicar
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500 m-0">
        Mostrando del {formatFecha(periodo.desde + 'T12:00:00')} al {formatFecha(periodo.hasta + 'T12:00:00')}
      </p>
    </div>
  )
}
