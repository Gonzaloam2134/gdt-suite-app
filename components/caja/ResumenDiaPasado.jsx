import { formatCurrency } from '../../lib/format'

const Dato = ({ label, valor, className = 'text-gray-900' }) => (
  <div className="flex-1 min-w-0">
    <p className="m-0 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
    <p className={`m-0 mt-0.5 text-lg md:text-xl font-extrabold truncate ${className}`}>{valor}</p>
  </div>
)

/**
 * Día pasado: solo lectura. Cobros / Gastos / Neto con los totales que ya
 * calcula el dominio para ese día (netoReal = cobros − comisiones − gastos).
 */
export default function ResumenDiaPasado({ totales }) {
  return (
    <section className="bg-white rounded-[24px] border border-black/5 shadow-suave p-4 md:p-5">
      <p className="m-0 mb-3 text-sm font-semibold text-gray-500">Resumen del día</p>
      <div className="flex gap-3">
        <Dato label="Cobros" valor={formatCurrency(totales.cobros)} className="text-primary-700" />
        <Dato label="Gastos" valor={formatCurrency(totales.gastos)} className="text-danger-700" />
        <Dato label="Neto" valor={formatCurrency(totales.netoReal)} className={totales.netoReal < 0 ? 'text-danger-700' : 'text-gray-900'} />
      </div>
    </section>
  )
}
