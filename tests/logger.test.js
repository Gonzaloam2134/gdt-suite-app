import { describe, it, expect, vi, afterEach } from 'vitest'
import { logEvento } from '../lib/server/logger'

afterEach(() => vi.restoreAllMocks())

describe('logEvento', () => {
  it('arma una línea JSON con los campos estándar', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logEvento({ operacion: 'webhook_mp_cliente', resultado: 'procesado', ownerId: 'o-1', localId: 'l-1', duracionMs: 42 })
    const linea = JSON.parse(spy.mock.calls[0][0])
    expect(linea.operacion).toBe('webhook_mp_cliente')
    expect(linea.resultado).toBe('procesado')
    expect(linea.ownerId).toBe('o-1')
    expect(linea.localId).toBe('l-1')
    expect(linea.duracionMs).toBe(42)
    expect(linea.ts).toBeTruthy()
  })

  it('resultado fallido/rechazado o con error usa console.error, no console.log', () => {
    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    logEvento({ operacion: 'x', resultado: 'fallido' })
    logEvento({ operacion: 'x', resultado: 'rechazado' })
    logEvento({ operacion: 'x', resultado: 'procesado', error: new Error('algo') })
    expect(spyError).toHaveBeenCalledTimes(3)
    expect(spyLog).not.toHaveBeenCalled()
  })

  it('NUNCA incluye access_token, refresh_token, secret, password ni credenciales, aunque vengan en `detalles`', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logEvento({
      operacion: 'refresh_token_mp', resultado: 'renovado', ownerId: 'o-1',
      detalles: {
        access_token: 'APP_USR-secreto', refresh_token: 'TG-secreto',
        clientSecret: 'otro-secreto', password: '1234', credencialDeAPI: 'x',
        mpUserId: '12345', orders: 3, // esto sí debe quedar
      },
    })
    const linea = JSON.parse(spy.mock.calls[0][0])
    expect(linea).not.toHaveProperty('access_token')
    expect(linea).not.toHaveProperty('refresh_token')
    expect(linea).not.toHaveProperty('clientSecret')
    expect(linea).not.toHaveProperty('password')
    expect(linea).not.toHaveProperty('credencialDeAPI')
    expect(linea.mpUserId).toBe('12345')
    expect(linea.orders).toBe(3)
  })

  it('un Error en `error` se guarda como su mensaje, no el objeto completo', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logEvento({ operacion: 'x', resultado: 'fallido', error: new Error('mercado pago no responde') })
    const linea = JSON.parse(spy.mock.calls[0][0])
    expect(linea.error).toBe('mercado pago no responde')
  })
})
