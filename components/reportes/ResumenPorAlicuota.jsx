import { formatCurrency } from '../../lib/format'

const Bloque = ({ titulo, filas }) => (
  <div>
    <h3 className="text-sm font-bold text-gray-700 mb-2 m-0">{titulo}</h3>
    {filas.length === 0 ? (
      <p className="text-xs text-gray-500 m-0">Sin movimientos.</p>
    ) : (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-200">
            <th className="py-1 text-left font-semibold">Alícuota</th>
            <th className="py-1 text-right font-semibold">Cant.</th>
            <th className="py-1 text-right font-semibold">Neto</th>
            <th className="py-1 text-right font-semibold">IVA</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(a => (
            <tr key={a.alicuota} className="border-b border-gray-100">
              <td className="py-1.5 font-semibold text-gray-900">{a.alicuota}%</td>
              <td className="py-1.5 text-right text-gray-600">{a.cantidad}</td>
              <td className="py-1.5 text-right text-gray-700">{formatCurrency(a.neto)}</td>
              <td className="py-1.5 text-right font-semibold text-gray-900">{formatCurrency(a.iva)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
)

export default function ResumenPorAlicuota({ ventas, compras }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="font-bold text-gray-900 m-0 mb-3 text-base">Resumen por alícuota</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Bloque titulo="Ventas" filas={ventas} />
        <Bloque titulo="Compras" filas={compras} />
      </div>
    </section>
  )
}
