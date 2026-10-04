import { useEffect } from 'react'

const ANCHOS = { sm: 'md:max-w-sm', md: 'md:max-w-md', lg: 'md:max-w-2xl', xl: 'md:max-w-4xl' }

/**
 * Modal base. Cierra con Escape y clic en el fondo.
 * Todos los modales de la app (apertura/cierre de caja, historial, edición de miembro…) se arman sobre este.
 *
 * Mobile (<768px): hoja inferior (bottom sheet) que sube desde abajo, con
 * safe-area. Desde md: modal centrado — nunca una hoja que sube en una
 * pantalla grande. Es solo CSS, no hay detección de dispositivo en JS.
 */
export default function Modal({ isOpen, onClose, title, subtitle, size = 'md', children, footer, headerClassName = 'bg-white text-gray-900 border-b border-gray-100' }) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 md:bg-black/50 md:backdrop-blur-sm md:p-4 animate-fade-in" onMouseDown={onClose} role="dialog" aria-modal="true">
      <div className={`bg-white w-full ${ANCHOS[size]} max-h-[92dvh] md:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[26px] md:rounded-[22px] animate-sheet-in md:animate-pop-in`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="md:hidden pt-2 flex justify-center" aria-hidden="true"><span className="w-10 h-1 rounded-full bg-gray-300" /></div>
        {title && (
          <div className={`flex items-start justify-between gap-4 px-5 py-4 ${headerClassName}`}>
            <div>
              <h2 className="text-lg font-bold m-0">{title}</h2>
              {subtitle && <p className="text-sm opacity-70 mt-1 m-0">{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="press w-9 h-9 -mr-2 -mt-1 flex items-center justify-center rounded-full text-2xl leading-none opacity-60 hover:opacity-100 hover:bg-black/5 bg-transparent border-none cursor-pointer">×</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
        {footer && <div className="border-t border-gray-100 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-3 justify-end">{footer}</div>}
      </div>
    </div>
  )
}
