import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import {
  construirExternalReference, parsearExternalReference,
  frequencyTypeDeCiclo, proximoVencimiento, validarFirmaWebhook, compararTiempoConstante,
  decidirAccionDePago, decidirAccionDePreapproval,
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

describe('compararTiempoConstante', () => {
  it('dos strings iguales dan true', () => {
    expect(compararTiempoConstante('abc123', 'abc123')).toBe(true)
  })
  it('dos strings distintos del mismo largo dan false', () => {
    expect(compararTiempoConstante('abc123', 'abc124')).toBe(false)
  })
  it('largos distintos dan false sin tirar una excepción', () => {
    expect(compararTiempoConstante('abc', 'abcdef')).toBe(false)
  })
  it('valores no-string nunca rompen, dan false', () => {
    expect(compararTiempoConstante(null, 'algo')).toBe(false)
    expect(compararTiempoConstante('algo', undefined)).toBe(false)
    expect(compararTiempoConstante(123, '123')).toBe(false)
  })
})

describe('validarFirmaWebhook', () => {
  it('un v1 con largo distinto al hash real (firma corta/inválida) no rompe y da false', () => {
    expect(validarFirmaWebhook('ts=1,v1=abc', 'req-1', '123', 'un-secreto')).toBe(false)
  })
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

// Hardening P1 ítem 10: decisión pura de qué hacer con un webhook de pago/
// preapproval, separada de la ejecución (DB/red) en pages/api/webhooks/
// mercadopago.js — así se puede probar cada status sin pegarle a Mercado
// Pago ni a Supabase.
describe('decidirAccionDePago', () => {
  const ref = construirExternalReference('owner-123', 'negocio', 'mensual')

  it('pago aprobado → activar_plan, con los datos para activar y para el historial', () => {
    const decision = decidirAccionDePago({
      id: 999, status: 'approved', external_reference: ref,
      transaction_amount: 15000, preapproval_id: 'pa-1', payer: { email: 'pagador@test.com' },
    })
    expect(decision.accion).toBe('activar_plan')
    expect(decision.ownerId).toBe('owner-123')
    expect(decision.segmento).toBe('negocio')
    expect(decision.ciclo).toBe('mensual')
    expect(decision.monto).toBe(15000)
    expect(decision.mpPreapprovalId).toBe('pa-1')
    expect(decision.mpPayerEmail).toBe('pagador@test.com')
    expect(decision.mpPaymentId).toBe('999')
  })

  it('pago rechazado → restringir', () => {
    expect(decidirAccionDePago({ status: 'rejected', external_reference: ref })).toEqual({ accion: 'restringir', ownerId: 'owner-123' })
  })

  it('pago cancelado → restringir', () => {
    expect(decidirAccionDePago({ status: 'cancelled', external_reference: ref })).toEqual({ accion: 'restringir', ownerId: 'owner-123' })
  })

  it('status intermedio (pending, in_process, authorized) → ignorar, no es un error', () => {
    for (const status of ['pending', 'in_process', 'authorized', 'refunded']) {
      expect(decidirAccionDePago({ status, external_reference: ref })).toEqual({ accion: 'ignorar' })
    }
  })

  it('evento desconocido / sin external_reference reconocible → sin_referencia', () => {
    expect(decidirAccionDePago({ status: 'approved', external_reference: null })).toEqual({ accion: 'sin_referencia' })
    expect(decidirAccionDePago({ status: 'approved', external_reference: 'formato-raro' })).toEqual({ accion: 'sin_referencia' })
  })
})

describe('decidirAccionDePreapproval', () => {
  const ref = construirExternalReference('owner-456', 'basico', 'anual')

  it('cancelado → restringir', () => {
    expect(decidirAccionDePreapproval({ status: 'cancelled', external_reference: ref })).toEqual({ accion: 'restringir', ownerId: 'owner-456' })
  })

  it('pausado → restringir', () => {
    expect(decidirAccionDePreapproval({ status: 'paused', external_reference: ref })).toEqual({ accion: 'restringir', ownerId: 'owner-456' })
  })

  it('autorizado (renovación al día) → ignorar', () => {
    expect(decidirAccionDePreapproval({ status: 'authorized', external_reference: ref })).toEqual({ accion: 'ignorar' })
  })

  it('sin external_reference reconocible → sin_referencia', () => {
    expect(decidirAccionDePreapproval({ status: 'cancelled', external_reference: null })).toEqual({ accion: 'sin_referencia' })
  })
})
