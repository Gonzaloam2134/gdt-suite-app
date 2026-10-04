import { formatCurrency } from '../../lib/format'

const TONOS = {
  azul:      'text-gray-900',
  esmeralda: 'text-primary-700',
  ambar:     'text-warning-700',
}

/**
 * Chip tocable de "Dónde está la plata": muestra el número y, al tocarlo
 * (o con el mouse encima, se resalta), abre el detalle debajo del grupo.
 * El estado abierto lo maneja KpiCards para que haya un solo detalle a la vez.
 */
export default function KpiCard({ titulo, valor, tono = 'azul', abierto, onToggle, detalleId }) {
  return (
    <button onClick={onToggle} aria-expanded={abierto} aria-controls={detalleId}
      className={`press flex-1 min-w-0 text-left p-3 rounded-[16px] border cursor-pointer transition-colors ${
        abierto ? 'bg-primary-50 border-primary-500/30' : 'bg-white border-black/5 hover:bg-gray-50'}`}>
      <span className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide truncate">{titulo}</span>
      <span className={`block mt-0.5 text-base md:text-lg font-extrabold truncate ${TONOS[tono] ?? TONOS.azul}`}>{formatCurrency(valor)}</span>
    </button>
  )
}
