import { useState } from 'react'
import KpiCard from './KpiCard'
import { efectivoEsperado } from '../../lib/domain/transacciones'
import { formatCurrency } from '../../lib/format'

const Lista = ({ items }) => <ul className="space-y-1 list-disc list-inside m-0">{items.map(i => <li key={i}>{i}</li>)}</ul>

/**
 * "¿Cuánto tengo?", según quién pregunta. `vista`:
 *  - 'dueno': Disponible para usar = En caja + Acreditado hoy (los dos números
 *    a la vista, para que se entienda de dónde sale), y APARTE Pendiente:
 *    plata vendida que todavía no es tuya para usar.
 *  - 'cajero': solo el efectivo del cajón, que es lo que cuenta al cerrar.
 *  - 'empleado': nada de plata; solo avisa si la caja está cerrada.
 *
 * Son números que ya calcula el dominio; acá solo se ordenan. En caja es
 * solo efectivo; Acreditado hoy, solo tarjetas/QR/transferencias: no se pisan.
 */
export default function KpiCards({ totales, cajaAbierta, vista = 'dueno' }) {
  const [abierto, setAbierto] = useState(null)
  const alternar = (k) => setAbierto(a => (a === k ? null : k))

  if (vista === 'empleado') {
    return cajaAbierta ? null : <Cerrada mensaje="Cuando la abran vas a poder cobrar." />
  }

  const inicial = Number(cajaAbierta?.monto_inicial_efectivo) || 0
  const enCaja = cajaAbierta ? efectivoEsperado(inicial, totales) : 0

  const detalleEnCaja = (
    <>
      <p className="m-0 mb-1.5 font-semibold text-gray-900">
        {[
          `${formatCurrency(inicial)} inicial`,
          totales.efectivoCobrado > 0 ? `+ ${formatCurrency(totales.efectivoCobrado)} cobrado` : null,
          totales.efectivoGastado > 0 ? `− ${formatCurrency(totales.efectivoGastado)} gastos` : null,
        ].filter(Boolean).join(' ')}
      </p>
      <Lista items={['El efectivo que debería haber en el cajón ahora', 'Es contra este número que vas a contar al cerrar la caja']} />
    </>
  )
  const detalleAcreditado = <Lista items={['Tarjetas y QR que se acreditan hoy', 'Ya con la comisión descontada', 'Puede incluir ventas de días anteriores']} />
  const detallePendiente = <Lista items={['Ya lo vendiste, pero todavía no llegó a tu cuenta', 'Ya con la comisión descontada', 'Entra en los próximos días']} />

  const detalle = (id, contenido) => contenido && (
    <div id={id} className="mt-3 p-3 rounded-[14px] bg-primary-50 text-xs text-gray-700 animate-fade-in">{contenido}</div>
  )

  if (vista === 'cajero') {
    if (!cajaAbierta) return <Cerrada mensaje="Abrila para empezar a cobrar." />
    return (
      <section className="bg-white rounded-[24px] border border-black/5 shadow-suave p-4 md:p-5">
        <p className="m-0 text-sm font-semibold text-gray-500">En caja</p>
        <p className="m-0 mt-1 text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">{formatCurrency(enCaja)}</p>
        <button onClick={() => alternar('efectivo')} aria-expanded={abierto === 'efectivo'}
          className="mt-2 p-0 bg-transparent border-none text-xs font-semibold text-primary-700 cursor-pointer hover:underline">
          {abierto === 'efectivo' ? 'Ocultar cuenta' : 'Ver cómo se compone'}
        </button>
        {abierto === 'efectivo' && detalle('detalle-plata', detalleEnCaja)}
      </section>
    )
  }

  // Dueño
  const detalles = { efectivo: detalleEnCaja, acreditado: detalleAcreditado, pendiente: detallePendiente }

  return (
    <section className="bg-white rounded-[24px] border border-black/5 shadow-suave p-4 md:p-5">
      {cajaAbierta ? (
        <>
          <p className="m-0 text-sm font-semibold text-gray-500">Disponible para usar</p>
          <p className="m-0 mt-1 text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">{formatCurrency(enCaja + totales.disponibleHoy)}</p>
          <div className="mt-3 flex items-stretch gap-2">
            <KpiCard titulo="En caja" valor={enCaja} abierto={abierto === 'efectivo'} onToggle={() => alternar('efectivo')} detalleId="detalle-plata" />
            <span className="self-center text-gray-300 font-bold" aria-hidden="true">+</span>
            <KpiCard titulo="Acreditado hoy" valor={totales.disponibleHoy} tono="esmeralda" abierto={abierto === 'acreditado'} onToggle={() => alternar('acreditado')} detalleId="detalle-plata" />
          </div>
        </>
      ) : (
        <>
          <p className="m-0 text-lg font-bold text-gray-900">La caja está cerrada</p>
          <p className="m-0 mt-1 mb-3 text-sm text-gray-500">Abrila para empezar a registrar cobros y gastos.</p>
          <KpiCard titulo="Acreditado hoy" valor={totales.disponibleHoy} tono="esmeralda" abierto={abierto === 'acreditado'} onToggle={() => alternar('acreditado')} detalleId="detalle-plata" />
        </>
      )}

      {/* Aparte y más tenue: vendido, pero todavía no es plata para usar */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <KpiCard titulo="Pendiente · todavía no disponible" valor={totales.pendienteAcreditacion} tono="ambar" abierto={abierto === 'pendiente'} onToggle={() => alternar('pendiente')} detalleId="detalle-plata" />
      </div>

      {detalle('detalle-plata', detalles[abierto])}
    </section>
  )
}

function Cerrada({ mensaje }) {
  return (
    <section className="bg-white rounded-[24px] border border-black/5 shadow-suave p-4 md:p-5">
      <p className="m-0 text-lg font-bold text-gray-900">La caja está cerrada</p>
      <p className="m-0 mt-1 text-sm text-gray-500">{mensaje}</p>
    </section>
  )
}
