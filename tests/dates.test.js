import { describe, it, expect } from 'vitest'
import { aFechaISO, rangoDia, periodoRapido, desdeFechaISO } from '../lib/dates'

describe('dates (hora local, nunca UTC)', () => {
  it('aFechaISO usa la fecha local, no la UTC', () => {
    // 23:30 local del 25/08 — en UTC-3 ya es 26/08 en UTC
    const d = new Date(2026, 7, 25, 23, 30)
    expect(aFechaISO(d)).toBe('2026-08-25')
  })

  it('rangoDia cubre desde 00:00:00.000 hasta 23:59:59.999 local', () => {
    const { inicio, fin } = rangoDia('2026-08-25')
    expect(new Date(inicio).getHours()).toBe(0)
    expect(new Date(fin).getHours()).toBe(23)
    expect(new Date(fin).getMinutes()).toBe(59)
    expect(new Date(fin) - new Date(inicio)).toBe(24 * 60 * 60 * 1000 - 1)
  })

  it('desdeFechaISO no salta de día', () => {
    expect(aFechaISO(desdeFechaISO('2026-01-01'))).toBe('2026-01-01')
  })

  it('periodoRapido: mes-anterior en enero cruza de año', () => {
    const ref = new Date(2026, 0, 15)
    expect(periodoRapido('mes-anterior', ref)).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' })
  })

  it('periodoRapido: semana son 7 días incluyendo hoy', () => {
    const ref = new Date(2026, 7, 25)
    expect(periodoRapido('semana', ref)).toEqual({ desde: '2026-08-19', hasta: '2026-08-25' })
  })

  it('periodoRapido: mes en febrero bisiesto', () => {
    expect(periodoRapido('mes', new Date(2028, 1, 10))).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
  })
})
