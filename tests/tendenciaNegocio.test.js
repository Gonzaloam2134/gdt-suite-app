import { describe, it, expect } from 'vitest'
import { serieDiaria, calcularTendencia } from '../components/reportes/tendenciaNegocio'

const dia = (n) => `2026-09-${String(n).padStart(2, '0')}`

describe('serieDiaria', () => {
  it('completa con 0 los días sin movimientos y deja afuera hoy', () => {
    const serie = serieDiaria([{ fecha: dia(2), ventas: 500 }], dia(1), dia(30), dia(4))
    expect(serie.map(d => d.fecha)).toEqual([dia(1), dia(2), dia(3)])
    expect(serie.map(d => d.ventas)).toEqual([0, 500, 0])
  })
  it('si el período termina antes de ayer, respeta el fin del período', () => {
    expect(serieDiaria([], dia(1), dia(5), dia(20))).toHaveLength(5)
  })
})

describe('calcularTendencia', () => {
  const serie = (ventas) => ventas.map((v, i) => ({ fecha: dia(i + 1), ventas: v }))

  it('menos de 14 días: no inventa un insight', () => {
    expect(calcularTendencia(serie(Array(10).fill(100))).estado).toBe('insuficiente')
  })
  it('pocos días con ventas: insuficiente', () => {
    expect(calcularTendencia(serie([...Array(10).fill(0), 100, 100, 100, 100])).estado).toBe('insuficiente')
  })
  it('semana anterior sin ventas: insuficiente (no divide por cero)', () => {
    const s = serie([...Array(7).fill(0), ...Array(7).fill(100)])
    expect(calcularTendencia(s).estado).toBe('insuficiente')
  })
  it('compara los últimos 7 contra los 7 anteriores', () => {
    const r = calcularTendencia(serie([...Array(7).fill(100), ...Array(7).fill(150)]))
    expect(r).toMatchObject({ estado: 'ok', ultimos: 1050, anteriores: 700 })
    expect(r.porcentaje).toBeCloseTo(50)
  })
})
