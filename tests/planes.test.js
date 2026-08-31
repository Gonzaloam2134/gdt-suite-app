import { describe, it, expect } from 'vitest'
import {
  equipoIlimitado, superaLimiteEquipo, cupoEquipoRestante,
  localesIlimitados, superaLimiteLocales, cupoLocalesRestante,
} from '../lib/domain/planes'
import { SEGMENTO } from '../lib/constants/planes'

describe('límite de equipo (por local)', () => {
  it('Básico: el dueño solo puede operar él mismo', () => {
    expect(superaLimiteEquipo(SEGMENTO.BASICO, 1)).toBe(true)
    expect(cupoEquipoRestante(SEGMENTO.BASICO, 1)).toBe(0)
  })
  it('Negocio: sin límite', () => {
    expect(equipoIlimitado(SEGMENTO.NEGOCIO)).toBe(true)
    expect(superaLimiteEquipo(SEGMENTO.NEGOCIO, 50)).toBe(false)
  })
  it('Multi-local: sin límite de equipo tampoco', () => {
    expect(equipoIlimitado(SEGMENTO.MULTI_LOCAL)).toBe(true)
  })
  it('sin segmento (prueba, o sin cuenta paga aún) no bloquea nada', () => {
    expect(superaLimiteEquipo(undefined, 10)).toBe(false)
    expect(superaLimiteEquipo(null, 10)).toBe(false)
  })
})

describe('límite de locales (por cuenta) — Multi-local es el único que lo levanta', () => {
  it('Básico: un solo local', () => {
    expect(localesIlimitados(SEGMENTO.BASICO)).toBe(false)
    expect(superaLimiteLocales(SEGMENTO.BASICO, 1)).toBe(true)
    expect(cupoLocalesRestante(SEGMENTO.BASICO, 1)).toBe(0)
  })
  it('Negocio: también un solo local — el equipo no viene con más locales', () => {
    expect(localesIlimitados(SEGMENTO.NEGOCIO)).toBe(false)
    expect(superaLimiteLocales(SEGMENTO.NEGOCIO, 1)).toBe(true)
  })
  it('Multi-local: sin límite, nunca bloquea abrir otro', () => {
    expect(localesIlimitados(SEGMENTO.MULTI_LOCAL)).toBe(true)
    expect(superaLimiteLocales(SEGMENTO.MULTI_LOCAL, 20)).toBe(false)
  })
  it('el primer local nunca se bloquea, sea cual sea el segmento', () => {
    expect(superaLimiteLocales(SEGMENTO.BASICO, 0)).toBe(false)
    expect(superaLimiteLocales(SEGMENTO.NEGOCIO, 0)).toBe(false)
  })
  it('durante la prueba (sin segmento todavía) nunca bloquea', () => {
    expect(superaLimiteLocales(undefined, 5)).toBe(false)
  })
})
