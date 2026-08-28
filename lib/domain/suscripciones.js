/**
 * Estado de la suscripción, calculado en el momento a partir de lo guardado.
 * No hay ningún proceso que "pase" un local a suspendido cuando vence la
 * prueba: se calcula cada vez que se consulta, comparando fecha_vencimiento
 * contra hoy. Esto es deliberado — no depende de un cron ni de que alguien
 * corra un job; funciona desde el primer día.
 */
import { hoyISO } from '../dates'

export const PLAN = Object.freeze({
  PRUEBA: 'trial',
  GRATIS: 'free',
  PAGO: 'pago',
})

const num = (v) => (v === null || v === undefined ? null : Number(v))

/**
 * Días que quedan de la fecha de vencimiento, contando hoy. Negativo si ya venció.
 * @param {string} fechaVencimiento  'YYYY-MM-DD'
 */
export const diasHastaVencer = (fechaVencimiento, hoy = hoyISO()) => {
  if (!fechaVencimiento) return null
  const [ay, am, ad] = hoy.split('-').map(Number)
  const [by, bm, bd] = fechaVencimiento.split('-').map(Number)
  const a = Date.UTC(ay, am - 1, ad)
  const b = Date.UTC(by, bm - 1, bd)
  return Math.round((b - a) / 86400000)
}

/**
 * Estado efectivo de una suscripción: lo que guarda la fila, salvo que sea una
 * prueba activa cuya fecha ya pasó. Nunca escribe nada: es una lectura derivada.
 *
 * Una prueba vencida cae en 'restricted', NO en 'suspended': el dueño tiene que
 * poder entrar a Reportes y exportar sus datos aunque no siga usando la app.
 * 'suspended' (acceso total bloqueado) queda reservado para lo que decide un
 * humano — falta de pago confirmada, cuenta dada de baja — nunca para el mero
 * paso del tiempo.
 *
 * @returns {{ estado: 'active'|'restricted'|'suspended'|'cancelled', vencioPrueba: boolean, diasRestantes: number|null }}
 */
export const estadoEfectivo = (suscripcion, hoy = hoyISO()) => {
  if (!suscripcion) return { estado: 'active', vencioPrueba: false, diasRestantes: null }

  const dias = diasHastaVencer(suscripcion.fecha_vencimiento, hoy)
  const esPrueba = suscripcion.plan === PLAN.PRUEBA
  const venciendoAhora = esPrueba && suscripcion.estado === 'active' && dias !== null && dias < 0

  return {
    estado: venciendoAhora ? 'restricted' : suscripcion.estado,
    vencioPrueba: venciendoAhora,
    diasRestantes: esPrueba ? dias : null,
  }
}

/** true si conviene avisar "te quedan pocos días" (prueba activa, 7 días o menos, sin vencer todavía) */
export const debeAvisarProntoAVencer = ({ estado, vencioPrueba, diasRestantes }) =>
  estado === 'active' && !vencioPrueba && diasRestantes !== null && diasRestantes <= 7
