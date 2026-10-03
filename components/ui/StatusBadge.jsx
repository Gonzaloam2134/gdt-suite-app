import { claseBadge, claseDot } from '../../lib/ui/estilos'

/**
 * Pastilla de estado (Activo/Pendiente/Anulado/Reversa/etc). `dot` agrega
 * el punto de color antes del texto — pulsa solo en success, que es el
 * único caso que hoy lo usa (caja abierta).
 */
export default function StatusBadge({ tone = 'neutral', label, dot = false }) {
  return (
    <span className={claseBadge({ tone })}>
      {dot && <span className={`${claseDot(tone)}${tone === 'success' ? ' animate-pulse' : ''}`} />}
      {label}
    </span>
  )
}
