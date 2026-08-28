import { describe, it, expect } from 'vitest'
import { esCajaDeHoy } from '../lib/domain/cajas'
import { aFechaISO } from '../lib/dates'

describe('esCajaDeHoy', () => {
  it('caja abierta hoy a la mañana → es de hoy', () => {
    const hoy = new Date(2026, 7, 27, 9, 0)
    const caja = { fecha_apertura: hoy.toISOString() }
    expect(esCajaDeHoy(caja, aFechaISO(hoy))).toBe(true)
  })

  it('caja abierta hoy a las 22:30 hora argentina → sigue siendo de hoy (no la corre al día siguiente por UTC)', () => {
    // Mismo caso que el "bug UTC" de calcularTotalesDia: 22:30 en UTC-3 (Argentina)
    // cae en UTC del día siguiente (01:30). Si esCajaDeHoy comparara con
    // toISOString().split('T')[0] en vez de getters locales, clasificaría esta
    // caja como huérfana un día antes de que en realidad lo sea.
    const hoyALasDiezYMedia = new Date(2026, 7, 27, 22, 30)
    const caja = { fecha_apertura: hoyALasDiezYMedia.toISOString() }
    const hoyISO = aFechaISO(hoyALasDiezYMedia) // '2026-08-27'
    expect(esCajaDeHoy(caja, hoyISO)).toBe(true)
  })

  it('caja abierta ayer → NO es de hoy (huérfana)', () => {
    const ayer = new Date(2026, 7, 26, 20, 0)
    const hoy = new Date(2026, 7, 27, 9, 0)
    const caja = { fecha_apertura: ayer.toISOString() }
    expect(esCajaDeHoy(caja, aFechaISO(hoy))).toBe(false)
  })

  it('sin caja abierta (null) → false', () => {
    expect(esCajaDeHoy(null, '2026-08-27')).toBe(false)
    expect(esCajaDeHoy(undefined, '2026-08-27')).toBe(false)
  })

  it('acepta un día de referencia que no es "hoy real" (para cerrar una huérfana con los datos de SU día)', () => {
    const diaViejo = new Date(2026, 7, 20, 11, 0)
    const caja = { fecha_apertura: diaViejo.toISOString() }
    expect(esCajaDeHoy(caja, aFechaISO(diaViejo))).toBe(true)
    expect(esCajaDeHoy(caja, '2026-08-27')).toBe(false)
  })
})
