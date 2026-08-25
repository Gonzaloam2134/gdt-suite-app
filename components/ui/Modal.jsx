import { useEffect } from 'react'

const ANCHOS = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }

/**
 * Modal base. Cierra con Escape y clic en el fondo.
 * Todos los modales de la app (apertura/cierre de caja, historial, edición de miembro…) se arman sobre este.
 */
export default function Modal({ isOpen, onClose, title, subtitle, size = 'md', children, footer, headerClassName = 'bg-slate-800 text-white' }) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={onClose} role="dialog" aria-modal="true">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${ANCHOS[size]} max-h-[90vh] flex flex-col overflow-hidden`} onMouseDown={(e) => e.stopPropagation()}>
        {title && (
          <div className={`flex items-start justify-between gap-4 p-5 ${headerClassName}`}>
            <div>
              <h2 className="text-lg font-bold m-0">{title}</h2>
              {subtitle && <p className="text-sm opacity-80 mt-1 m-0">{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="text-2xl leading-none opacity-70 hover:opacity-100 bg-transparent border-none cursor-pointer">×</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-gray-200 p-4 flex gap-3 justify-end">{footer}</div>}
      </div>
    </div>
  )
}
