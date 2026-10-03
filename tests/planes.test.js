import { describe, it, expect } from 'vitest'
import {
  equipoIlimitado, superaLimiteEquipo, cupoEquipoRestante,
  localesIlimitados, superaLimiteLocales, cupoLocalesRestante,
  personasUnicas, excedeSegmento, planMinimoRequerido,
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

describe('personasUnicas — el dueño de 2 locales cuenta una sola vez', () => {
  it('deduplica por user_id entre varios locales', () => {
    const filas = [
      { local_id: 'l1', user_id: 'owner' },
      { local_id: 'l2', user_id: 'owner' },
      { local_id: 'l1', user_id: 'cajeroA' },
      { local_id: 'l2', user_id: 'cajeroB' },
    ]
    expect(personasUnicas(filas)).toBe(3) // owner, cajeroA, cajeroB
  })
  it('sin filas da 0, no rompe', () => {
    expect(personasUnicas([])).toBe(0)
    expect(personasUnicas(undefined)).toBe(0)
  })
})

describe('excedeSegmento — uso real de hoy, no "sumar uno más"', () => {
  it('Básico: 2 locales ya excede (tope 1), aunque el equipo sea de 1 sola persona', () => {
    expect(excedeSegmento(SEGMENTO.BASICO, 2, 1)).toBe(true)
  })
  it('Básico: 1 local con 2 personas excede por equipo', () => {
    expect(excedeSegmento(SEGMENTO.BASICO, 1, 2)).toBe(true)
  })
  it('Básico: 1 local y 1 persona no excede', () => {
    expect(excedeSegmento(SEGMENTO.BASICO, 1, 1)).toBe(false)
  })
  it('Negocio: no tiene límite de equipo, solo de locales', () => {
    expect(excedeSegmento(SEGMENTO.NEGOCIO, 1, 50)).toBe(false)
    expect(excedeSegmento(SEGMENTO.NEGOCIO, 2, 1)).toBe(true)
  })
  it('Multi-local: nunca excede', () => {
    expect(excedeSegmento(SEGMENTO.MULTI_LOCAL, 20, 100)).toBe(false)
  })
})

describe('planMinimoRequerido', () => {
  it('uso mínimo (1 local, 1 persona) → Básico alcanza', () => {
    expect(planMinimoRequerido(1, 1)).toBe(SEGMENTO.BASICO)
  })
  it('1 local, varias personas → Negocio', () => {
    expect(planMinimoRequerido(1, 3)).toBe(SEGMENTO.NEGOCIO)
  })
  it('2 locales, aunque el equipo sea mínimo → Multi-local (ningún otro plan cubre 2 locales)', () => {
    expect(planMinimoRequerido(2, 1)).toBe(SEGMENTO.MULTI_LOCAL)
  })
  it('el ejemplo del aviso: 2 locales y 3 personas → Multi-local', () => {
    expect(planMinimoRequerido(2, 3)).toBe(SEGMENTO.MULTI_LOCAL)
  })
})
