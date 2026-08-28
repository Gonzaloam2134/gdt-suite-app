import { formatCurrency } from '../../lib/format'
import SeccionColapsable from '../ui/SeccionColapsable'
import { LABEL_TIPO_MEDIO } from '../../lib/constants/mediosPago'

export default function DesgloseMedios({ medios }) {
  if (medios.length === 0) return null

  return (
    <SeccionColapsable titulo="💳 Desglose por medio de pago" badge={medios.length}>
      <div className="md:hidden divide-y divide-gray-100">
        {medios.map((m) => (
          <div key={m.nombre} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 text-sm truncate">{m.nombre}</div>
              <div className="text-xs text-gray-500">{LABEL_TIPO_MEDIO[m.tipo] || m.tipo} · {m.cantidad} operaciones</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-gray-900">{formatCurrency(m.total)}</div>
              {m.comisiones > 0 && <div className="text-xs text-red-600">-{formatCurrency(m.comisiones)} comisión</div>}
              <div className="text-xs text-green-700 font-semibold">Neto {formatCurrency(m.total - m.comisiones)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <th className="p-2 text-left font-bold">Medio</th>
              <th className="p-2 text-right font-bold">Cant.</th>
              <th className="p-2 text-right font-bold">Total</th>
              <th className="p-2 text-right font-bold">Comisiones</th>
              <th className="p-2 text-right font-bold">Neto</th>
            </tr>
          </thead>
          <tbody>
            {medios.map((m) => (
              <tr key={m.nombre} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-2">
                  <div className="font-semibold text-gray-900">{m.nombre}</div>
                  <div className="text-xs text-gray-500">{LABEL_TIPO_MEDIO[m.tipo] || m.tipo}</div>
                </td>
                <td className="p-2 text-right text-gray-700">{m.cantidad}</td>
                <td className="p-2 text-right font-semibold text-gray-900">{formatCurrency(m.total)}</td>
                <td className="p-2 text-right text-red-600">-{formatCurrency(m.comisiones)}</td>
                <td className="p-2 text-right font-bold text-green-700">{formatCurrency(m.total - m.comisiones)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SeccionColapsable>
  )
}
