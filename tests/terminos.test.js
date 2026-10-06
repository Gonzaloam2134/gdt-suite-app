import { describe, it, expect } from 'vitest'
import { debeAceptarTerminos, resolverTerminosVigentes } from '../lib/domain/terminos'

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

describe('resolverTerminosVigentes', () => {
  const defaults = { texto: 'default texto', version: '2026-09-15' }

  it('configuracion_global sin editar (null) → usa el default hardcodeado', () => {
    expect(resolverTerminosVigentes({ terminos_texto: null, terminos_version: null }, defaults))
      .toEqual(defaults)
  })

  it('sin fila de configuración (undefined) → usa el default hardcodeado', () => {
    expect(resolverTerminosVigentes(undefined, defaults)).toEqual(defaults)
  })

  it('super admin ya editó los términos → usa lo guardado, no el default', () => {
    expect(resolverTerminosVigentes({ terminos_texto: 'texto nuevo', terminos_version: '2026-10-06' }, defaults))
      .toEqual({ texto: 'texto nuevo', version: '2026-10-06' })
  })

  it('texto vacío ("") se trata como no editado → cae al default, nunca texto vacío', () => {
    expect(resolverTerminosVigentes({ terminos_texto: '', terminos_version: '2026-10-06' }, defaults).texto)
      .toBe(defaults.texto)
  })
})
