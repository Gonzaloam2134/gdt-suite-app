import { useMemo } from 'react'
import { formatCurrency, formatPorcentaje } from '../../lib/format'
import { ownerPorLocal } from '../../lib/domain/analyticsSuperadmin'
import Icono from '../ui/Icono'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const LABEL_MEDIO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mercadopago: 'Mercado Pago', sin_medio: 'Sin medio' }
const COLOR_RGB = '1,156,98' // primary-600, mismo verde de marca que el BarChart de cashflow

/** Grilla día×hora: un solo tono (el de marca), de claro a oscuro según volumen — sin arcoíris. */
function HeatmapHoraDia({ celdas }) {
  const max = Math.max(1, ...celdas.map((c) => c.volumen))
  const porCelda = useMemo(() => new Map(celdas.map((c) => [`${c.dia}-${c.hora}`, c])), [celdas])

  if (celdas.length === 0) return <p className="text-sm text-gray-400 m-0">Sin cobros en este período para mostrar el patrón horario.</p>

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="w-10" />
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} className="font-normal text-gray-400 text-[10px]" style={{ width: 14 }}>{h % 3 === 0 ? h : ''}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIAS.map((label, dia) => (
            <tr key={dia}>
              <td className="pr-2 text-gray-500 font-semibold text-right">{label}</td>
              {Array.from({ length: 24 }, (_, hora) => {
                const c = porCelda.get(`${dia}-${hora}`)
                const intensidad = c ? c.volumen / max : 0
                return (
                  <td key={hora}
                    title={c ? `${label} ${hora}hs — ${formatCurrency(c.volumen)} · ${c.movimientos} cobro${c.movimientos !== 1 ? 's' : ''} · ticket prom. ${formatCurrency(c.ticketPromedio)}` : `${label} ${hora}hs — sin actividad`}
                    style={{ width: 14, height: 14, backgroundColor: c ? `rgba(${COLOR_RGB},${0.1 + intensidad * 0.8})` : '#f3f4f6', borderRadius: 2 }}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-gray-400 mt-2 m-0">Más oscuro = más volumen cobrado en esa franja. Pasá el mouse por un cuadrado para el detalle.</p>
    </div>
  )
}

/**
 * Detalle "por owner y por negocio" — selector de alcance + comisiones
 * reales, patrón horario, y alertas de caída/crecimiento del gasto, todo
 * acotado a lo que se elija. Pensado para la conversación de venta de
 * consultoría: algo que el dueño no sabe de su propio negocio, no un
 * resumen de lo que ya ve en Caja.
 */
export default function AnalyticsDetalle({ locales, scope, setScope, comisiones, comisionesPorMedio, heatmap, serie, alertaCaida, crecimiento }) {
  const gruposPorOwner = useMemo(() => {
    const ownerMap = ownerPorLocal(locales)
    const porOwner = new Map()
    for (const l of locales) {
      const o = ownerMap.get(l.id) || {}
      const key = o.ownerId || `sin-owner:${l.id}`
      if (!porOwner.has(key)) porOwner.set(key, { ownerId: o.ownerId || null, label: o.ownerEmail || o.ownerNombre || 'Sin owner activo', locales: [] })
      porOwner.get(key).locales.push(l)
    }
    return Array.from(porOwner.values())
  }, [locales])

  const valorSelect = scope.tipo === 'todos' ? 'todos' : `${scope.tipo}:${scope.id}`
  const onChangeScope = (e) => {
    const v = e.target.value
    if (v === 'todos') return setScope({ tipo: 'todos', id: null })
    const [tipo, id] = v.split(':')
    setScope({ tipo, id })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-bold text-gray-900 m-0">Detalle por owner / por negocio</h3>
        <select value={valorSelect} onChange={onChangeScope}
          className="p-2 border border-gray-300 rounded-md text-sm max-w-full">
          <option value="todos">Todos los locales</option>
          {gruposPorOwner.map((g) => (
            <optgroup key={g.ownerId || g.label} label={g.label}>
              {g.ownerId && <option value={`owner:${g.ownerId}`}>Todo — {g.label}</option>}
              {g.locales.map((l) => <option key={l.id} value={`local:${l.id}`}>{l.nombre}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {alertaCaida?.caida && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          <Icono nombre="alerta" size={16} className="inline-block align-text-bottom mr-1.5" />
          Esta semana cobró <strong>{formatPorcentaje(Math.abs(alertaCaida.variacionPct) * 100)} menos</strong> que su
          propio promedio de las últimas {alertaCaida.semanasDeReferencia} semanas ({formatCurrency(alertaCaida.volumenActual)} vs. promedio de {formatCurrency(alertaCaida.promedioMovil)}).
        </div>
      )}

      {crecimiento?.gastosCrecenMasRapido && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <Icono nombre="alerta" size={16} className="inline-block align-text-bottom mr-1.5" />
          Los gastos crecieron más rápido que las ventas en este período
          ({formatPorcentaje((crecimiento.crecGastos ?? 0) * 100)} vs. {formatPorcentaje((crecimiento.crecVentas ?? 0) * 100)}) — el margen se achica aunque la caja cierre bien.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 font-semibold uppercase">Volumen cobrado</div>
          <div className="text-xl font-extrabold text-green-700 mt-1">{formatCurrency(comisiones.volumenCobrado)}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 font-semibold uppercase">Comisión pagada</div>
          <div className="text-xl font-extrabold text-red-600 mt-1">{formatCurrency(comisiones.comisionPagada)}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 font-semibold uppercase">% del volumen</div>
          <div className="text-xl font-extrabold text-gray-800 mt-1">{formatPorcentaje(comisiones.pctComision * 100)}</div>
        </div>
      </div>

      {comisionesPorMedio.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-gray-800 mb-2">Comisión por medio de pago</h4>
          <div className="space-y-1.5">
            {comisionesPorMedio.map((m) => (
              <div key={m.tipo} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-lg text-sm">
                <div className="font-semibold text-gray-700">{LABEL_MEDIO[m.tipo] || m.tipo}</div>
                <div className="text-xs text-gray-500">{formatCurrency(m.volumen)} cobrado</div>
                <div className="font-bold text-red-600">{formatCurrency(m.comision)} <span className="text-gray-400 font-normal">({formatPorcentaje(m.pctComision * 100)})</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-bold text-gray-800 mb-2">Cuándo vende — patrón por día y hora</h4>
        <HeatmapHoraDia celdas={heatmap} />
      </div>

      {serie.length > 1 && (
        <div>
          <h4 className="text-sm font-bold text-gray-800 mb-2">Últimas {serie.length} semanas</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="pb-1.5 pr-3">Semana de</th>
                  <th className="pb-1.5 pr-3">Cobrado</th>
                  <th className="pb-1.5">Gastado</th>
                </tr>
              </thead>
              <tbody>
                {serie.slice(-12).map((s) => (
                  <tr key={s.semana} className="border-b border-gray-100">
                    <td className="py-1.5 pr-3 text-gray-600">{s.semana}</td>
                    <td className="py-1.5 pr-3 text-green-700 font-semibold">{formatCurrency(s.volumenCobrado)}</td>
                    <td className="py-1.5 text-gray-600">{formatCurrency(s.volumenGastado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
