/**
 * Reglas puras sobre límites de plan. Sin React, sin Supabase.
 * La suscripción es por CUENTA: los dos límites (equipo y locales) se
 * evalúan sobre la misma cuenta, no local por local.
 */
import { LIMITE_EQUIPO, LIMITE_LOCALES } from '../constants/planes'

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
