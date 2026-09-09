import { useState } from 'react'
import toast from 'react-hot-toast'
import { usePendientesSinAsignar } from '../../hooks/usePendientesMp'
import { formatCurrency, formatFecha } from '../../lib/format'
import { mensajeError } from '../../lib/errorMessage'

const LABEL_ORIGEN = { qr: '📱 QR', point: '💳 Point', transferencia: '🏦 Transferencia' }

/**
 * Fase D del plan: transferencias (y algún Point sin resolver) que
 * llegaron a la cuenta de Mercado Pago pero no se pudieron asignar solas a
 * ningún local — pasa siempre que el dueño tiene más de un local en la
 * misma cuenta (con uno solo, se autocompleta y nunca aparecen acá). El
 * dueño elige a mano a qué local corresponde cada una; confirmarla como
 * venta real se sigue haciendo después, desde "Por confirmar" en la caja
 * de ESE local — acá solo se resuelve la asignación.
 *
 * `ownerId` es el dueño DEL LOCAL que se está administrando (local.creado_por),
 * no necesariamente quien está mirando la pantalla — así funciona igual si
 * un super admin entra a administrar el local de otra persona. `locales` sí
 * viene de los locales del usuario logueado (useMisLocales): para el dueño
 * real coincide siempre (ver CLAUDE.md, mismo rol en todos sus locales); si
 * es un super admin navegando el local de otro dueño, el desplegable puede
 * quedar vacío — caso raro, no cubierto todavía.
 */
export default function PendientesMpSinAsignar({ ownerId, locales }) {
  const { pendientes, loading, asignar } = usePendientesSinAsignar(ownerId)
  const [asignando, setAsignando] = useState(null) // id del pendiente en curso

  if (loading || pendientes.length === 0) return null

  const localesPropios = locales.filter((l) => l.rol === 'owner')

  const elegirLocal = async (pendienteId, localId) => {
    if (!localId) return
    setAsignando(pendienteId)
    try {
      await asignar(pendienteId, localId)
      toast.success('Asignado — confirmalo desde la caja de ese local')
    } catch (err) {
      toast.error(`No se pudo asignar: ${mensajeError(err)}`)
    } finally {
      setAsignando(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden mt-4">
      <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200">
        <h3 className="text-sm font-bold text-amber-900 m-0">🔔 Sin asignar a ningún local ({pendientes.length})</h3>
        <p className="text-xs text-amber-700 m-0">
          Detectamos la mayoría de las transferencias automáticamente (no es instantáneo ni 100% garantizado).
          Estas llegaron pero no se sabe a qué local corresponden — elegilo vos.
        </p>
      </div>
      <ul className="divide-y divide-gray-100 m-0 p-0 list-none">
        {pendientes.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">{formatCurrency(Number(p.monto))}</div>
              <div className="text-xs text-gray-500 truncate">
                {LABEL_ORIGEN[p.origen] || p.origen} · {formatFecha(p.fecha_mp)}
                {p.descripcion ? ` · ${p.descripcion}` : ''}
              </div>
            </div>
            <select defaultValue="" disabled={asignando === p.id}
              onChange={(e) => elegirLocal(p.id, e.target.value)}
              className="shrink-0 p-2 border border-gray-200 rounded-lg text-xs">
              <option value="" disabled>¿Qué local?</option>
              {localesPropios.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </div>
  )
}
