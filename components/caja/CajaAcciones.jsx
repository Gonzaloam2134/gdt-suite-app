import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES_OPERAN_CAJA } from '../../lib/constants/roles'

/**
 * Barra de acciones del día. Solo owner y cajero operan la caja (coincide con la RLS).
 * Si el usuario no puede operar, lo decimos: una barra vacía no explica nada.
 */
export default function CajaAcciones({ cajaAbierta, huerfana, onAbrir, onCerrar, onHistorial, onCobro, onGasto }) {
  const { hasRole, loading } = useUserRole()
  const puedeOperar = hasRole(ROLES_OPERAN_CAJA)

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {puedeOperar && (cajaAbierta
            ? <button onClick={onCerrar} className="px-3 py-2 bg-orange-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-orange-600 shadow-sm">🔒 Cerrar caja</button>
            : <button onClick={onAbrir} disabled={!!huerfana} title={huerfana ? 'Cerrá la caja anterior antes de abrir la de hoy' : ''}
                className="px-3 py-2 bg-emerald-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">🔓 Abrir caja</button>)}
          <button onClick={onHistorial} title="Historial de cierres"
            className="px-3 py-2 bg-indigo-100 text-indigo-700 border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-indigo-200">
            📋 <span className="hidden md:inline">Historial</span>
          </button>
        </div>

        {puedeOperar ? (
          <div className="flex items-center gap-2">
            <button onClick={onCobro} disabled={!cajaAbierta} title={cajaAbierta ? '' : 'Abrí la caja para registrar cobros'}
              className="px-4 py-2 bg-green-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-green-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">+ Cobro</button>
            <button onClick={onGasto} disabled={!cajaAbierta} title={cajaAbierta ? '' : 'Abrí la caja para registrar gastos'}
              className="px-4 py-2 bg-red-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-red-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">+ Gasto</button>
          </div>
        ) : !loading && (
          <p className="text-xs text-gray-500 m-0">Podés ver la caja, pero no registrar movimientos en este local.</p>
        )}
      </div>
    </div>
  )
}
