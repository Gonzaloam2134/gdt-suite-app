import { formatCurrency } from '../../lib/format'

/**
 * Contenido de "Cobrado por cuenta corriente" — sin card propia, vive dentro
 * de un SeccionColapsable (pages/reportes.js) que ya da el título y el chrome.
 *
 * Es solo informativo: esta plata YA está contada en los totales normales
 * (Resumen ejecutivo, Medios de pago, Libro IVA) porque un pago de cuenta
 * corriente genera un cobro real en `transacciones`, igual que cualquier
 * venta. Esto no suma un total nuevo — separa cuánto de lo ya cobrado vino
 * de gente pagando su cuenta en vez de una venta del momento (el kiosko de
 * un colegio, por ejemplo).
 */
export default function ResumenCuentaCorriente({ pagosCc, totalFacturado }) {
  if (pagosCc.cantidad === 0) {
    return <p className="p-4 text-xs text-gray-500 m-0">Sin pagos de cuenta corriente en el período.</p>
  }

  return (
    <div className="p-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 flex items-center justify-between">
        <span className="text-sm text-amber-800">
          Cobrado por cuenta corriente ({pagosCc.cantidad} pago{pagosCc.cantidad !== 1 ? 's' : ''})
          {totalFacturado > 0 && <span className="text-amber-600"> · {Math.round((pagosCc.total / totalFacturado) * 100)}% de lo facturado</span>}
        </span>
        <span className="text-base font-extrabold text-amber-800">{formatCurrency(pagosCc.total)}</span>
      </div>
      <p className="text-[11px] text-gray-400 m-0 mb-3">
        Ya está incluido en el resumen ejecutivo y en medios de pago — este cuadro solo separa de dónde vino.
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-200">
            <th className="py-1 text-left font-semibold">Cliente</th>
            <th className="py-1 text-right font-semibold">Pagos</th>
            <th className="py-1 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {pagosCc.porCliente.map(c => (
            <tr key={c.clienteId} className="border-b border-gray-100">
              <td className="py-1.5 font-semibold text-gray-900">{c.nombre}</td>
              <td className="py-1.5 text-right text-gray-500">{c.cantidad}</td>
              <td className="py-1.5 text-right font-bold text-gray-900">{formatCurrency(c.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
