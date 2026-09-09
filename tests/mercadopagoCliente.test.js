import { describe, it, expect } from 'vitest'
import {
  generarPkce, derivarExternalStoreId, derivarExternalPosId,
  extraerDatosOrder, resolverLocalId, esTransferencia, extraerDatosTransferencia,
  segundosParaProximaSincronizacionManual, COOLDOWN_SINCRONIZACION_MANUAL_SEGUNDOS,
} from '../lib/domain/mercadopagoCliente'

describe('derivarExternalStoreId', () => {
  it('saca los guiones de un local_id (uuid)', () => {
    const localId = '35d5406b-d8b9-4c2c-a311-7c5f633cf404'
    const externalId = derivarExternalStoreId(localId)
    expect(externalId).toBe('35d5406bd8b94c2ca3117c5f633cf404')
    expect(externalId).not.toContain('-')
  })

  it('nunca supera el límite de 60 caracteres', () => {
    const localId = '35d5406b-d8b9-4c2c-a311-7c5f633cf404'
    expect(derivarExternalStoreId(localId).length).toBeLessThanOrEqual(60)
  })

  it('rechaza un id que superaría el límite', () => {
    const idDemasiadoLargo = 'a'.repeat(61)
    expect(() => derivarExternalStoreId(idDemasiadoLargo)).toThrow()
  })
})

describe('derivarExternalPosId', () => {
  const localId = '35d5406b-d8b9-4c2c-a311-7c5f633cf404'

  it('saca los guiones y agrega el sufijo POS<n> sin guion', () => {
    const externalId = derivarExternalPosId(localId, 1)
    expect(externalId).toBe('35d5406bd8b94c2ca3117c5f633cf404POS1')
    expect(externalId).not.toContain('-')
  })

  it('nunca supera el límite de 40 caracteres', () => {
    expect(derivarExternalPosId(localId, 1).length).toBeLessThanOrEqual(40)
  })

  it('genera un sufijo distinto por cada caja del mismo local, sin colisionar', () => {
    const ids = [1, 2, 3, 4, 5].map((n) => derivarExternalPosId(localId, n))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('dos locales distintos nunca colisionan entre sí para la misma caja', () => {
    const otroLocalId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    expect(derivarExternalPosId(localId, 1)).not.toBe(derivarExternalPosId(otroLocalId, 1))
  })

  it('rechaza un external_id de POS que superaría el límite', () => {
    const idDemasiadoLargo = 'a'.repeat(38)
    expect(() => derivarExternalPosId(idDemasiadoLargo, 1)).toThrow()
  })
})

describe('extraerDatosOrder', () => {
  const ordenBase = {
    id: 123, status: 'processed', type: 'qr', total_amount: '150.50',
    description: 'Venta mostrador', created_date: '2026-09-08T12:00:00Z',
    config: { qr: { external_pos_id: '35d5406bd8b94c2ca3117c5f633cf404POS1' } },
  }

  it('extrae los datos de un order de QR procesado', () => {
    const datos = extraerDatosOrder(ordenBase)
    expect(datos).toEqual({
      mpPaymentId: '123', origen: 'qr', monto: 150.5,
      descripcion: 'Venta mostrador', fechaMp: '2026-09-08T12:00:00Z',
      externalPosId: '35d5406bd8b94c2ca3117c5f633cf404POS1',
    })
  })

  it('un order de Point no trae external_pos_id', () => {
    const datos = extraerDatosOrder({ ...ordenBase, type: 'point', config: { point: { terminal_id: 'ABC' } } })
    expect(datos.origen).toBe('point')
    expect(datos.externalPosId).toBeNull()
  })

  it('devuelve null si el order todavía no está acreditado', () => {
    expect(extraerDatosOrder({ ...ordenBase, status: 'created' })).toBeNull()
  })

  it('devuelve null para un type que no es qr ni point (ej. online/Checkout Pro)', () => {
    expect(extraerDatosOrder({ ...ordenBase, type: 'online' })).toBeNull()
  })

  it('devuelve null si el monto no es un número válido', () => {
    expect(extraerDatosOrder({ ...ordenBase, total_amount: '0' })).toBeNull()
    expect(extraerDatosOrder({ ...ordenBase, total_amount: 'no-numero' })).toBeNull()
  })

  it('devuelve null si no hay order', () => {
    expect(extraerDatosOrder(null)).toBeNull()
  })
})

describe('resolverLocalId', () => {
  const localA = '35d5406b-d8b9-4c2c-a311-7c5f633cf404'
  const localB = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  it('QR: resuelve comparando el external_pos_id contra cada local mapeado', () => {
    const mapeos = [{ local_id: localA }, { local_id: localB }]
    const externalPosId = derivarExternalPosId(localB, 1)
    expect(resolverLocalId({ origen: 'qr', externalPosId, mapeos })).toBe(localB)
  })

  it('QR: sin match y con más de un local mapeado, no se adivina', () => {
    const mapeos = [{ local_id: localA }, { local_id: localB }]
    expect(resolverLocalId({ origen: 'qr', externalPosId: 'algo-que-no-matchea', mapeos })).toBeNull()
  })

  it('Point o transferencia: se autocompleta si el dueño tiene un único local vinculado', () => {
    const mapeos = [{ local_id: localA }]
    expect(resolverLocalId({ origen: 'point', externalPosId: null, mapeos })).toBe(localA)
    expect(resolverLocalId({ origen: 'transferencia', externalPosId: null, mapeos })).toBe(localA)
  })

  it('Point o transferencia: con más de un local, queda sin asignar', () => {
    const mapeos = [{ local_id: localA }, { local_id: localB }]
    expect(resolverLocalId({ origen: 'point', externalPosId: null, mapeos })).toBeNull()
    expect(resolverLocalId({ origen: 'transferencia', externalPosId: null, mapeos })).toBeNull()
  })

  it('sin ningún local mapeado, siempre queda sin asignar', () => {
    expect(resolverLocalId({ origen: 'qr', externalPosId: 'x', mapeos: [] })).toBeNull()
    expect(resolverLocalId({ origen: 'qr', externalPosId: 'x', mapeos: null })).toBeNull()
  })
})

describe('esTransferencia', () => {
  it('operation_type money_transfer aprobado es una transferencia', () => {
    expect(esTransferencia({ operation_type: 'money_transfer', status: 'approved' })).toBe(true)
  })

  it('un cobro de QR/Point (pos_payment) no es una transferencia', () => {
    expect(esTransferencia({ operation_type: 'pos_payment', status: 'approved' })).toBe(false)
  })

  it('una transferencia todavía no aprobada no cuenta', () => {
    expect(esTransferencia({ operation_type: 'money_transfer', status: 'pending' })).toBe(false)
  })

  it('sin payment no rompe', () => {
    expect(esTransferencia(null)).toBe(false)
  })
})

describe('extraerDatosTransferencia', () => {
  const pagoBase = {
    id: 999, transaction_amount: 500,
    description: 'Transferencia recibida',
    date_approved: '2026-09-08T10:00:00Z', date_created: '2026-09-08T09:59:00Z',
  }

  it('extrae los datos de una transferencia aprobada', () => {
    expect(extraerDatosTransferencia(pagoBase)).toEqual({
      mpPaymentId: '999', monto: 500,
      descripcion: 'Transferencia recibida', fechaMp: '2026-09-08T10:00:00Z',
    })
  })

  it('usa date_created si todavía no hay date_approved', () => {
    const datos = extraerDatosTransferencia({ ...pagoBase, date_approved: null })
    expect(datos.fechaMp).toBe('2026-09-08T09:59:00Z')
  })

  it('devuelve null si el monto no es válido', () => {
    expect(extraerDatosTransferencia({ ...pagoBase, transaction_amount: 0 })).toBeNull()
    expect(extraerDatosTransferencia({ ...pagoBase, transaction_amount: undefined })).toBeNull()
  })
})

describe('segundosParaProximaSincronizacionManual', () => {
  it('nunca sincronizó: se puede sincronizar ya', () => {
    expect(segundosParaProximaSincronizacionManual(null)).toBe(0)
  })

  it('recién sincronizó: hay que esperar el cooldown completo', () => {
    const ahora = new Date('2026-09-09T12:00:00Z')
    const restantes = segundosParaProximaSincronizacionManual(ahora.toISOString(), ahora)
    expect(restantes).toBe(COOLDOWN_SINCRONIZACION_MANUAL_SEGUNDOS)
  })

  it('a mitad del cooldown, faltan la mitad de los segundos', () => {
    const ultima = new Date('2026-09-09T12:00:00Z')
    const ahora = new Date(ultima.getTime() + (COOLDOWN_SINCRONIZACION_MANUAL_SEGUNDOS / 2) * 1000)
    expect(segundosParaProximaSincronizacionManual(ultima.toISOString(), ahora)).toBe(COOLDOWN_SINCRONIZACION_MANUAL_SEGUNDOS / 2)
  })

  it('pasado el cooldown, ya se puede sincronizar de nuevo', () => {
    const ultima = new Date('2026-09-09T12:00:00Z')
    const ahora = new Date(ultima.getTime() + (COOLDOWN_SINCRONIZACION_MANUAL_SEGUNDOS + 1) * 1000)
    expect(segundosParaProximaSincronizacionManual(ultima.toISOString(), ahora)).toBe(0)
  })
})

describe('generarPkce', () => {
  it('devuelve un code_verifier y code_challenge con el formato esperado (RFC 7636)', () => {
    const { codeVerifier, codeChallenge } = generarPkce()

    // code_verifier: 43-128 caracteres, alfabeto unreserved (base64url sin '=')
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43)
    expect(codeVerifier.length).toBeLessThanOrEqual(128)
    expect(codeVerifier).toMatch(/^[A-Za-z0-9\-_]+$/)

    // code_challenge = BASE64URL(SHA256(code_verifier)) → 43 caracteres, mismo alfabeto
    expect(codeChallenge).toMatch(/^[A-Za-z0-9\-_]{43}$/)
  })

  it('genera un par distinto en cada llamada', () => {
    const primero = generarPkce()
    const segundo = generarPkce()
    expect(primero.codeVerifier).not.toBe(segundo.codeVerifier)
    expect(primero.codeChallenge).not.toBe(segundo.codeChallenge)
  })
})
