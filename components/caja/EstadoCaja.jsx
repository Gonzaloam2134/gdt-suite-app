import { formatHora, formatCurrency } from '../../lib/format'
import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES_OPERAN_CAJA } from '../../lib/constants/roles'
import Button from '../ui/Button'
import StatusBadge from '../ui/StatusBadge'

/**
 * Fila de estado de caja, siempre visible: dice si está abierta (y desde
 * cuándo) y trae el botón para abrirla o cerrarla. Solo quien opera caja
 * (dueño/cajero) ve el botón.
 */
export default function EstadoCaja({ cajaAbierta, huerfana, onAbrir, onCerrar, onHistorial, onAyuda, onEditarInicial }) {
  const { hasRole } = useUserRole()
  const puedeOperar = hasRole(ROLES_OPERAN_CAJA)

  return (
    <section className="bg-white rounded-[20px] border border-black/5 shadow-suave p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {cajaAbierta
            ? <StatusBadge tone="success" dot label={`Caja abierta desde las ${formatHora(cajaAbierta.fecha_apertura)}`} />
            : <StatusBadge tone="warning" label="Caja cerrada" />}
          {cajaAbierta && (
            <p className="m-0 mt-1.5 text-xs text-gray-500">
              Inicial {formatCurrency(cajaAbierta.monto_inicial_efectivo)}
              {puedeOperar && (
                <button onClick={onEditarInicial}
                  className="ml-2 text-primary-700 font-semibold bg-transparent border-none cursor-pointer hover:underline p-0 text-xs">
                  ¿Te equivocaste?
                </button>
              )}
            </p>
          )}
        </div>

        {puedeOperar && (cajaAbierta
          ? <Button variant="danger" onClick={onCerrar} className="!rounded-[14px] min-h-[44px]">Cerrar caja</Button>
          : <Button variant="success" onClick={onAbrir} disabled={!!huerfana} className="!rounded-[14px] min-h-[44px]"
              title={huerfana ? 'Cerrá la caja anterior antes de abrir la de hoy' : ''}>Abrir caja</Button>)}
      </div>

      <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
        <button onClick={onHistorial} className="text-xs font-semibold text-gray-600 bg-transparent border-none cursor-pointer hover:underline p-0">📋 Historial de cierres</button>
        <button onClick={onAyuda} className="text-xs font-semibold text-gray-600 bg-transparent border-none cursor-pointer hover:underline p-0">Ayuda</button>
      </div>
    </section>
  )
}
