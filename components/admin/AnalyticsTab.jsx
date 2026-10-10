import { useMemo } from 'react'
import { useAnalyticsSuperAdmin } from '../../hooks/useAnalyticsSuperAdmin'
import { formatCurrency, formatPorcentaje, formatFechaHora } from '../../lib/format'
import Icono from '../ui/Icono'

const LABEL_PERIODO = {
  hoy: 'Hoy', semana: 'Últimos 7 días', mes: 'Este mes', 'ultimos-30': 'Últimos 30 días', trimestre: 'Último trimestre',
}

const LABEL_MEDIO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mercadopago: 'Mercado Pago', sin_medio: 'Sin medio' }

/**
 * Tab de análisis del superadmin: ranking de locales y owners por
 * actividad/volumen, desglose por medio de pago, y señales simples de
 * salud (locales en silencio, suscripciones por vencer). Todo se calcula
 * en lib/domain/analyticsSuperadmin.js a partir de transacciones reales del
 * período — no inventa ni proyecta nada que no haya pasado.
 */
export default function AnalyticsTab({ locales, suscripciones }) {
  const { periodo, setPeriodo, statsPorLocal, statsPorOwner, statsPorMedioPago, inactivos, porVencer, loading } =
    useAnalyticsSuperAdmin(locales, suscripciones)

  const nombrePorLocal = useMemo(() => new Map(locales.map((l) => [l.id, l.nombre])), [locales])

  const rankingLocales = useMemo(
    () => [...statsPorLocal].sort((a, b) => b.volumenCobrado - a.volumenCobrado),
    [statsPorLocal]
  )

  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-500/30 rounded-lg p-4">
        <p className="text-sm text-primary-700 m-0">
          <Icono nombre="reportes" size={16} className="inline-block align-text-bottom mr-1.5" />
          Actividad real de la plataforma por local, por owner y por medio de pago. Las reversas y
          transacciones anuladas no suman al volumen, igual que en la caja de cada local.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.keys(LABEL_PERIODO).map((p) => (
          <button key={p} onClick={() => setPeriodo(p)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none ${
              periodo === p ? 'press bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {LABEL_PERIODO[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 text-sm m-0">Cargando transacciones del período…</p>
        </div>
      ) : (
        <>
          {/* Salud de cuentas */}
          {(inactivos.length > 0 || porVencer.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inactivos.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-bold text-amber-900 m-0 mb-2 inline-flex items-center gap-1.5">
                    <Icono nombre="alerta" size={16} />{inactivos.length} local{inactivos.length !== 1 ? 'es' : ''} sin actividad hace 14+ días
                  </p>
                  <ul className="text-xs text-amber-800 m-0 pl-4 space-y-0.5">
                    {inactivos.slice(0, 8).map((l) => (
                      <li key={l.localId}>{nombrePorLocal.get(l.localId) || 'Local sin nombre'} — última: {l.ultimaActividad ? formatFechaHora(l.ultimaActividad) : 'nunca'}</li>
                    ))}
                  </ul>
                </div>
              )}
              {porVencer.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-bold text-red-900 m-0 mb-2 inline-flex items-center gap-1.5">
                    <Icono nombre="tarjeta" size={16} />{porVencer.length} suscripción{porVencer.length !== 1 ? 'es' : ''} vence{porVencer.length === 1 ? '' : 'n'} en los próximos 7 días
                  </p>
                  <ul className="text-xs text-red-800 m-0 pl-4 space-y-0.5">
                    {porVencer.map((s) => (
                      <li key={s.id}>{s.ownerEmail || s.locales?.[0]?.nombre || 'Sin owner'} — vence {formatFechaHora(s.fecha_vencimiento)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Por local */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-x-auto">
            <h3 className="text-base font-bold text-gray-900 mb-3">Ranking de locales ({rankingLocales.length})</h3>
            {rankingLocales.length === 0 ? (
              <p className="text-sm text-gray-400 m-0">Sin movimientos en este período.</p>
            ) : (
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                    <th className="pb-2 pr-3">Local</th>
                    <th className="pb-2 pr-3">Movimientos</th>
                    <th className="pb-2 pr-3">Volumen cobrado</th>
                    <th className="pb-2 pr-3">Ticket promedio</th>
                    <th className="pb-2 pr-3">% reversas</th>
                    <th className="pb-2 pr-3">% sin comprobante</th>
                    <th className="pb-2">Última actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingLocales.map((s) => (
                    <tr key={s.localId} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-semibold text-gray-800">{nombrePorLocal.get(s.localId) || 'Sin nombre'}</td>
                      <td className="py-2 pr-3">{s.movimientos}</td>
                      <td className="py-2 pr-3 font-semibold text-green-700">{formatCurrency(s.volumenCobrado)}</td>
                      <td className="py-2 pr-3">{formatCurrency(s.ticketPromedioCobro)}</td>
                      <td className="py-2 pr-3">{formatPorcentaje(s.pctReversas * 100)}</td>
                      <td className="py-2 pr-3">{formatPorcentaje(s.pctSinComprobante * 100)}</td>
                      <td className="py-2 text-gray-500">{s.ultimaActividad ? formatFechaHora(s.ultimaActividad) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Por owner */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-x-auto">
            <h3 className="text-base font-bold text-gray-900 mb-3">Por owner ({statsPorOwner.length})</h3>
            {statsPorOwner.length === 0 ? (
              <p className="text-sm text-gray-400 m-0">Sin movimientos en este período.</p>
            ) : (
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                    <th className="pb-2 pr-3">Owner</th>
                    <th className="pb-2 pr-3">Locales</th>
                    <th className="pb-2 pr-3">Movimientos</th>
                    <th className="pb-2 pr-3">Volumen cobrado</th>
                    <th className="pb-2">Volumen gastado</th>
                  </tr>
                </thead>
                <tbody>
                  {statsPorOwner.map((o) => (
                    <tr key={o.ownerId || o.locales[0]?.localId} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-semibold text-gray-800">{o.ownerEmail || o.ownerNombre || 'Sin owner activo'}</td>
                      <td className="py-2 pr-3">{o.locales.length}</td>
                      <td className="py-2 pr-3">{o.movimientos}</td>
                      <td className="py-2 pr-3 font-semibold text-green-700">{formatCurrency(o.volumenCobrado)}</td>
                      <td className="py-2">{formatCurrency(o.volumenGastado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Por medio de pago */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-base font-bold text-gray-900 mb-3">Por medio de pago</h3>
            {statsPorMedioPago.length === 0 ? (
              <p className="text-sm text-gray-400 m-0">Sin cobros en este período.</p>
            ) : (
              <div className="space-y-2">
                {statsPorMedioPago.map((m) => (
                  <div key={m.tipo} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg text-sm">
                    <div className="font-semibold text-gray-800">{LABEL_MEDIO[m.tipo] || m.tipo}</div>
                    <div className="text-xs text-gray-500">{m.movimientos} cobro{m.movimientos !== 1 ? 's' : ''}</div>
                    <div className="font-bold text-green-700">{formatCurrency(m.volumen)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
