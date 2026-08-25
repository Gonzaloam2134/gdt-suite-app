import FiltroPeriodo from './FiltroPeriodo'
import ListaLogs from './ListaLogs'
import { formatCurrency } from '../../lib/format'

const Stat = ({ label, valor, color }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-200">
    <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">{label}</div>
    <div className={`text-2xl font-extrabold ${color}`}>{valor}</div>
  </div>
)

export default function ResumenTab({ stats, logs, periodo, onPreset, onFechas }) {
  return (
    <div className="space-y-4">
      <FiltroPeriodo periodo={periodo} onPreset={onPreset} onFechas={onFechas} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Ventas" valor={formatCurrency(stats.ventas)} color="text-green-700" />
        <Stat label="Gastos" valor={formatCurrency(stats.gastos)} color="text-red-700" />
        <Stat label="Resultado" valor={formatCurrency(stats.resultado)} color={stats.resultado >= 0 ? 'text-green-700' : 'text-red-700'} />
        <Stat label="Movimientos" valor={stats.transacciones} color="text-blue-700" />
      </div>
      <ListaLogs logs={logs} limite={10} titulo="Últimas acciones" />
    </div>
  )
}
