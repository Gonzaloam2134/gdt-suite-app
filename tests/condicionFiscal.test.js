import { describe, it, expect } from 'vitest'
import { COMPROBANTE_POR_CONDICION, discriminaIva } from '../lib/constants/transacciones'

describe('condición fiscal del local', () => {
  it('solo las tres condiciones que la app soporta (las mismas del CHECK en la base)', () => {
    expect(Object.keys(COMPROBANTE_POR_CONDICION).sort()).toEqual(['Monotributo', 'No inscripto', 'Responsable Inscripto'])
  })

  it('"Consumidor Final" (tipo de cliente) y "Exento" (sin soporte) ya no son condiciones', () => {
    expect(COMPROBANTE_POR_CONDICION['Consumidor Final']).toBeUndefined()
    expect(COMPROBANTE_POR_CONDICION['Exento']).toBeUndefined()
  })

  it('comprobante por defecto según condición', () => {
    expect(COMPROBANTE_POR_CONDICION['Responsable Inscripto']).toBe('B')
    expect(COMPROBANTE_POR_CONDICION['Monotributo']).toBe('C')
    expect(COMPROBANTE_POR_CONDICION['No inscripto']).toBe('SIN_COMPROBANTE')
  })

  it('solo el Responsable Inscripto discrimina IVA', () => {
    expect(discriminaIva('Responsable Inscripto')).toBe(true)
    expect(discriminaIva('Monotributo')).toBe(false)
    expect(discriminaIva('No inscripto')).toBe(false)
  })
})
