import { useRef, useState, useEffect, useCallback } from 'react'

/**
 * Con 5 pestañas (Resumen, Miembros, Medios de pago, Suscripción,
 * Auditoría) no entran todas en la pantalla de un celular, y el scroll
 * horizontal no se nota si no hay nada que lo sugiera — alguien puede
 * usar la app meses sin enterarse de que "Suscripción" existe, ahí
 * nomás, un dedo más allá del borde. Los degradados de los costados
 * aparecen solo cuando de verdad hay más para desplazar hacia ese lado.
 */
export default function Tabs({ tabs, activa, onChange }) {
  const scrollRef = useRef(null)
  const [puedeIzq, setPuedeIzq] = useState(false)
  const [puedeDer, setPuedeDer] = useState(false)

  const actualizarSombras = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setPuedeIzq(el.scrollLeft > 4)
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    actualizarSombras()
    window.addEventListener('resize', actualizarSombras)
    return () => window.removeEventListener('resize', actualizarSombras)
  }, [actualizarSombras, tabs])

  return (
    <div className="relative mb-4">
      <div ref={scrollRef} onScroll={actualizarSombras}
        className="flex gap-1 border-b border-gray-200 overflow-x-auto" role="tablist">
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={activa === t.id} onClick={() => onChange(t.id)}
            className={`px-4 py-2 text-sm font-semibold cursor-pointer border-none rounded-t-lg whitespace-nowrap transition-colors ${
              activa === t.id ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {puedeIzq && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-1 w-6 bg-gradient-to-r from-slate-100 to-transparent" />
      )}
      {puedeDer && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-slate-100 to-transparent" />
      )}
    </div>
  )
}
