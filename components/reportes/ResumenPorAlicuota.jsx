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

/** Sin card propia — vive dentro de un SeccionColapsable (pages/reportes.js). */
export default function ResumenPorAlicuota({ ventas, compras }) {
  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
      <Bloque titulo="Ventas" filas={ventas} />
      <Bloque titulo="Compras" filas={compras} />
    </div>
  )
}
