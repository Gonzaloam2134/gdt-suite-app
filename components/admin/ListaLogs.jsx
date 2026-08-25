import { formatFechaHora, formatCurrency } from '../../lib/format'
import { labelAccion } from '../../lib/constants/auditoria'
import EmptyState from '../ui/EmptyState'

export default function ListaLogs({ logs, limite, titulo = 'Actividad' }) {
  const visibles = limite ? logs.slice(0, limite) : logs

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200">
      <h2 className="m-0 mb-3 text-base font-bold text-gray-900">{titulo}</h2>
      {visibles.length === 0 ? (
        <EmptyState icono="📋" titulo="Sin actividad en este período" descripcion="Las acciones sobre la caja quedan registradas acá." />
      ) : (
        <div className="space-y-2">
          {visibles.map(log => {
            const a = labelAccion(log.accion)
            return (
              <div key={log.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-lg ${a.color}`}>{a.icono}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{a.texto}</div>
                  <div className="text-xs text-gray-500">{formatFechaHora(log.creado_en)}</div>
                  {log.detalles?.descripcion && <div className="text-xs text-gray-600 truncate">{log.detalles.descripcion}</div>}
                </div>
                {log.detalles?.monto != null && (
                  <div className="text-sm font-bold text-gray-700 shrink-0">{formatCurrency(log.detalles.monto)}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
