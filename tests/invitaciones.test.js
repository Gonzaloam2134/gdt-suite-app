import { describe, it, expect } from 'vitest'
import { invitacionVigente } from '../lib/domain/invitaciones'

const horas = (n) => new Date(Date.now() + n * 60 * 60 * 1000).toISOString()

describe('invitacionVigente', () => {
  it('pendiente y no vencida es vigente', () => {
    expect(invitacionVigente({ estado: 'pendiente', expira_en: horas(24) })).toBe(true)
  })
  it('pendiente pero con expira_en en el pasado no es vigente', () => {
    expect(invitacionVigente({ estado: 'pendiente', expira_en: horas(-1) })).toBe(false)
  })
  it('aceptada no es vigente aunque expira_en esté en el futuro', () => {
    expect(invitacionVigente({ estado: 'aceptada', expira_en: horas(24) })).toBe(false)
  })
  it('rechazada no es vigente', () => {
    expect(invitacionVigente({ estado: 'rechazada', expira_en: horas(24) })).toBe(false)
  })
  it('expirada no es vigente', () => {
    expect(invitacionVigente({ estado: 'expirada', expira_en: horas(-1) })).toBe(false)
  })
})
