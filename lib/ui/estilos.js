/**
 * Clases de Tailwind para los componentes base del sistema visual
 * (Button, StatusBadge). Separado del JSX a propósito: el proyecto no tiene
 * jsdom/testing-library (todos los tests son lógica pura, sin renderizar
 * nada) y no hace falta agregar esa dependencia solo para poder testear
 * qué clase le toca a cada variante — alcanza con probar estas funciones.
 *
 * Los nombres de clase (bg-primary-500, etc.) tienen que aparecer tal cual,
 * como string literal, en algún archivo que Tailwind escanee — por eso
 * tailwind.config.js agrega `./lib/**` a `content`. Si esto se mueve de
 * carpeta, hay que mover también esa entrada o Tailwind purga la clase.
 */

const BASE_BOTON = 'border-none rounded-lg font-bold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANTES_BOTON = {
  primary: 'bg-primary-500 text-white hover:bg-primary-600',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  success: 'bg-success-500 text-white hover:bg-success-600',
  danger: 'bg-danger-500 text-white hover:bg-danger-600',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
}

const TAMANOS_BOTON = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
}

export const claseBoton = ({ variant = 'primary', size = 'md' } = {}) =>
  [BASE_BOTON, VARIANTES_BOTON[variant] || VARIANTES_BOTON.primary, TAMANOS_BOTON[size] || TAMANOS_BOTON.md].join(' ')

const TONOS_BADGE = {
  success: 'bg-success-50 text-success-700',
  neutral: 'bg-gray-100 text-gray-600',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
}

const TONOS_DOT = {
  success: 'bg-success-500',
  neutral: 'bg-gray-400',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
}

export const claseBadge = ({ tone = 'neutral' } = {}) =>
  `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${TONOS_BADGE[tone] || TONOS_BADGE.neutral}`

export const claseDot = (tone = 'neutral') => `w-2 h-2 rounded-full shrink-0 ${TONOS_DOT[tone] || TONOS_DOT.neutral}`
