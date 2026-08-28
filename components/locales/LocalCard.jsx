import { formatCurrency } from '../../lib/format'
import { LABEL_ROL } from '../../lib/constants/roles'

/** Tarjeta de un local con lo que pasó hoy. El dueño entra y ya sabe cómo viene el día. */
export default function LocalCard({ local, resumen, cajaAbierta, onEntrar, onAdmin, deshabilitado, motivo, diasRestantesPrueba, pruebaVencida }) {
  const r = resumen || { ventas: 0, gastos: 0, movimientos: 0 }
  const avisarPrueba = !deshabilitado && !pruebaVencida
    && diasRestantesPrueba !== null && diasRestantesPrueba !== undefined && diasRestantesPrueba <= 7

  return (
    <div className={`bg-white rounded-xl border-2 overflow-hidden transition-colors ${
      deshabilitado ? 'border-gray-200 opacity-70' : 'border-gray-200 hover:border-blue-300'}`}>
      <button onClick={deshabilitado ? undefined : onEntrar} disabled={deshabilitado}
        className="w-full text-left p-4 bg-transparent border-none cursor-pointer disabled:cursor-not-allowed">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 m-0 truncate">{local.nombre}</h3>
            <p className="text-xs text-gray-500 mt-0.5 m-0 truncate">
              {local.rubro || 'Sin rubro'}{local.rol && ` · ${LABEL_ROL[local.rol]}`}
            </p>
          </div>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${
            cajaAbierta ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {cajaAbierta ? 'Caja abierta' : 'Caja cerrada'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-green-50 rounded-lg">
            <div className="text-[10px] text-green-800 font-semibold uppercase">Cobros hoy</div>
            <div className="text-sm font-bold text-green-700 truncate">{formatCurrency(r.ventas)}</div>
          </div>
          <div className="p-2 bg-red-50 rounded-lg">
            <div className="text-[10px] text-red-800 font-semibold uppercase">Gastos</div>
            <div className="text-sm font-bold text-red-700 truncate">{formatCurrency(r.gastos)}</div>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <div className="text-[10px] text-gray-600 font-semibold uppercase">Movim.</div>
            <div className="text-sm font-bold text-gray-800">{r.movimientos}</div>
          </div>
        </div>

        {deshabilitado && motivo && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mt-3 m-0">{motivo}</p>
        )}
        {avisarPrueba && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mt-3 m-0">
            {diasRestantesPrueba <= 0
              ? 'Tu prueba vence hoy.'
              : `Prueba gratuita: te quedan ${diasRestantesPrueba} día${diasRestantesPrueba === 1 ? '' : 's'}.`}
          </p>
        )}
        {!deshabilitado && pruebaVencida && (
          <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded p-2 mt-3 m-0">
            Tu prueba terminó. Podés entrar a ver y descargar tus reportes. Escribinos para seguir usando la caja.
          </p>
        )}
      </button>

      {!deshabilitado && (
        <div className="flex border-t border-gray-100">
          <button onClick={onEntrar}
            className="flex-1 py-2.5 text-xs font-bold text-blue-700 bg-transparent border-none cursor-pointer hover:bg-blue-50">
            Ir a la caja
          </button>
          {onAdmin && (
            <button onClick={onAdmin}
              className="flex-1 py-2.5 text-xs font-semibold text-gray-600 bg-transparent border-none border-l border-gray-100 cursor-pointer hover:bg-gray-50">
              Administrar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
