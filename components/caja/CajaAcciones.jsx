import RoleGate from '../RoleGate'
import { ROLES_OPERAN_CAJA } from '../../lib/constants/roles'

/** Barra de acciones del día. Solo owner y cajero operan la caja (coincide con la RLS). */
export default function CajaAcciones({ cajaAbierta, onAbrir, onCerrar, onHistorial, onCobro, onGasto }) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RoleGate allowedRoles={ROLES_OPERAN_CAJA}>
            {cajaAbierta
              ? <button onClick={onCerrar} className="px-3 py-2 bg-orange-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-orange-600 shadow-sm">🔒 Cerrar</button>
              : <button onClick={onAbrir} className="px-3 py-2 bg-emerald-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-600 shadow-sm">🔓 Abrir</button>}
          </RoleGate>
          <button onClick={onHistorial} title="Historial de cierres"
            className="px-3 py-2 bg-indigo-100 text-indigo-700 border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-indigo-200">
            📋 <span className="hidden md:inline">Historial</span>
          </button>
        </div>

        <RoleGate allowedRoles={ROLES_OPERAN_CAJA}>
          <div className="flex items-center gap-2">
            <button onClick={onCobro} disabled={!cajaAbierta} title={cajaAbierta ? '' : 'Abrí la caja para registrar cobros'}
              className="px-4 py-2 bg-green-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-green-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">+ Cobro</button>
            <button onClick={onGasto} disabled={!cajaAbierta} title={cajaAbierta ? '' : 'Abrí la caja para registrar gastos'}
              className="px-4 py-2 bg-red-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-red-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">+ Gasto</button>
          </div>
        </RoleGate>
      </div>
    </div>
  )
}
