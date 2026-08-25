import { formatCurrency, formatHora } from '../../lib/format'
import { usePaginacion } from '../../hooks/usePaginacion'
import SeccionColapsable from '../ui/SeccionColapsable'

/** Cobros con tarjeta/QR que se acreditan hoy, con su comisión y neto. */
export default function AcreditacionesDelDia({ acreditaciones }) {
  const paginacion = usePaginacion(acreditaciones, 15)
  if (acreditaciones.length === 0) return null

  return (
    <SeccionColapsable titulo="✅ Acreditaciones del día" badge={acreditaciones.length} paginacion={paginacion}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <th className="p-2 text-left font-bold">Hora</th>
              <th className="p-2 text-left font-bold">Medio</th>
              <th className="p-2 text-left font-bold hidden md:table-cell">Descripción</th>
              <th className="p-2 text-right font-bold">Bruto</th>
              <th className="p-2 text-right font-bold">Comisión</th>
              <th className="p-2 text-right font-bold">Neto</th>
            </tr>
          </thead>
          <tbody>
            {paginacion.visibles.map((a) => (
              <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-2 text-gray-900">{formatHora(a.creado_en)}</td>
                <td className="p-2 text-gray-700">{a.medios_pago?.nombre || '-'}</td>
                <td className="p-2 text-gray-700 hidden md:table-cell">{a.descripcion || 'Sin descripción'}</td>
                <td className="p-2 text-right text-gray-500">{formatCurrency(a.monto)}</td>
                <td className="p-2 text-right text-red-600">-{formatCurrency(a.comision)}</td>
                <td className="p-2 text-right font-bold text-emerald-700 bg-emerald-50">{formatCurrency(a.neto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SeccionColapsable>
  )
}
