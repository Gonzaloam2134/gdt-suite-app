import KpiCard from './KpiCard'
import { usePreferencia } from '../../hooks/usePreferencia'

const Lista = ({ items }) => <ul className="space-y-1 list-disc list-inside m-0">{items.map(i => <li key={i}>{i}</li>)}</ul>

/**
 * Dos grupos, cada uno colapsable, porque responden preguntas distintas:
 *   "Cómo me fue hoy"   → Cobros, Gastos, Neto
 *   "Dónde está la plata" → Efectivo en caja, Disponible, Pendiente
 * Colapsar de a una obligaría a recordar seis estados; colapsar todo junto
 * escondería justo lo que se viene a mirar. La elección queda guardada.
 */
export default function KpiCards({ totales, cantidadCobros, cantidadGastos }) {
  const [abiertos, setAbiertos] = usePreferencia('caja.kpis', { resultado: true, plata: true })
  const alternar = (grupo) => setAbiertos(a => ({ ...a, [grupo]: !a[grupo] }))

  const resultado = [
    { key: 'cobros', titulo: '💵 Cobros', valor: totales.cobros, detalle: `${cantidadCobros} movimientos`, tono: 'verde',
      ayuda: <Lista items={['Todo lo cobrado hoy', 'Efectivo, tarjetas y transferencias', 'Monto bruto, sin descontar comisiones']} /> },
    { key: 'gastos', titulo: '💸 Gastos', valor: totales.gastos, detalle: `${cantidadGastos} movimientos`, tono: 'rojo',
      ayuda: <Lista items={['Todo lo que saliste a pagar hoy', 'Proveedores, servicios, retiros']} /> },
    { key: 'neto', titulo: '📈 Neto', valor: totales.netoReal, detalle: 'Resultado del día', tono: 'verde', negativo: totales.netoReal < 0,
      ayuda: <><div className="font-semibold mb-1">Cobros − comisiones − gastos</div><div>Lo que te queda limpio del día.</div></> },
  ]

  const plata = [
    { key: 'efectivo', titulo: '🏦 En caja', valor: totales.efectivoEnCaja, detalle: 'Solo efectivo', tono: 'azul',
      ayuda: <Lista items={['Solo los cobros en efectivo', 'Es lo que tenés que contar al cerrar', 'No incluye tarjetas ni transferencias']} /> },
    { key: 'disponible', titulo: '✅ Disponible', valor: totales.disponibleHoy, detalle: 'Se acreditó hoy', tono: 'esmeralda',
      ayuda: <Lista items={['Tarjetas y QR que acreditan hoy', 'Ya con la comisión descontada', 'Plata que podés usar']} /> },
    { key: 'pendiente', titulo: '⏳ Pendiente', valor: totales.pendienteAcreditacion, detalle: 'Por acreditar', tono: 'ambar',
      ayuda: <Lista items={['Tarjetas con plazo de acreditación', 'Ya con la comisión descontada', 'Entra en los próximos días']} /> },
  ]

  return (
    <div className="space-y-3">
      <Grupo titulo="Cómo viene el día" abierto={abiertos.resultado} onAlternar={() => alternar('resultado')} tarjetas={resultado} />
      <Grupo titulo="Dónde está la plata" abierto={abiertos.plata} onAlternar={() => alternar('plata')} tarjetas={plata} />
    </div>
  )
}

function Grupo({ titulo, abierto, onAlternar, tarjetas }) {
  return (
    <section>
      <button onClick={onAlternar} aria-expanded={abierto}
        className="flex items-center gap-1.5 mb-2 bg-transparent border-none cursor-pointer p-0 text-left group">
        <span className="text-gray-400 text-[10px]">{abierto ? '▼' : '▶'}</span>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide m-0 group-hover:text-gray-700">{titulo}</h2>
      </button>

      {abierto ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          {tarjetas.map(t => <KpiCard key={t.key} {...t} />)}
        </div>
      ) : (
        <ResumenPlegado tarjetas={tarjetas} onExpandir={onAlternar} />
      )}
    </section>
  )
}

/** Plegado no significa invisible: se ven los números chicos, en una línea. */
function ResumenPlegado({ tarjetas, onExpandir }) {
  return (
    <button onClick={onExpandir}
      className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 overflow-x-auto">
      {tarjetas.map(t => (
        <span key={t.key} className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[11px] text-gray-500">{t.titulo}</span>
          <span className={`text-xs font-bold ${t.negativo ? 'text-red-700' : 'text-gray-900'}`}>
            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(t.valor || 0)}
          </span>
        </span>
      ))}
    </button>
  )
}
