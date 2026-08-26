import { formatCurrency, formatFecha } from '../../lib/format'
import { LABEL_TIPO_MEDIO } from '../../lib/constants/mediosPago'

export default function MediosYConciliacion({ porMedio, conciliacion, cierres, totalFacturado }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-bold text-gray-900 m-0 mb-3 text-base">Cobros por medio de pago</h2>
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
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-bold text-gray-900 m-0 mb-3 text-base">Conciliación de caja</h2>
        {conciliacion.cierres === 0 ? (
          <p className="text-xs text-gray-500 m-0">No hay cierres de caja registrados en el período.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
              <div className="p-2 bg-gray-50 rounded"><span className="text-gray-500">Cierres</span><div className="font-bold text-gray-900">{conciliacion.cierres}</div></div>
              <div className="p-2 bg-green-50 rounded"><span className="text-gray-500">Cuadraron</span><div className="font-bold text-green-700">{conciliacion.cuadrados}</div></div>
              <div className="p-2 bg-red-50 rounded"><span className="text-gray-500">Con faltante</span><div className="font-bold text-red-700">{conciliacion.diasFaltante}</div></div>
              <div className="p-2 bg-blue-50 rounded"><span className="text-gray-500">Con sobrante</span><div className="font-bold text-blue-700">{conciliacion.diasSobrante}</div></div>
            </div>
            <div className="flex justify-between items-baseline py-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Diferencia acumulada</span>
              <span className={`font-bold ${conciliacion.totalDiferencia < 0 ? 'text-red-700' : conciliacion.totalDiferencia > 0 ? 'text-blue-700' : 'text-green-700'}`}>
                {formatCurrency(conciliacion.totalDiferencia)}
              </span>
            </div>
            {conciliacion.sinContar > 0 && (
              <p className="text-xs text-amber-700 m-0 mt-2">
                {conciliacion.sinContar} cierres se hicieron sin contar el efectivo, así que no se pueden conciliar.
              </p>
            )}
            {cierres.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs font-semibold text-gray-600 cursor-pointer">Ver detalle por día</summary>
                <table className="w-full text-xs mt-2">
                  <tbody>
                    {cierres.map(c => (
                      <tr key={c.id} className="border-b border-gray-100">
                        <td className="py-1 text-gray-700">{formatFecha(c.fecha_cierre)}</td>
                        <td className="py-1 text-right text-gray-500">{c.efectivo_fisico == null ? 'sin contar' : formatCurrency(c.efectivo_fisico)}</td>
                        <td className={`py-1 text-right font-semibold ${
                          c.diferencia_efectivo == null ? 'text-gray-400' : c.diferencia_efectivo < 0 ? 'text-red-700' : c.diferencia_efectivo > 0 ? 'text-blue-700' : 'text-green-700'}`}>
                          {c.diferencia_efectivo == null ? '—' : formatCurrency(c.diferencia_efectivo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </>
        )}
      </section>
    </div>
  )
}
