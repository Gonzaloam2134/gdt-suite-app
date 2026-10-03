import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES_OPERAN_CAJA, ROLES_REGISTRAN_COBRO } from '../../lib/constants/roles'
import Button from '../ui/Button'

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
            ? <Button variant="danger" size="sm" onClick={onCerrar}>🔒 Cerrar caja</Button>
            : <Button variant="success" size="sm" onClick={onAbrir} disabled={!!huerfana}
                title={huerfana ? 'Cerrá la caja anterior antes de abrir la de hoy' : ''}>🔓 Abrir caja</Button>)}
          <Button variant="ghost" size="sm" onClick={onHistorial} title="Historial de cierres">
            📋 <span className="hidden md:inline">Historial</span>
          </Button>
        </div>

        {puedeCobrar ? (
          <div className="flex items-center gap-2">
            <Button variant="success" onClick={onCobro} disabled={!cajaAbierta}
              title={cajaAbierta ? '' : 'Falta que abran la caja para registrar cobros'}>+ Cobro</Button>
            {puedeOperar && (
              <Button variant="danger" onClick={onGasto} disabled={!cajaAbierta}
                title={cajaAbierta ? '' : 'Abrí la caja para registrar gastos'}>+ Gasto</Button>
            )}
          </div>
        ) : !loading && (
          <p className="text-xs text-gray-500 m-0">Podés ver la caja, pero no registrar movimientos en este local.</p>
        )}
      </div>
    </div>
  )
}
