import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import {
  construirExternalReference, parsearExternalReference,
  frequencyTypeDeCiclo, proximoVencimiento, validarFirmaWebhook,
} from '../lib/domain/mercadopago'

describe('external_reference', () => {
  it('arma y parsea de ida y vuelta', () => {
    const ref = construirExternalReference('owner-123', 'negocio', 'mensual')
    expect(ref).toBe('owner-123:negocio:mensual')
    expect(parsearExternalReference(ref)).toEqual({ ownerId: 'owner-123', segmento: 'negocio', ciclo: 'mensual' })
  })

  it('devuelve null ante formatos inesperados', () => {
    expect(parsearExternalReference(null)).toBeNull()
    expect(parsearExternalReference('')).toBeNull()
    expect(parsearExternalReference('solo-un-campo')).toBeNull()
    expect(parsearExternalReference('a:b:c:d')).toBeNull()
    expect(parsearExternalReference(':negocio:mensual')).toBeNull()
  })
})

describe('frequencyTypeDeCiclo', () => {
  it('mensual → months, anual → years', () => {
    expect(frequencyTypeDeCiclo('mensual')).toBe('months')
    expect(frequencyTypeDeCiclo('anual')).toBe('years')
  })
})

describe('proximoVencimiento', () => {
  it('mensual suma un mes', () => {
    expect(proximoVencimiento('mensual', '2026-09-02')).toBe('2026-10-02')
  })
  it('anual suma un año', () => {
    expect(proximoVencimiento('anual', '2026-09-02')).toBe('2027-09-02')
  })
  it('cruza fin de año correctamente', () => {
    expect(proximoVencimiento('mensual', '2026-12-15')).toBe('2027-01-15')
  })
})

describe('validarFirmaWebhook', () => {
  const secret = 'mi-secreto'
  const firmar = (dataId, xRequestId, ts) => {
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
    const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
    return `ts=${ts},v1=${v1}`
  }

  it('acepta una firma armada correctamente', () => {
    const xSignature = firmar('123', 'req-1', '1700000000')
    expect(validarFirmaWebhook(xSignature, 'req-1', '123', secret)).toBe(true)
  })

  it('rechaza si el secreto no coincide', () => {
    const xSignature = firmar('123', 'req-1', '1700000000')
    expect(validarFirmaWebhook(xSignature, 'req-1', '123', 'otro-secreto')).toBe(false)
  })

  it('rechaza si el dataId no coincide con el firmado', () => {
    const xSignature = firmar('123', 'req-1', '1700000000')
    expect(validarFirmaWebhook(xSignature, 'req-1', '999', secret)).toBe(false)
  })

  it('rechaza si falta algún dato', () => {
    expect(validarFirmaWebhook(null, 'req-1', '123', secret)).toBe(false)
    expect(validarFirmaWebhook('ts=1,v1=abc', 'req-1', null, secret)).toBe(false)
    expect(validarFirmaWebhook('ts=1,v1=abc', 'req-1', '123', null)).toBe(false)
  })
})
