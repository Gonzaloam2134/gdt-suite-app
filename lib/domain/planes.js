/**
 * Reglas puras sobre límites de plan. Sin React, sin Supabase.
 * La suscripción es por CUENTA: los dos límites (equipo y locales) se
 * evalúan sobre la misma cuenta, no local por local.
 */
import { LIMITE_EQUIPO, LIMITE_LOCALES, SEGMENTO } from '../constants/planes'

const ORDEN_SEGMENTOS = [SEGMENTO.BASICO, SEGMENTO.NEGOCIO, SEGMENTO.MULTI_LOCAL]

export const equipoIlimitado = (segmento) => LIMITE_EQUIPO[segmento] === null
export const localesIlimitados = (segmento) => LIMITE_LOCALES[segmento] === null

/**
 * ¿Sumar una persona más (owner + activos) al LOCAL supera el límite del segmento?
 * @param {number} personasActivas  cuenta owner + cajeros + empleados activos de ESE local, sin la nueva
 */
export const superaLimiteEquipo = (segmento, personasActivas) => {
  const limite = LIMITE_EQUIPO[segmento]
  if (limite === null || limite === undefined) return false
  return personasActivas + 1 > limite
}

export const cupoEquipoRestante = (segmento, personasActivas) => {
  const limite = LIMITE_EQUIPO[segmento]
  if (limite === null || limite === undefined) return null
  return Math.max(0, limite - personasActivas)
}

/**
 * ¿Crear un local más supera el límite de LOCALES de la cuenta?
 * @param {number} localesActuales  cuántos locales tiene ya esa cuenta, sin el nuevo
 */
export const superaLimiteLocales = (segmento, localesActuales) => {
  const limite = LIMITE_LOCALES[segmento]
  if (limite === null || limite === undefined) return false
  return localesActuales + 1 > limite
}

export const cupoLocalesRestante = (segmento, localesActuales) => {
  const limite = LIMITE_LOCALES[segmento]
  if (limite === null || limite === undefined) return null
  return Math.max(0, limite - localesActuales)
}

/**
 * Personas únicas entre filas de miembros_locales de varios locales — el
 * dueño que opera 2 locales aparece una vez por local, pero es una sola
 * persona. Recibe las filas crudas de listarMiembrosDeLocales().
 */
export const personasUnicas = (filasMiembros) => new Set((filasMiembros || []).map(f => f.user_id)).size

/**
 * ¿El uso REAL de hoy (no "sumar uno más") ya no entra en este segmento?
 * Para avisar antes de bajar a un plan que no le alcanza — distinto de
 * superaLimiteLocales/superaLimiteEquipo, que son "¿puedo agregar uno más?".
 */
export const excedeSegmento = (segmento, localesPropios, personasActivas) => {
  const limiteLocales = LIMITE_LOCALES[segmento]
  const limiteEquipo = LIMITE_EQUIPO[segmento]
  return (limiteLocales !== null && localesPropios > limiteLocales)
    || (limiteEquipo !== null && personasActivas > limiteEquipo)
}

/** El plan más barato (de los que existen hoy) que ya alcanza para el uso real de la cuenta. */
export const planMinimoRequerido = (localesPropios, personasActivas) => {
  for (const segmento of ORDEN_SEGMENTOS) {
    if (!excedeSegmento(segmento, localesPropios, personasActivas)) return segmento
  }
  return SEGMENTO.MULTI_LOCAL
}
