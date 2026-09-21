import { describe, it, expect } from 'vitest'
import { debeAceptarTerminos } from '../lib/domain/terminos'

describe('debeAceptarTerminos', () => {
  it('nunca aceptó ninguna versión (null) → tiene que aceptar', () => {
    expect(debeAceptarTerminos(null, '2026-09-15')).toBe(true)
  })

  it('aceptó exactamente la versión vigente → no tiene que aceptar de nuevo', () => {
    expect(debeAceptarTerminos('2026-09-15', '2026-09-15')).toBe(false)
  })

  it('aceptó una versión vieja → tiene que aceptar la nueva, aunque ya hubiera aceptado antes', () => {
    expect(debeAceptarTerminos('2026-01-01', '2026-09-15')).toBe(true)
  })
})
