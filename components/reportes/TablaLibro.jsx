import { useState } from 'react'
import { formatCurrency, formatFecha } from '../../lib/format'
import EmptyState from '../ui/EmptyState'

const TIPO_LABEL = { A: 'Factura A', B: 'Factura B', C: 'Factura C', M: 'Factura M', TICKET: 'Ticket', SIN_COMPROBANTE: 'Sin comprobante' }
const LIMITE = 25

/** Libro IVA (ventas o compras). Muestra los primeros 25 y ofrece el resto en el Excel. */
export default function TablaLibro({ tipo, filas, totales, discriminaIva }) {
  const [verTodo, setVerTodo] = useState(false)
  const esVentas = tipo === 'ventas'
  const visibles = verTodo ? filas : filas.slice(0, LIMITE)

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
        <h2 className="font-bold text-gray-900 m-0 text-base">{esVentas ? 'Libro IVA Ventas' : 'Libro IVA Compras'}</h2>
        <span className="text-xs text-gray-500">{filas.length} registros</span>
      </header>

      {filas.length === 0 ? (
        <EmptyState icono="📄" titulo={`Sin ${esVentas ? 'ventas' : 'compras'} en el período`} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <th className="p-2 text-left font-bold">Fecha</th>
                  <th className="p-2 text-left font-bold">Comprobante</th>
                  <th className="p-2 text-left font-bold hidden md:table-cell">{esVentas ? 'Medio' : 'Proveedor'}</th>
                  {discriminaIva && <th className="p-2 text-right font-bold">Neto</th>}
                  {discriminaIva && <th className="p-2 text-right font-bold">IVA</th>}
                  <th className="p-2 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(f => (
                  <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-2 text-gray-900 whitespace-nowrap">{formatFecha(f.fecha)}</td>
                    <td className="p-2 text-gray-700">
                      {TIPO_LABEL[f.tipo] || f.tipo}
                      {f.numero && <span className="text-gray-400"> · {String(f.punto_venta ?? '').padStart(4, '0')}-{f.numero}</span>}
                    </td>
                    <td className="p-2 text-gray-700 hidden md:table-cell truncate max-w-[200px]">
                      {esVentas ? f.medio : f.proveedor}
                    </td>
                    {discriminaIva && <td className="p-2 text-right text-gray-700">{formatCurrency(f.neto)}</td>}
                    {discriminaIva && <td className="p-2 text-right text-gray-500">{formatCurrency(f.iva)} <span className="text-gray-400">({f.alicuota}%)</span></td>}
                    <td className="p-2 text-right font-bold text-gray-900">{formatCurrency(f.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold text-gray-900">
                  <td className="p-2" colSpan={discriminaIva ? 3 : 3}>Totales del período</td>
                  {discriminaIva && <td className="p-2 text-right">{formatCurrency(totales.neto)}</td>}
                  {discriminaIva && <td className="p-2 text-right">{formatCurrency(totales.iva)}</td>}
                  <td className="p-2 text-right">{formatCurrency(totales.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {filas.length > LIMITE && (
            <footer className="px-4 py-2 border-t border-gray-100 text-center">
              <button onClick={() => setVerTodo(v => !v)}
                className="text-xs text-blue-600 font-semibold bg-transparent border-none cursor-pointer hover:underline">
                {verTodo ? 'Ver menos' : `Ver los ${filas.length} registros`}
              </button>
            </footer>
          )}
        </>
      )}
    </section>
  )
}
