import { useState } from 'react'
import { formatFecha } from '../../lib/format'

const PRESETS = [
  { id: 'este-mes', label: 'Este mes' },
  { id: 'mes-anterior', label: 'Mes anterior' },
  { id: 'ultimos-30', label: 'Últimos 30 días' },
  { id: 'trimestre', label: 'Trimestre' },
]

export default function FiltrosReporte({ locales, localId, onLocal, periodo, onPreset, onFechas }) {
  const [desde, setDesde] = useState(periodo.desde)
  const [hasta, setHasta] = useState(periodo.hasta)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {locales.length > 1 && (
        <div>
          <label htmlFor="r-local" className="block text-sm font-semibold text-gray-700 mb-2">Local</label>
          <select id="r-local" value={localId} onChange={(e) => onLocal(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="todos">Todos los locales (consolidado)</option>
            {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </div>
      )}

      <div>
        <span className="block text-sm font-semibold text-gray-700 mb-2">Período</span>
        <div className="flex gap-2 flex-wrap mb-3">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => onPreset(p.id)}
              className={`px-3 py-1.5 border-none rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                periodo.preset === p.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label htmlFor="r-desde" className="block text-xs text-gray-500 mb-1">Desde</label>
            <input id="r-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              className="p-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label htmlFor="r-hasta" className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input id="r-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              className="p-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <button onClick={() => onFechas(desde, hasta)}
            className="px-4 py-2 bg-blue-500 text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-600">
            Aplicar
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-500 m-0">
          Del {formatFecha(periodo.desde + 'T12:00:00')} al {formatFecha(periodo.hasta + 'T12:00:00')}
        </p>
      </div>
    </div>
  )
}
