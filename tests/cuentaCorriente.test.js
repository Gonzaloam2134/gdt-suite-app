import { describe, it, expect } from 'vitest'
import {
  calcularSaldo, saldoAFavor, deudaPendiente, clientesConSaldo, totalAdeudado, excedeSaldo,
  esConsumo, esPago, esValido,
} from '../lib/domain/cuentaCorriente'

const consumo = (monto, extra = {}) => ({ tipo: 'consumo', monto, es_reversa: false, revertida: false, ...extra })
const pago = (monto, extra = {}) => ({ tipo: 'pago', monto, es_reversa: false, revertida: false, ...extra })

describe('calcularSaldo', () => {
  it('sin movimientos, saldo 0', () => {
    expect(calcularSaldo([])).toBe(0)
  })

  it('suma consumos y resta pagos', () => {
    const movs = [consumo(1500), consumo(800), pago(1000)]
    expect(calcularSaldo(movs)).toBe(1300)
  })

  it('pagos parciales van bajando el saldo sin saldarlo', () => {
    const movs = [consumo(3000), pago(1000), pago(500)]
    expect(calcularSaldo(movs)).toBe(1500)
  })

  it('si paga de más, el saldo queda negativo (a favor)', () => {
    const movs = [consumo(1000), pago(1500)]
    expect(calcularSaldo(movs)).toBe(-500)
  })

  it('una reversa no se cuenta como consumo/pago propio', () => {
    const original = consumo(1000, { id: 'a' })
    const reversa = consumo(-1000, { id: 'b', es_reversa: true, reversa_de: 'a' })
    // la original queda marcada revertida (lo haría el trigger en DB)
    original.revertida = true
    expect(calcularSaldo([original, reversa])).toBe(0)
  })

  it('un consumo anulado no suma deuda', () => {
    const movs = [consumo(2000, { revertida: true }), consumo(500)]
    expect(calcularSaldo(movs)).toBe(500)
  })
})

describe('saldoAFavor / deudaPendiente', () => {
  it('con deuda: deudaPendiente > 0, saldoAFavor 0', () => {
    const movs = [consumo(1000)]
    expect(deudaPendiente(movs)).toBe(1000)
    expect(saldoAFavor(movs)).toBe(0)
  })

  it('con saldo a favor: saldoAFavor > 0, deudaPendiente 0', () => {
    const movs = [consumo(1000), pago(1500)]
    expect(saldoAFavor(movs)).toBe(500)
    expect(deudaPendiente(movs)).toBe(0)
  })

  it('al día: ambos en 0', () => {
    const movs = [consumo(1000), pago(1000)]
    expect(saldoAFavor(movs)).toBe(0)
    expect(deudaPendiente(movs)).toBe(0)
  })
})

describe('clientesConSaldo / totalAdeudado', () => {
  it('calcula el saldo de cada cliente a partir de sus propios movimientos', () => {
    const clientes = [{ id: 'c1', nombre: 'Juana' }, { id: 'c2', nombre: 'Tomás' }]
    const porCliente = { c1: [consumo(1000)], c2: [consumo(2000), pago(2000)] }
    const r = clientesConSaldo(clientes, porCliente)
    expect(r.find(c => c.id === 'c1').saldo).toBe(1000)
    expect(r.find(c => c.id === 'c2').saldo).toBe(0)
  })

  it('cliente sin movimientos todavía, saldo 0', () => {
    const r = clientesConSaldo([{ id: 'c1' }], {})
    expect(r[0].saldo).toBe(0)
  })

  it('totalAdeudado solo suma deuda, no resta el saldo a favor de otro cliente', () => {
    const conSaldo = [{ saldo: 1000 }, { saldo: -500 }, { saldo: 300 }]
    expect(totalAdeudado(conSaldo)).toBe(1300)
  })
})

describe('excedeSaldo', () => {
  it('avisa si el pago es mayor que la deuda', () => {
    expect(excedeSaldo(1500, 1000)).toBe(true)
  })
  it('no avisa con pago parcial', () => {
    expect(excedeSaldo(500, 1000)).toBe(false)
  })
  it('no avisa si no hay deuda (saldo 0 o a favor)', () => {
    expect(excedeSaldo(500, 0)).toBe(false)
    expect(excedeSaldo(500, -200)).toBe(false)
  })
})

describe('esConsumo / esPago / esValido', () => {
  it('clasifica por tipo', () => {
    expect(esConsumo(consumo(100))).toBe(true)
    expect(esPago(consumo(100))).toBe(false)
    expect(esPago(pago(100))).toBe(true)
  })
  it('esValido excluye reversas y revertidos', () => {
    expect(esValido(consumo(100))).toBe(true)
    expect(esValido(consumo(100, { es_reversa: true }))).toBe(false)
    expect(esValido(consumo(100, { revertida: true }))).toBe(false)
  })
})
