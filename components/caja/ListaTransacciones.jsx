import { useState } from 'react'
import { formatCurrency, formatHora } from '../../lib/format'
import { usePaginacion } from '../../hooks/usePaginacion'
import SeccionColapsable from '../ui/SeccionColapsable'
import StatusBadge from '../ui/StatusBadge'
import EmptyState from '../ui/EmptyState'
import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES_OPERAN_CAJA } from '../../lib/constants/roles'

const COLOR = { cobro: 'text-green-700', gasto: 'text-red-700' }

/**
 * Lista única de movimientos del día — cobros, gastos y sus reversas,
 * en una sola tira cronológica. Cada fila trae su propio tipoMovimiento
 * ('cobro'|'gasto') para color/signo; ya no es una lista separada por tipo.
 * Mobile: filas expandibles. Desktop: tabla. Misma definición para los dos.
 */
export default function ListaTransacciones({ items, onReversar, titulo = 'Movimientos de hoy', soloLectura = false }) {
  const { hasRole } = useUserRole()
  // En un día pasado la lista es solo lectura: anular ahí tocaría una caja ya cerrada.
  const puedeReversar = hasRole(ROLES_OPERAN_CAJA) && !soloLectura
  const [expandida, setExpandida] = useState(null)
  const paginacion = usePaginacion(items, 15)
  const activos = items.filter(t => !t.anulada && !t.reversa).length
  const marcados = items.length - activos

  if (items.length === 0) {
    return (
      <SeccionColapsable titulo={titulo} badge={0}>
        <EmptyState icono="recibo" titulo="No hay movimientos en este día" />
      </SeccionColapsable>
    )
  }

  // Ni una anulada ni su reversa se pueden volver a revertir.
  const puedeCancelar = (t) => puedeReversar && !t.anulada && !t.reversa

  return (
    <SeccionColapsable titulo={titulo} paginacion={paginacion}
      badge={marcados > 0 ? `${activos} + ${marcados} anulado${marcados > 1 ? 's' : ''}` : activos}>
      {/* Mobile */}
      <div className="md:hidden divide-y divide-gray-100">
        {paginacion.visibles.map((t) => {
          const abierta = expandida === t.id
          const marcada = t.anulada || t.reversa
          return (
            <div key={t.id}>
              <button onClick={() => setExpandida(abierta ? null : t.id)} aria-expanded={abierta}
                className={`w-full p-3 flex items-center justify-between bg-transparent border-none cursor-pointer text-left ${marcada ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`text-sm font-semibold truncate ${marcada ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {t.medios_pago?.nombre || 'Sin medio'}
                  </span>
                  {t.anulada && <StatusBadge tone="neutral" label="Anulada" />}
                  {t.reversa && <StatusBadge tone="neutral" label="Reversa" />}
                </span>
                <span className={`text-sm font-bold whitespace-nowrap ml-2 ${marcada ? 'text-gray-400 line-through' : COLOR[t.tipoMovimiento]}`}>
                  {formatCurrency(t.monto)}
                </span>
              </button>
              {abierta && (
                <div className="px-3 pb-3 bg-gray-50 border-t border-gray-100 space-y-2 pt-2 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Hora</span><span className="font-semibold text-gray-900">{formatHora(t.creado_en)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-gray-500">Descripción</span><span className="font-semibold text-gray-900 text-right">{t.descripcion || 'Sin descripción'}</span></div>
                  {t.comision > 0 && <div className="flex justify-between"><span className="text-gray-500">Comisión</span><span className="font-semibold text-red-600">-{formatCurrency(t.comision)}</span></div>}
                  {t.anulada && t.motivo_reversa && (
                    <div className="flex justify-between gap-4"><span className="text-gray-500">Motivo</span><span className="font-semibold text-right text-gray-700">{t.motivo_reversa}</span></div>
                  )}
                  {puedeCancelar(t) && (
                    <div className="pt-2 border-t border-gray-200 flex justify-end">
                      <button onClick={() => onReversar(t)} className="press min-h-[44px] px-4 bg-warning-50 text-warning-700 border-none rounded-[12px] text-sm font-semibold cursor-pointer hover:bg-amber-100">↩️ Anular</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <th className="p-2 text-left font-bold">Hora</th>
              <th className="p-2 text-left font-bold">Medio</th>
              <th className="p-2 text-left font-bold">Descripción</th>
              <th className="p-2 text-right font-bold">Monto</th>
              <th className="p-2 text-center font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginacion.visibles.map((t) => {
              const marcada = t.anulada || t.reversa
              return (
                <tr key={t.id} className={`fila-hover border-b border-gray-100 ${marcada ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'}`}>
                  <td className={`p-2 ${marcada ? 'text-gray-400' : 'text-gray-900'}`}>{formatHora(t.creado_en)}</td>
                  <td className={`p-2 ${marcada ? 'text-gray-400' : 'text-gray-700'}`}>{t.medios_pago?.nombre || '-'}</td>
                  <td className={`p-2 ${marcada ? 'text-gray-400' : 'text-gray-700'}`}>
                    <span className={marcada ? 'line-through' : ''}>{t.descripcion || 'Sin descripción'}</span>
                    {t.anulada && <span className="ml-2 inline-block"><StatusBadge tone="neutral" label="Anulada" /></span>}
                    {t.reversa && <span className="ml-2 inline-block"><StatusBadge tone="neutral" label="Reversa" /></span>}
                  </td>
                  <td className={`p-2 text-right font-bold ${marcada ? 'text-gray-400 line-through' : COLOR[t.tipoMovimiento]}`}>{formatCurrency(t.monto)}</td>
                  <td className="p-2 text-center">
                    {puedeCancelar(t) && (
                      <button onClick={() => onReversar(t)} className="accion-fila press px-3 py-1.5 bg-warning-50 text-warning-700 border-none rounded-[10px] text-xs font-semibold cursor-pointer hover:bg-amber-100 transition-opacity duration-150">↩️ Anular</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </SeccionColapsable>
  )
}
