import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES_OPERAN_CAJA, ROLES_REGISTRAN_COBRO } from '../../lib/constants/roles'

/**
 * Botones grandes de Cobro/Gasto (solo con la caja abierta, hoy).
 * - Owner y cajero: cargan cobros y gastos.
 * - Empleado: solo carga cobros (ej. vendedor de mostrador).
 * Si el usuario no puede hacer nada acá, lo decimos: un hueco vacío no explica nada.
 */
export default function CajaAcciones({ onCobro, onGasto }) {
  const { hasRole, loading } = useUserRole()
  const puedeOperar = hasRole(ROLES_OPERAN_CAJA)
  const puedeCobrar = hasRole(ROLES_REGISTRAN_COBRO)

  if (!puedeCobrar) {
    return loading ? null : <p className="text-xs text-gray-500 m-0 text-center">Podés ver la caja, pero no registrar movimientos en este local.</p>
  }

  return (
    <div className={`grid gap-3 ${puedeOperar ? 'grid-cols-2' : 'grid-cols-1'}`}>
      <button onClick={onCobro}
        className={`press rounded-[20px] bg-success-700 text-white font-bold border-none cursor-pointer shadow-suave hover:bg-success-800 ${puedeOperar ? 'min-h-[64px] text-lg' : 'min-h-[88px] text-2xl'}`}>
        Cobrar
      </button>
      {puedeOperar && (
        <button onClick={onGasto}
          className="press min-h-[64px] rounded-[20px] bg-white text-danger-700 text-lg font-bold border-2 border-danger-600/30 cursor-pointer shadow-suave hover:bg-danger-50">
          + Gasto
        </button>
      )}
    </div>
  )
}
