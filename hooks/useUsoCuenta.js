import { useState, useEffect } from 'react'
import { listarMiembrosDeLocales } from '../lib/services/miembros'
import { personasUnicas } from '../lib/domain/planes'
import { ROLES } from '../lib/constants/roles'

/**
 * Uso real de la cuenta hoy: cuántos locales propios tiene y cuántas
 * personas activas sumando todos esos locales (sin contar al dueño dos
 * veces si opera más de uno). Para /planes: recomendar y advertir antes
 * de pagar, no después.
 */
export function useUsoCuenta(locales) {
  const [personasActivas, setPersonasActivas] = useState(0)
  const [cargado, setCargado] = useState(false)

  const localesPropios = locales.filter(l => l.rol === ROLES.OWNER)
  const ids = localesPropios.map(l => l.id)

  useEffect(() => {
    if (!ids.length) { setPersonasActivas(0); setCargado(true); return }
    let cancelado = false
    listarMiembrosDeLocales(ids)
      .then((filas) => { if (!cancelado) setPersonasActivas(personasUnicas(filas)) })
      .catch((err) => { console.error('[useUsoCuenta]', err); if (!cancelado) setPersonasActivas(0) })
      .finally(() => { if (!cancelado) setCargado(true) })
    return () => { cancelado = true }
  }, [locales])

  return { localesPropios: localesPropios.length, personasActivas, cargado }
}
