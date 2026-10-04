import { useState } from 'react'

const ANCHO = 320
const ALTO = 64
const PAD = 4

/**
 * Sparkline de una sola serie: trazo fino, verde de marca, sin grilla, sin
 * ejes ni etiquetas por punto. Solo marca el último punto; al pasar el mouse
 * o deslizar el dedo, `onActivo` informa qué punto se está mirando.
 */
export default function Sparkline({ puntos, onActivo, etiqueta }) {
  const [activo, setActivo] = useState(null)
  if (puntos.length < 2) return null

  const max = Math.max(...puntos, 1)
  const x = (i) => PAD + (i / (puntos.length - 1)) * (ANCHO - PAD * 2)
  const y = (v) => ALTO - PAD - (v / max) * (ALTO - PAD * 2)
  const trazo = puntos.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const marcado = activo ?? puntos.length - 1

  const mover = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / r.width) * (puntos.length - 1))
    const idx = Math.min(puntos.length - 1, Math.max(0, i))
    setActivo(idx); onActivo?.(idx)
  }
  const soltar = () => { setActivo(null); onActivo?.(null) }

  // El SVG se estira al ancho (preserveAspectRatio="none"); el punto va como
  // elemento HTML aparte para que no se deforme.
  return (
    <div className="relative h-16" style={{ touchAction: 'pan-y' }}
      onPointerMove={mover} onPointerDown={mover} onPointerLeave={soltar} onPointerUp={(e) => e.pointerType !== 'mouse' && soltar()}>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="none" className="w-full h-full block" role="img" aria-label={etiqueta}>
        <path d={trazo} fill="none" stroke="#019c62" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span aria-hidden="true" className="absolute w-2.5 h-2.5 -ml-[5px] -mt-[5px] rounded-full bg-primary-500 border-2 border-white pointer-events-none"
        style={{ left: `${(x(marcado) / ANCHO) * 100}%`, top: `${(y(puntos[marcado]) / ALTO) * 100}%` }} />
    </div>
  )
}
