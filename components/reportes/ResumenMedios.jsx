import { formatCurrency } from '../../lib/format'
import { LABEL_TIPO_MEDIO } from '../../lib/constants/mediosPago'

/**
 * Contenido de "Cobros por medio de pago" — sin card propia, vive dentro
 * de un SeccionColapsable (pages/reportes.js) que ya da el título y el chrome.
 */
export default function ResumenMedios({ porMedio, totalFacturado }) {
  return (
    <div className="p-4">
      {porMedio.length === 0 ? (
        <p className="text-xs text-gray-500 m-0">Sin cobros en el período.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-200">
              <th className="py-1 text-left font-semibold">Medio</th>
              <th className="py-1 text-right font-semibold">Total</th>
              <th className="py-1 text-right font-semibold">Comisión</th>
              <th className="py-1 text-right font-semibold">Neto</th>
            </tr>
          </thead>
          <tbody>
            {porMedio.map(m => (
              <tr key={m.nombre} className="border-b border-gray-100">
                <td className="py-1.5">
                  <div className="font-semibold text-gray-900">{m.nombre}</div>
                  <div className="text-gray-400">
                    {LABEL_TIPO_MEDIO[m.tipo] || m.tipo} · {m.cantidad} ops
                    {totalFacturado > 0 && ` · ${Math.round((m.total / totalFacturado) * 100)}%`}
                  </div>
                </td>
                <td className="py-1.5 text-right text-gray-700">{formatCurrency(m.total)}</td>
                <td className="py-1.5 text-right text-red-600">{m.comisiones > 0 ? `-${formatCurrency(m.comisiones)}` : '—'}</td>
                <td className="py-1.5 text-right font-bold text-gray-900">{formatCurrency(m.neto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
