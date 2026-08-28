import { describe, it, expect } from 'vitest'
import { diasHastaVencer, estadoEfectivo, debeAvisarProntoAVencer, PLAN } from '../lib/domain/suscripciones'

describe('diasHastaVencer', () => {
  it('positivo cuando falta para vencer', () => {
    expect(diasHastaVencer('2026-09-05', '2026-08-28')).toBe(8)
  })
  it('cero el mismo día', () => {
    expect(diasHastaVencer('2026-08-28', '2026-08-28')).toBe(0)
  })
  it('negativo cuando ya venció', () => {
    expect(diasHastaVencer('2026-08-20', '2026-08-28')).toBe(-8)
  })
  it('cruza de mes correctamente', () => {
    expect(diasHastaVencer('2026-09-02', '2026-08-28')).toBe(5)
  })
})

describe('estadoEfectivo — sin suscripción', () => {
  it('sin fila se trata como activa (local recién creado, aún sin escribir la fila)', () => {
    expect(estadoEfectivo(null)).toEqual({ estado: 'active', vencioPrueba: false, diasRestantes: null })
  })
})

describe('estadoEfectivo — prueba gratuita', () => {
  const prueba = (venc, hoy) => ({ plan: PLAN.PRUEBA, estado: 'active', fecha_vencimiento: venc })

  it('prueba vigente: sigue activa, informa días restantes', () => {
    const r = estadoEfectivo(prueba('2026-09-15'), '2026-08-28')
    expect(r).toEqual({ estado: 'active', vencioPrueba: false, diasRestantes: 18 })
  })

  it('prueba que vence HOY: todavía activa (no se corta a mitad del último día)', () => {
    const r = estadoEfectivo(prueba('2026-08-28'), '2026-08-28')
    expect(r.estado).toBe('active')
    expect(r.diasRestantes).toBe(0)
  })

  it('prueba vencida AYER: se trata como suspendida, marcada como vencimiento de prueba', () => {
    const r = estadoEfectivo(prueba('2026-08-27'), '2026-08-28')
    expect(r.estado).toBe('suspended')
    expect(r.vencioPrueba).toBe(true)
  })

  it('una prueba que el super admin ya suspendió a mano no se reescribe como "vencioPrueba"', () => {
    const r = estadoEfectivo({ plan: PLAN.PRUEBA, estado: 'suspended', fecha_vencimiento: '2026-09-15' }, '2026-08-28')
    expect(r.estado).toBe('suspended')
    expect(r.vencioPrueba).toBe(false)   // no fue el vencimiento, fue una decisión manual
  })
})

describe('estadoEfectivo — planes pagos y free', () => {
  it('un plan pago vencido NO se autosuspende (eso lo decide el cobro, no la fecha)', () => {
    const r = estadoEfectivo({ plan: PLAN.PAGO, estado: 'active', fecha_vencimiento: '2026-01-01' }, '2026-08-28')
    expect(r.estado).toBe('active')
    expect(r.vencioPrueba).toBe(false)
  })

  it('un plan free con fecha vieja tampoco se autosuspende', () => {
    const r = estadoEfectivo({ plan: PLAN.GRATIS, estado: 'active', fecha_vencimiento: '2020-01-01' }, '2026-08-28')
    expect(r.estado).toBe('active')
  })

  it('restricted y cancelled se respetan tal cual, sin tocarlos', () => {
    expect(estadoEfectivo({ plan: PLAN.PAGO, estado: 'restricted', fecha_vencimiento: '2026-12-01' }, '2026-08-28').estado).toBe('restricted')
    expect(estadoEfectivo({ plan: PLAN.PAGO, estado: 'cancelled', fecha_vencimiento: '2026-12-01' }, '2026-08-28').estado).toBe('cancelled')
  })
})

describe('debeAvisarProntoAVencer', () => {
  it('avisa con 7 días o menos', () => {
    expect(debeAvisarProntoAVencer({ estado: 'active', vencioPrueba: false, diasRestantes: 7 })).toBe(true)
    expect(debeAvisarProntoAVencer({ estado: 'active', vencioPrueba: false, diasRestantes: 0 })).toBe(true)
  })
  it('no avisa con más de 7 días', () => {
    expect(debeAvisarProntoAVencer({ estado: 'active', vencioPrueba: false, diasRestantes: 8 })).toBe(false)
  })
  it('no avisa si ya venció (ese caso lo maneja el bloqueo, no el aviso)', () => {
    expect(debeAvisarProntoAVencer({ estado: 'suspended', vencioPrueba: true, diasRestantes: -2 })).toBe(false)
  })
  it('no avisa para planes sin fecha de prueba (pago, free)', () => {
    expect(debeAvisarProntoAVencer({ estado: 'active', vencioPrueba: false, diasRestantes: null })).toBe(false)
  })
})
