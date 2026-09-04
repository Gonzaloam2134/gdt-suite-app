import { describe, it, expect } from 'vitest'
import { agruparPagosPorMes, proyectarCashflow, totalCobradoHistorico, mrrActual } from '../lib/domain/cashflow'

describe('agruparPagosPorMes', () => {
  it('suma los pagos del mismo mes', () => {
    const pagos = [
      { monto: 24000, procesado_en: '2026-09-09T15:00:00Z' },
      { monto: 60000, procesado_en: '2026-09-15T10:00:00Z' },
      { monto: 45000, procesado_en: '2026-10-01T10:00:00Z' },
    ]
    expect(agruparPagosPorMes(pagos)).toEqual({ '2026-09': 84000, '2026-10': 45000 })
  })
  it('sin pagos, devuelve vacío', () => {
    expect(agruparPagosPorMes([])).toEqual({})
  })
})

describe('proyectarCashflow — mensual', () => {
  it('se repite desde el mes del próximo vencimiento en adelante — el mes ya cobrado (el actual) no vuelve a sumar', () => {
    // fecha_vencimiento en octubre significa que el cobro de septiembre YA pasó
    // (por eso se movió); septiembre no debe sumar de nuevo en la proyección.
    const subs = [{ plan: 'pago', estado: 'active', segmento: 'basico', ciclo: 'mensual', monto: 24000, fecha_vencimiento: '2026-10-09' }]
    const r = proyectarCashflow(subs, 3, '2026-09-15')
    expect(r).toEqual({ '2026-09': 0, '2026-10': 24000, '2026-11': 24000 })
  })

  it('cruza el fin de año correctamente', () => {
    const subs = [{ plan: 'pago', estado: 'active', segmento: 'basico', ciclo: 'mensual', monto: 24000, fecha_vencimiento: '2026-12-20' }]
    const r = proyectarCashflow(subs, 3, '2026-11-01')
    expect(Object.keys(r)).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(r['2027-01']).toBe(24000)
  })
})

describe('proyectarCashflow — anual', () => {
  it('una suscripción anual solo aporta en su mes de vencimiento, una vez', () => {
    const subs = [{ plan: 'pago', estado: 'active', segmento: 'negocio', ciclo: 'anual', monto: 600000, fecha_vencimiento: '2026-11-15' }]
    const r = proyectarCashflow(subs, 6, '2026-09-01')
    expect(r['2026-11']).toBe(600000)
    expect(r['2026-09']).toBe(0)
    expect(r['2026-12']).toBe(0)
  })
})

describe('proyectarCashflow — filtra lo que no corresponde', () => {
  it('ignora suscripciones en prueba, restringidas o sin monto', () => {
    const subs = [
      { plan: 'trial', estado: 'active', ciclo: 'mensual', monto: null, fecha_vencimiento: '2026-09-30' },
      { plan: 'pago', estado: 'restricted', ciclo: 'mensual', monto: 24000, fecha_vencimiento: '2026-09-30' },
      { plan: 'pago', estado: 'active', ciclo: 'mensual', monto: null, fecha_vencimiento: '2026-09-30' },
    ]
    const r = proyectarCashflow(subs, 2, '2026-09-01')
    expect(Object.values(r).every(v => v === 0)).toBe(true)
  })

  it('suma varias suscripciones activas del mismo mes', () => {
    const subs = [
      { plan: 'pago', estado: 'active', ciclo: 'mensual', monto: 24000, fecha_vencimiento: '2026-09-10' },
      { plan: 'pago', estado: 'active', ciclo: 'mensual', monto: 60000, fecha_vencimiento: '2026-09-22' },
    ]
    const r = proyectarCashflow(subs, 1, '2026-09-01')
    expect(r['2026-09']).toBe(84000)
  })
})

describe('totalCobradoHistorico', () => {
  it('suma todos los pagos sin importar el mes', () => {
    expect(totalCobradoHistorico([{ monto: 24000 }, { monto: 60000 }])).toBe(84000)
  })
})

describe('mrrActual', () => {
  it('las mensuales cuentan completas', () => {
    const subs = [{ plan: 'pago', estado: 'active', ciclo: 'mensual', monto: 24000 }]
    expect(mrrActual(subs)).toBe(24000)
  })
  it('las anuales cuentan prorrateadas a 1/12', () => {
    const subs = [{ plan: 'pago', estado: 'active', ciclo: 'anual', monto: 600000 }]
    expect(mrrActual(subs)).toBe(50000)
  })
  it('no cuenta pruebas ni restringidas', () => {
    const subs = [
      { plan: 'trial', estado: 'active', ciclo: 'mensual', monto: null },
      { plan: 'pago', estado: 'restricted', ciclo: 'mensual', monto: 24000 },
    ]
    expect(mrrActual(subs)).toBe(0)
  })
})
