import { useState } from 'react'
import KpiCard from './KpiCard'
import { efectivoEsperado } from '../../lib/domain/transacciones'
import { formatCurrency } from '../../lib/format'

const Lista = ({ items }) => <ul className="space-y-1 list-disc list-inside m-0">{items.map(i => <li key={i}>{i}</li>)}</ul>

/**
 * "Dónde está la plata", hoy. Tres chips tocables (En caja / Acreditado hoy /
 * Pendiente) que abren su detalle; el resultado del día (Cobros/Gastos/Neto)
 * no va acá, vive en Reportes.
 *
 * Caja abierta: arriba el hero "Disponible para usar" = En caja + Acreditado
 * hoy. Son dos números que ya calcula el dominio y no se pisan (En caja es
 * solo efectivo; Acreditado hoy, solo tarjetas/QR/transferencias), así que la
 * suma no inventa nada. Caja cerrada: sin "En caja" ni hero, con la invitación a abrir.
 */
export default function KpiCards({ totales, cajaAbierta }) {
  const [abierto, setAbierto] = useState(null)
  const alternar = (k) => setAbierto(a => (a === k ? null : k))

  const inicial = Number(cajaAbierta?.monto_inicial_efectivo) || 0
  const enCaja = cajaAbierta ? efectivoEsperado(inicial, totales) : 0

  const chips = [
    cajaAbierta && {
      key: 'efectivo', titulo: 'En caja', valor: enCaja, tono: 'azul',
      detalle: <>
        <p className="m-0 mb-1.5 font-semibold text-gray-900">
          {[
            `${formatCurrency(inicial)} inicial`,
            totales.efectivoCobrado > 0 ? `+ ${formatCurrency(totales.efectivoCobrado)} cobrado` : null,
            totales.efectivoGastado > 0 ? `− ${formatCurrency(totales.efectivoGastado)} gastos` : null,
          ].filter(Boolean).join(' ')}
        </p>
        <Lista items={['El efectivo que debería haber en el cajón ahora', 'Es contra este número que vas a contar al cerrar la caja']} />
      </>,
    },
    {
      key: 'acreditado', titulo: 'Acreditado hoy', valor: totales.disponibleHoy, tono: 'esmeralda',
      detalle: <Lista items={['Tarjetas y QR que se acreditan hoy', 'Ya con la comisión descontada', 'Puede incluir ventas de días anteriores']} />,
    },
    {
      key: 'pendiente', titulo: 'Pendiente', valor: totales.pendienteAcreditacion, tono: 'ambar',
      detalle: <Lista items={['Tarjetas con plazo de acreditación', 'Ya con la comisión descontada', 'Entra en los próximos días']} />,
    },
  ].filter(Boolean)

  const abierta = chips.find(c => c.key === abierto)

  return (
    <section className="bg-white rounded-[24px] border border-black/5 shadow-suave p-4 md:p-5">
      {cajaAbierta ? (
        <div className="mb-4">
          <p className="m-0 text-sm font-semibold text-gray-500">Disponible para usar</p>
          <p className="m-0 mt-1 text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">{formatCurrency(enCaja + totales.disponibleHoy)}</p>
          <p className="m-0 mt-1 text-xs text-gray-400">En caja + acreditado hoy</p>
        </div>
      ) : (
        <div className="mb-4">
          <p className="m-0 text-lg font-bold text-gray-900">La caja está cerrada</p>
          <p className="m-0 mt-1 text-sm text-gray-500">Abrila para empezar a registrar cobros y gastos.</p>
        </div>
      )}

      <div className="flex gap-2">
        {chips.map(c => (
          <KpiCard key={c.key} titulo={c.titulo} valor={c.valor} tono={c.tono}
            abierto={abierto === c.key} onToggle={() => alternar(c.key)} detalleId="detalle-plata" />
        ))}
      </div>

      {abierta && (
        <div id="detalle-plata" className="mt-3 p-3 rounded-[14px] bg-primary-50 text-xs text-gray-700 animate-fade-in">{abierta.detalle}</div>
      )}
    </section>
  )
}
