import { claseBoton } from '../../lib/ui/estilos'

/**
 * Botón base del sistema visual. variant define el color/intención
 * (primary=navegación/acción neutral, success=cobro/abrir caja/confirmar,
 * danger=gasto/quitar/cancelar, secondary=cancelar modal, ghost=terciaria).
 * Sin prop de loading a propósito: cada pantalla ya maneja su propio texto
 * de carga ("Guardando…", "Abriendo…") — agregar un loading genérico acá
 * duplicaría esa lógica sin necesidad.
 */
export default function Button({ variant = 'primary', size = 'md', disabled, type = 'button', onClick, className = '', children, ...props }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${claseBoton({ variant, size })}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {children}
    </button>
  )
}
