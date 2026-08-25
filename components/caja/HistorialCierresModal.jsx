import Modal from '../ui/Modal'
import EmptyState from '../ui/EmptyState'
import { formatCurrency, formatFechaHora } from '../../lib/format'

export default function HistorialCierresModal({ isOpen, onClose, cierres, nombreLocal }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📋 Historial de cierres" subtitle={nombreLocal} size="xl"
      headerClassName="bg-indigo-600 text-white">
      {cierres.length === 0 ? (
        <EmptyState titulo="Todavía no hay cierres" descripcion="Cuando cierres la caja, el detalle queda acá." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <th className="p-2 text-left font-bold">Fecha</th>
                <th className="p-2 text-right font-bold">Inicial</th>
                <th className="p-2 text-right font-bold">Cobros</th>
                <th className="p-2 text-right font-bold">Gastos</th>
                <th className="p-2 text-right font-bold">Contado</th>
                <th className="p-2 text-right font-bold">Diferencia</th>
                <th className="p-2 text-left font-bold">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {cierres.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-2 text-gray-900 whitespace-nowrap">{formatFechaHora(c.fecha_cierre)}</td>
                  <td className="p-2 text-right text-gray-700">{formatCurrency(c.monto_inicial_efectivo)}</td>
                  <td className="p-2 text-right text-green-700 font-semibold">{formatCurrency(c.total_cobrado)}</td>
                  <td className="p-2 text-right text-red-700 font-semibold">-{formatCurrency(c.total_gastado)}</td>
                  <td className="p-2 text-right text-gray-900">{c.efectivo_fisico != null ? formatCurrency(c.efectivo_fisico) : '-'}</td>
                  <td className={`p-2 text-right font-bold ${
                    c.diferencia_efectivo === 0 ? 'text-green-700' : c.diferencia_efectivo > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {c.diferencia_efectivo != null ? formatCurrency(c.diferencia_efectivo) : '-'}
                  </td>
                  <td className="p-2 text-gray-600 max-w-[150px] truncate" title={c.observaciones || ''}>{c.observaciones || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
