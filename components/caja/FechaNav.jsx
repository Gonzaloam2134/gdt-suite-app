import { aFechaISO, desdeFechaISO, hoyISO, sumarDias } from '../../lib/dates'
import { formatFechaLarga } from '../../lib/format'

export const DIAS_ATRAS_MAX = 3

const Flecha = ({ onClick, disabled, label, children }) => (
  <button onClick={onClick} disabled={disabled} aria-label={label}
    className="press w-11 h-11 flex items-center justify-center rounded-full bg-white border border-black/5 shadow-suave text-xl text-gray-700 cursor-pointer hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
    {children}
  </button>
)

/**
 * Navegación de fecha de la caja: hasta 3 días hacia atrás, nunca al futuro.
 * Las fechas salen de lib/dates (hora local), no de toISOString.
 */
export default function FechaNav({ fechaISO, onCambiar }) {
  const hoy = hoyISO()
  const minimo = aFechaISO(sumarDias(desdeFechaISO(hoy), -DIAS_ATRAS_MAX))
  const mover = (dias) => onCambiar(aFechaISO(sumarDias(desdeFechaISO(fechaISO), dias)))
  const esHoyVista = fechaISO === hoy

  return (
    <div className="flex items-center justify-between gap-3">
      <Flecha onClick={() => mover(-1)} disabled={fechaISO <= minimo} label="Día anterior">‹</Flecha>
      <div className="text-center min-w-0">
        <p className="m-0 text-base font-bold text-gray-900 capitalize truncate">{formatFechaLarga(fechaISO + 'T12:00:00')}</p>
        <p className="m-0 text-xs text-gray-500">{esHoyVista ? 'Hoy' : 'Solo lectura'}</p>
      </div>
      <Flecha onClick={() => mover(1)} disabled={fechaISO >= hoy} label="Día siguiente">›</Flecha>
    </div>
  )
}
