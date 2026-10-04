/**
 * Interruptor accesible (role="switch"). Área táctil de 44px aunque el
 * dibujo sea más chico; responde al pointer-down con el mismo scale 0.97.
 */
export default function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className="press shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center bg-transparent border-none cursor-pointer disabled:opacity-50">
      <span className={`relative block w-11 h-6 rounded-full transition-colors duration-150 ${checked ? 'bg-primary-500' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-150 ease-out ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}
