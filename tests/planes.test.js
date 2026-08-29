import { describe, it, expect } from 'vitest'
import { equipoIlimitado, superaLimiteEquipo, cupoRestante, segmentoSugerido } from '../lib/domain/planes'
import { SEGMENTO } from '../lib/constants/planes'

describe('límite de equipo por segmento', () => {
  it('Básico: el dueño solo puede operar él mismo', () => {
    expect(superaLimiteEquipo(SEGMENTO.BASICO, 1)).toBe(true)    // ya está el dueño, sumar 1 más excede
    expect(cupoRestante(SEGMENTO.BASICO, 1)).toBe(0)
  })

  it('Básico recién creado (solo el dueño, activo=0 miembros contados aparte): sumar el primer cajero excede', () => {
    // personasActivas ya incluye al dueño (miembros_locales cuenta owner también)
    expect(superaLimiteEquipo(SEGMENTO.BASICO, 1)).toBe(true)
  })

  it('Negocio: sin límite, nunca bloquea', () => {
    expect(equipoIlimitado(SEGMENTO.NEGOCIO)).toBe(true)
    expect(superaLimiteEquipo(SEGMENTO.NEGOCIO, 50)).toBe(false)
    expect(cupoRestante(SEGMENTO.NEGOCIO, 50)).toBeNull()
  })

  it('Multi-local: mismo límite ilimitado que Negocio (la diferencia es el precio, no el cupo)', () => {
    expect(equipoIlimitado(SEGMENTO.MULTI_LOCAL)).toBe(true)
  })

  it('segmento desconocido (sin suscripción activa aún) no bloquea nada', () => {
    expect(superaLimiteEquipo(undefined, 10)).toBe(false)
    expect(superaLimiteEquipo(null, 10)).toBe(false)
  })
})

describe('segmentoSugerido — nunca bloquea, solo sugiere precio', () => {
  it('primer local: se respeta lo que el dueño eligió', () => {
    expect(segmentoSugerido(0, SEGMENTO.BASICO)).toBe('basico')
    expect(segmentoSugerido(0, SEGMENTO.NEGOCIO)).toBe('negocio')
  })
  it('segundo local en adelante: siempre se sugiere multi_local (con descuento)', () => {
    expect(segmentoSugerido(1, SEGMENTO.BASICO)).toBe('multi_local')
    expect(segmentoSugerido(3, SEGMENTO.NEGOCIO)).toBe('multi_local')
  })
})
