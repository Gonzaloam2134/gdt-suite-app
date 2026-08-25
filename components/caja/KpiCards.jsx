import { useState } from 'react'
import KpiCard from './KpiCard'

const Lista = ({ items }) => <ul className="space-y-1 list-disc list-inside m-0">{items.map(i => <li key={i}>{i}</li>)}</ul>

/**
 * Cobros y Neto siempre visibles; el resto se despliega en mobile y se muestra siempre en desktop.
 * Antes eran 8 bloques de JSX casi idénticos.
 */
export default function KpiCards({ totales, cantidadCobros, cantidadGastos }) {
  const [verMas, setVerMas] = useState(false)

  const secundarias = [
    { key: 'gastos', titulo: '💸 Gastos', valor: totales.gastos, detalle: `${cantidadGastos} transacciones`, tono: 'rojo',
      ayuda: <Lista items={['Todos los gastos del día', 'Alquiler, insumos, servicios', 'Cualquier egreso registrado']} /> },
    { key: 'efectivo', titulo: '🏦 Efectivo', valor: totales.efectivoEnCaja, detalle: 'Solo efectivo', tono: 'azul',
      ayuda: <Lista items={['Solo cobros en efectivo', 'No incluye tarjetas', 'Lo que debería haber físicamente en caja']} /> },
    { key: 'disponible', titulo: '✅ Disponible', valor: totales.disponibleHoy, detalle: 'Acreditado hoy', tono: 'esmeralda',
      ayuda: <Lista items={['Tarjetas que acreditan hoy', 'Monto neto, sin comisiones', 'Lo que podés usar ya']} /> },
    { key: 'pendiente', titulo: '⏳ Pendiente', valor: totales.pendienteAcreditacion, detalle: 'Por acreditar', tono: 'ambar',
      ayuda: <Lista items={['Tarjetas con plazo de acreditación', 'Monto neto, sin comisiones', 'Dinero que entra más adelante']} /> },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-6">
      <KpiCard titulo="💵 Cobros" valor={totales.cobros} detalle={`${cantidadCobros} transacciones`} tono="verde" destacada
        ayuda={<Lista items={['Todos los cobros del día', 'Efectivo, tarjetas y transferencias', 'Monto bruto, sin descontar comisiones']} />} />

      <KpiCard titulo="📈 Neto" valor={totales.netoReal} detalle="Resultado del día" tono="verde" destacada negativo={totales.netoReal < 0}
        ayuda={<><div className="font-semibold mb-1">Cobros − comisiones − gastos</div><div>Lo que te queda después de comisiones y gastos.</div></>} />

      <div className="hidden md:contents">
        {secundarias.map(m => <KpiCard key={m.key} {...m} />)}
      </div>

      <button onClick={() => setVerMas(v => !v)} aria-expanded={verMas}
        className="md:hidden col-span-2 bg-gray-100 text-gray-700 border-none rounded-xl p-3 text-xs font-semibold cursor-pointer hover:bg-gray-200">
        {verMas ? '▲ Menos métricas' : '▼ Más métricas'}
      </button>

      {verMas && <div className="md:hidden col-span-2 grid grid-cols-2 gap-2">
        {secundarias.map(m => <KpiCard key={m.key} {...m} />)}
      </div>}
    </div>
  )
}
