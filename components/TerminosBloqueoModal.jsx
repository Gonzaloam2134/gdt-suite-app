import { useState } from 'react'

/**
 * A diferencia de components/ui/Modal.jsx, este NO se puede cerrar sin
 * aceptar: no hay botón de cerrar, ni click-outside, ni Escape. Se muestra
 * cuando useTerminosGuard dice que hay que aceptar — mientras tanto, la
 * pantalla de atrás no se renderiza (ver pages que lo usan).
 */
export default function TerminosBloqueoModal({ isOpen, onAceptar }) {
  const [aceptando, setAceptando] = useState(false)

  if (!isOpen) return null

  const confirmar = async () => {
    setAceptando(true)
    try {
      await onAceptar()
    } finally {
      setAceptando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 bg-slate-800 text-white">
          <h2 className="text-lg font-bold m-0">Actualizamos los Términos y Condiciones</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-sm text-gray-700 m-0">
            Para seguir usando GDT Suite necesitamos que aceptes la versión vigente de los
            Términos y Condiciones. Podés leerlos enteros antes de aceptar.
          </p>
          <a href="/terminos" target="_blank" rel="noopener noreferrer"
            className="inline-block mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 underline">
            Leer los Términos y Condiciones completos →
          </a>
        </div>
        <div className="border-t border-gray-200 p-4">
          <button onClick={confirmar} disabled={aceptando}
            className="w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 disabled:opacity-50">
            {aceptando ? 'Guardando…' : 'Acepto los Términos y Condiciones'}
          </button>
        </div>
      </div>
    </div>
  )
}
