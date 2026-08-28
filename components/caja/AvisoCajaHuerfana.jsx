import { formatFechaLarga } from '../../lib/format'

/** Banner de alerta: hay una caja de un día anterior que nunca se cerró. */
export default function AvisoCajaHuerfana({ fechaApertura, onResolver }) {
  return (
    <div className="bg-red-50 border-b border-red-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-red-800 m-0 flex items-center gap-2">
          <span aria-hidden="true">⚠️</span>
          Quedó sin cerrar la caja del {formatFechaLarga(fechaApertura)}. Cerrala antes de seguir.
        </p>
        <button onClick={onResolver}
          className="px-3 py-2 bg-red-600 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-red-700 shadow-sm shrink-0">
          Cerrar caja anterior
        </button>
      </div>
    </div>
  )
}
