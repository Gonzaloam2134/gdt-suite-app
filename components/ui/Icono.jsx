/**
 * Set de íconos propio, de la misma familia que public/logo-mark.svg:
 * formas macizas y redondeadas (rect con esquinas generosas, círculos),
 * recortes tipo "pantalla" como el de la caja registradora y un segundo tono
 * (opacity) como el techo del logo. Grilla de 24px. Todo en currentColor:
 * heredan el color activo/inactivo del componente que los usa.
 *
 * Un ícono por concepto: se reutilizan por nombre donde se repita el concepto.
 */

// Rect redondeado como path, para poder recortarlo con fill-rule="evenodd".
const rr = (x, y, w, h, r) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`

const Recortado = ({ d }) => <path fillRule="evenodd" d={d} />
const Suave = (props) => <path opacity=".5" {...props} />

const DIBUJOS = {
  // Local / inicio: toldo + frente con puerta
  inicio: <>
    <rect x="3" y="4" width="18" height="5.5" rx="2.2" opacity=".5" />
    <Recortado d={`${rr(5, 9.5, 14, 10.5, 3)}${rr(10, 14, 4, 6, 1.5)}`} />
  </>,
  // Caja: la caja registradora del logo
  caja: <>
    <path opacity=".5" d="M7.5 9.5 9 5.6Q9.4 4.5 10.5 4.5h3q1.1 0 1.5 1.1l1.5 3.9Z" />
    <Recortado d={`${rr(4, 9.5, 16, 11, 3.5)}${rr(7, 12.2, 10, 4, 1.5)}`} />
  </>,
  reportes: <>
    <path opacity=".5" d={rr(4, 11.5, 4.6, 8.5, 1.6)} />
    <path d={rr(9.7, 4.5, 4.6, 15.5, 1.6)} />
    <path opacity=".5" d={rr(15.4, 8.5, 4.6, 11.5, 1.6)} />
  </>,
  // Admin: controles deslizantes
  admin: <>
    <path opacity=".5" d={rr(3, 5.5, 18, 3.2, 1.6)} />
    <path opacity=".5" d={rr(3, 15.3, 18, 3.2, 1.6)} />
    <circle cx="8.5" cy="7.1" r="3.4" />
    <circle cx="15.5" cy="16.9" r="3.4" />
  </>,
  cuenta: <>
    <circle cx="12" cy="8" r="4.2" />
    <path d="M4.5 19.4Q4.5 14 12 14t7.5 5.4q0 1.1-1.1 1.1H5.6q-1.1 0-1.1-1.1Z" />
  </>,
  equipo: <>
    <circle cx="16.5" cy="8.5" r="3" opacity=".5" />
    <path opacity=".5" d="M13.5 14.4q1-.4 3-.4 4.2 0 4.2 4.6 0 1-1 1h-4.7Z" />
    <circle cx="9" cy="9" r="3.6" />
    <path d="M2.5 19.2Q2.5 14.2 9 14.2t6.5 5q0 1.3-1.3 1.3H3.8q-1.3 0-1.3-1.3Z" />
  </>,
  tarjeta: <>
    <path opacity=".5" d={rr(3, 5.5, 18, 13, 3.5)} />
    <rect x="3" y="8.8" width="18" height="3" />
    <rect x="6" y="14.2" width="5.5" height="2" rx="1" />
  </>,
  historial: <>
    <path opacity=".5" d={rr(9, 2.5, 6, 3.5, 1.6)} />
    <Recortado d={`${rr(5, 4.5, 14, 16.5, 3.5)}${rr(8.4, 9, 7.2, 1.8, 0.9)}${rr(8.4, 12.5, 7.2, 1.8, 0.9)}${rr(8.4, 16, 4.6, 1.8, 0.9)}`} />
  </>,
  // Instalar: celular con flecha hacia abajo recortada
  instalar: <Recortado d={`${rr(6.5, 3, 11, 18, 3.2)}M10.9 6.8h2.2v4.6h2.1L12 15 8.8 11.4h2.1Z${rr(9.8, 17.2, 4.4, 1.6, 0.8)}`} />,
  novedades: <>
    <path d="M3.5 10.2q0-1.2 1.2-1.2H8l8-4.2q1.5-.7 1.5.9v12.6q0 1.6-1.5.9L8 15H4.7q-1.2 0-1.2-1.2Z" />
    <path opacity=".5" d={rr(6.5, 15, 3.6, 5.5, 1.5)} />
    <path opacity=".5" d={rr(19, 10.4, 2, 3.2, 1)} />
  </>,
  global: <>
    <circle cx="12" cy="12" r="9" opacity=".5" />
    <ellipse cx="12" cy="12" rx="3.6" ry="9" />
    <rect x="3" y="11" width="18" height="2" rx="1" />
  </>,
  recibo: <Recortado d={`M6.5 3.5h11q1.5 0 1.5 1.5v15.7l-2.4-1.5-2.3 1.5-2.3-1.5-2.3 1.5-2.3-1.5-2.4 1.5V5q0-1.5 1.5-1.5Z${rr(8, 8, 8, 1.8, 0.9)}${rr(8, 11.5, 8, 1.8, 0.9)}${rr(8, 15, 5, 1.8, 0.9)}`} />,
  vacio: <>
    <path opacity=".5" d={rr(6, 3.5, 12, 7, 2.2)} />
    <Recortado d={`${rr(3, 10, 18, 10.5, 3.5)}${rr(8, 13.4, 8, 2.2, 1.1)}`} />
  </>,
  salir: <>
    <path d={rr(4, 3.5, 10, 17, 3)} />
    <path d="M15.2 8.6 20 12l-4.8 3.4v-2.2H11v-2.4h4.2Z" />
  </>,
  mail: <Recortado d={`${rr(3, 5.5, 18, 13, 3.5)}M5.8 9l1.1-1.3L12 11.6l5.1-3.9L18.2 9 12 13.8Z`} />,
}

export const tieneIcono = (nombre) => Object.prototype.hasOwnProperty.call(DIBUJOS, nombre)

export default function Icono({ nombre, size = 24, className = '' }) {
  if (!tieneIcono(nombre)) return null
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      {DIBUJOS[nombre]}
    </svg>
  )
}
