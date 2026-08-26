import { formatCurrency } from '../../lib/format'

const Fila = ({ label, valor, negativo, destacada, ayuda }) => (
  <div className={`flex justify-between items-baseline gap-4 py-2 ${destacada ? 'border-t-2 border-gray-300 mt-1' : 'border-b border-gray-100'}`}>
    <span className={`text-sm ${destacada ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
      {label}
      {ayuda && <span className="block text-xs text-gray-400">{ayuda}</span>}
    </span>
    <span className={`font-bold whitespace-nowrap ${destacada ? 'text-lg' : 'text-sm'} ${negativo ? 'text-red-600' : 'text-gray-900'}`}>
      {negativo ? '-' : ''}{formatCurrency(Math.abs(valor))}
    </span>
  </div>
)

export default function ResumenEjecutivo({ resumen, discriminaIva }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <header className="bg-slate-800 px-4 py-3">
        <h2 className="text-white font-bold m-0 text-base">Resultado del período</h2>
      </header>
      <div className="p-4">
        <Fila label="Total facturado" ayuda="Todo lo que cobraste, sin descontar nada" valor={resumen.totalFacturado} />
        {discriminaIva && <Fila label="(-) IVA débito fiscal" valor={resumen.ivaDebitoFiscal} negativo />}
        {discriminaIva && <Fila label="Neto gravado" valor={resumen.netoGravado} />}
        <Fila label="(-) Comisiones de medios de pago" ayuda="Lo que se quedan las tarjetas y billeteras" valor={resumen.comisiones} negativo />
        <Fila label="Ingreso neto real" ayuda="Lo que efectivamente entró" valor={resumen.ingresoNetoReal} />
        <Fila label="(-) Gastos operativos" valor={resumen.gastosOperativos} negativo />
        {discriminaIva && <Fila label="(+) IVA crédito fiscal" valor={resumen.ivaCreditoFiscal} />}
        <Fila label="Resultado" valor={resumen.resultadoEjercicio} destacada negativo={resumen.resultadoEjercicio < 0} />

        {discriminaIva && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold text-gray-700">
                Posición IVA
                <span className="block text-xs text-gray-500 font-normal">Débito menos crédito fiscal</span>
              </span>
              <span className={`font-bold ${resumen.ivaAPagar >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                {formatCurrency(Math.abs(resumen.ivaAPagar))}
                <span className="block text-xs font-normal text-right">{resumen.ivaAPagar >= 0 ? 'a pagar' : 'a favor'}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
