import { formatHora } from '../../lib/format'

/** Franja que dice de un vistazo si la caja está abierta y desde cuándo. */
export default function EstadoCaja({ cajaAbierta, onAyuda }) {
  return (
    <div className={`border-b ${cajaAbierta ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <p className={`text-xs font-semibold m-0 flex items-center gap-2 ${cajaAbierta ? 'text-green-800' : 'text-amber-800'}`}>
          {cajaAbierta ? (
            <>
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Caja abierta desde las {formatHora(cajaAbierta.fecha_apertura)}
            </>
          ) : (
            <>Caja cerrada · abrila para empezar a registrar movimientos</>
          )}
        </p>
        <button onClick={onAyuda}
          className="text-xs font-semibold text-gray-600 bg-transparent border-none cursor-pointer hover:underline shrink-0">
          Ayuda
        </button>
      </div>
    </div>
  )
}
