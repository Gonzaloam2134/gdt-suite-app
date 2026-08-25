import { useState } from 'react'
import { formatCurrency, formatHora } from '../../lib/format'
import { usePaginacion } from '../../hooks/usePaginacion'
import SeccionColapsable from '../ui/SeccionColapsable'
import EmptyState from '../ui/EmptyState'
import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES_OPERAN_CAJA } from '../../lib/constants/roles'

const COLOR = { cobro: 'text-green-700', gasto: 'text-red-700' }

/**
 * Lista de cobros o gastos. Una sola definición: en mobile filas expandibles,
 * en desktop tabla. Antes eran cuatro bloques de JSX casi idénticos.
 */
export default function ListaTransacciones({ tipo, items, onReversar }) {
  const { hasRole } = useUserRole()
  const puedeReversar = hasRole(ROLES_OPERAN_CAJA)
  const [expandida, setExpandida] = useState(null)
  const paginacion = usePaginacion(items, 15)
  const esCobro = tipo === 'cobro'
  const titulo = esCobro ? '💵 Cobros recibidos' : '💸 Gastos registrados'

  if (items.length === 0) {
    return (
      <SeccionColapsable titulo={titulo} badge={0}>
        <EmptyState icono={esCobro ? '💵' : '💸'} titulo={`No hay ${esCobro ? 'cobros' : 'gastos'} en este día`} />
      </SeccionColapsable>
    )
  }

  return (
    <SeccionColapsable titulo={titulo} badge={items.length} paginacion={paginacion}>
      {/* Mobile */}
      <div className="md:hidden divide-y divide-gray-100">
        {paginacion.visibles.map((t) => {
          const abierta = expandida === t.id
          return (
            <div key={t.id}>
              <button onClick={() => setExpandida(abierta ? null : t.id)} aria-expanded={abierta}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-50 bg-transparent border-none cursor-pointer text-left">
                <span className="text-sm font-semibold text-gray-900 truncate">{t.medios_pago?.nombre || 'Sin medio'}</span>
                <span className={`text-sm font-bold whitespace-nowrap ml-2 ${COLOR[tipo]}`}>{formatCurrency(t.monto)}</span>
              </button>
              {abierta && (
                <div className="px-3 pb-3 bg-gray-50 border-t border-gray-100 space-y-2 pt-2 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Hora</span><span className="font-semibold text-gray-900">{formatHora(t.creado_en)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-gray-500">Descripción</span><span className="font-semibold text-gray-900 text-right">{t.descripcion || 'Sin descripción'}</span></div>
                  {t.comision > 0 && <div className="flex justify-between"><span className="text-gray-500">Comisión</span><span className="font-semibold text-red-600">-{formatCurrency(t.comision)}</span></div>}
                  {puedeReversar && (
                    <div className="pt-2 border-t border-gray-200 flex justify-end">
                      <button onClick={() => onReversar(t)} className="px-3 py-1.5 bg-amber-100 text-amber-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-amber-200">↩️ Cancelar</button>
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
            {paginacion.visibles.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-2 text-gray-900">{formatHora(t.creado_en)}</td>
                <td className="p-2 text-gray-700">{t.medios_pago?.nombre || '-'}</td>
                <td className="p-2 text-gray-700">{t.descripcion || 'Sin descripción'}</td>
                <td className={`p-2 text-right font-bold ${COLOR[tipo]}`}>{formatCurrency(t.monto)}</td>
                <td className="p-2 text-center">
                  {puedeReversar && (
                    <button onClick={() => onReversar(t)} className="px-2 py-1 bg-amber-100 text-amber-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-amber-200">↩️ Cancelar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SeccionColapsable>
  )
}
