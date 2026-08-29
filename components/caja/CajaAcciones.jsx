import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES_OPERAN_CAJA, ROLES_REGISTRAN_COBRO } from '../../lib/constants/roles'

/**
 * Barra de acciones del día.
 * - Owner y cajero: abren/cierran caja, cargan cobros y gastos.
 * - Empleado: solo carga cobros (ej. vendedor de mostrador). No abre ni
 *   cierra caja, no paga gastos — eso lo maneja quien tiene el cajón.
 * Si el usuario no puede hacer nada acá, lo decimos: una barra vacía no explica nada.
 */
export default function CajaAcciones({ cajaAbierta, huerfana, onAbrir, onCerrar, onHistorial, onCobro, onGasto }) {
  const { hasRole, loading } = useUserRole()
  const puedeOperar = hasRole(ROLES_OPERAN_CAJA)
  const puedeCobrar = hasRole(ROLES_REGISTRAN_COBRO)

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

        {puedeCobrar ? (
          <div className="flex items-center gap-2">
            <button onClick={onCobro} disabled={!cajaAbierta} title={cajaAbierta ? '' : 'Falta que abran la caja para registrar cobros'}
              className="px-4 py-2 bg-green-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-green-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">+ Cobro</button>
            {puedeOperar && (
              <button onClick={onGasto} disabled={!cajaAbierta} title={cajaAbierta ? '' : 'Abrí la caja para registrar gastos'}
                className="px-4 py-2 bg-red-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-red-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">+ Gasto</button>
            )}
          </div>
        ) : !loading && (
          <p className="text-xs text-gray-500 m-0">Podés ver la caja, pero no registrar movimientos en este local.</p>
        )}
      </div>
    </div>
  )
}
