import { useRef, useState, useEffect, useCallback } from 'react'

/**
 * Con 5 pestañas (Resumen, Miembros, Medios de pago, Suscripción,
 * Auditoría) no entran todas en la pantalla de un celular. Antes había
 * solo un degradado sutil en el borde — en mobile pasaba desapercibido
 * (mismo color que el fondo, muy angosto). Ahora son flechas de verdad,
 * con su propio círculo blanco y sombra, que además de avisar que hay
 * más para ver, sirven para tocarlas y desplazarse — mejor que arrastrar
 * con el dedo en una tira angosta.
 */
export default function Tabs({ tabs, activa, onChange }) {
  const scrollRef = useRef(null)
  const [puedeIzq, setPuedeIzq] = useState(false)
  const [puedeDer, setPuedeDer] = useState(false)

  const actualizarFlechas = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setPuedeIzq(el.scrollLeft > 4)
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    actualizarFlechas()
    // Un segundo chequeo un instante después del primer render: en algunos
    // navegadores mobile el ancho real de las pestañas todavía no está
    // asentado en el primer paint (emoji + fuentes del sistema).
    const t = setTimeout(actualizarFlechas, 150)
    window.addEventListener('resize', actualizarFlechas)
    return () => { clearTimeout(t); window.removeEventListener('resize', actualizarFlechas) }
  }, [actualizarFlechas, tabs])

  const desplazar = (dir) => scrollRef.current?.scrollBy({ left: dir * 140, behavior: 'smooth' })

  return (
    <div className="relative mb-4">
      <div ref={scrollRef} onScroll={actualizarFlechas}
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
        <button type="button" aria-label="Ver pestañas anteriores" onClick={() => desplazar(-1)}
          className="absolute left-0 top-0 bottom-1 flex items-center pl-0.5 pr-3 border-none cursor-pointer bg-gradient-to-r from-slate-100 via-slate-100 to-transparent">
          <span className="w-6 h-6 rounded-full bg-white shadow border border-gray-300 flex items-center justify-center text-gray-600 text-sm leading-none">‹</span>
        </button>
      )}
      {puedeDer && (
        <button type="button" aria-label="Ver más pestañas" onClick={() => desplazar(1)}
          className="absolute right-0 top-0 bottom-1 flex items-center pr-0.5 pl-3 border-none cursor-pointer bg-gradient-to-l from-slate-100 via-slate-100 to-transparent">
          <span className="w-6 h-6 rounded-full bg-white shadow border border-gray-300 flex items-center justify-center text-gray-600 text-sm leading-none">›</span>
        </button>
      )}
    </div>
  )
}
