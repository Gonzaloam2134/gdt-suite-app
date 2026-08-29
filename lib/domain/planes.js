/**
 * Reglas puras sobre límites de plan. Sin React, sin Supabase.
 * El único límite que existe es el de personas operando un local; la
 * cantidad de locales nunca se limita (ver nota en lib/constants/planes).
 */
import { LIMITE_EQUIPO } from '../constants/planes'

/** true si el segmento no tiene tope de gente operando */
export const equipoIlimitado = (segmento) => LIMITE_EQUIPO[segmento] === null

/**
 * ¿Sumar una persona más (owner + activos) supera el límite del segmento?
 * @param {string} segmento
 * @param {number} personasActivas  cuenta owner + cajeros + empleados activos, SIN la nueva
 */
export const superaLimiteEquipo = (segmento, personasActivas) => {
  const limite = LIMITE_EQUIPO[segmento]
  if (limite === null || limite === undefined) return false
  return personasActivas + 1 > limite
}

/** Cuántas personas más se pueden sumar antes de tocar el límite. null = sin tope. */
export const cupoRestante = (segmento, personasActivas) => {
  const limite = LIMITE_EQUIPO[segmento]
  if (limite === null || limite === undefined) return null
  return Math.max(0, limite - personasActivas)
}

/**
 * Segmento sugerido en el checkout según cuántos locales ACTIVOS (con plan
 * pago, no en prueba) ya tiene el dueño. Es solo una sugerencia de precio,
 * nunca bloquea crear el local: el dueño puede aceptar la tarifa Multi-local
 * con descuento o pagar cada local como Básico/Negocio por separado si prefiere.
 */
export const segmentoSugerido = (cantidadLocalesPagos, segmentoElegido) => {
  if (cantidadLocalesPagos >= 1) return 'multi_local'
  return segmentoElegido
}
