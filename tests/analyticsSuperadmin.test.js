import { describe, it, expect } from 'vitest'
import {
  agruparTransaccionesPorLocal,
  ownerPorLocal,
  agruparPorOwner,
  agruparPorTipoMedioPago,
  localesInactivos,
  suscripcionesPorVencerPronto,
} from '../lib/domain/analyticsSuperadmin'

const cobro = (over = {}) => ({
  local_id: 'local-1', tipo: 'COBRO_RECIBIDO', monto: 100, es_reversa: false, revertida: false,
  comprobante_path: null, creado_en: '2026-10-01T10:00:00.000Z', ...over,
})
const gasto = (over = {}) => ({
  local_id: 'local-1', tipo: 'GASTO_REGISTRADO', monto: 50, es_reversa: false, revertida: false,
  comprobante_path: null, creado_en: '2026-10-01T10:00:00.000Z', ...over,
})

describe('agruparTransaccionesPorLocal', () => {
  it('suma cobros y gastos por local, separados', () => {
    const [stat] = agruparTransaccionesPorLocal([cobro({ monto: 100 }), cobro({ monto: 200 }), gasto({ monto: 50 })])
    expect(stat.cobros).toBe(2)
    expect(stat.volumenCobrado).toBe(300)
    expect(stat.gastos).toBe(1)
    expect(stat.volumenGastado).toBe(50)
    expect(stat.ticketPromedioCobro).toBe(150)
  })

  it('una reversa no suma al volumen ni a movimientos, pero sí cuenta para pctReversas', () => {
    const [stat] = agruparTransaccionesPorLocal([cobro(), cobro({ es_reversa: true, monto: -100 })])
    expect(stat.movimientos).toBe(1)
    expect(stat.reversas).toBe(1)
    expect(stat.pctReversas).toBeCloseTo(0.5)
  })

  it('una transacción revertida no suma, pero sí actualiza última actividad', () => {
    const [stat] = agruparTransaccionesPorLocal([cobro({ revertida: true, creado_en: '2026-10-05T00:00:00.000Z' })])
    expect(stat.movimientos).toBe(0)
    expect(stat.ultimaActividad).toBe('2026-10-05T00:00:00.000Z')
  })

  it('comprobante_path presente vs ausente se cuenta en pctSinComprobante', () => {
    const [stat] = agruparTransaccionesPorLocal([cobro({ comprobante_path: 'x.jpg' }), cobro({ comprobante_path: null })])
    expect(stat.conComprobante).toBe(1)
    expect(stat.sinComprobante).toBe(1)
    expect(stat.pctSinComprobante).toBeCloseTo(0.5)
  })

  it('filas sin local_id se ignoran en vez de romper', () => {
    expect(agruparTransaccionesPorLocal([{ local_id: null, tipo: 'COBRO_RECIBIDO', monto: 10 }])).toEqual([])
  })

  it('sin transacciones devuelve array vacío', () => {
    expect(agruparTransaccionesPorLocal([])).toEqual([])
  })
})

describe('ownerPorLocal', () => {
  it('toma el miembro activo con rol owner', () => {
    const locales = [{ id: 'l1', miembros_locales: [
      { user_id: 'u1', rol: 'cajero', activo: true, perfiles: { email: 'cajero@x.com' } },
      { user_id: 'u2', rol: 'owner', activo: true, perfiles: { email: 'owner@x.com', nombre: 'Dueño' } },
    ] }]
    const mapa = ownerPorLocal(locales)
    expect(mapa.get('l1')).toEqual({ ownerId: 'u2', ownerEmail: 'owner@x.com', ownerNombre: 'Dueño' })
  })

  it('un owner inactivo no cuenta como owner vigente', () => {
    const locales = [{ id: 'l1', miembros_locales: [{ user_id: 'u1', rol: 'owner', activo: false, perfiles: {} }] }]
    expect(ownerPorLocal(locales).get('l1').ownerId).toBeNull()
  })

  it('local sin owner activo devuelve ownerId null en vez de romper', () => {
    expect(ownerPorLocal([{ id: 'l1', miembros_locales: [] }]).get('l1').ownerId).toBeNull()
  })
})

describe('agruparPorOwner', () => {
  it('agrupa varios locales del mismo owner y suma sus totales', () => {
    const locales = [
      { id: 'l1', nombre: 'Local 1', miembros_locales: [{ user_id: 'u1', rol: 'owner', activo: true, perfiles: { email: 'a@x.com' } }] },
      { id: 'l2', nombre: 'Local 2', miembros_locales: [{ user_id: 'u1', rol: 'owner', activo: true, perfiles: { email: 'a@x.com' } }] },
    ]
    const stats = [
      { localId: 'l1', movimientos: 2, volumenCobrado: 100, volumenGastado: 10 },
      { localId: 'l2', movimientos: 3, volumenCobrado: 200, volumenGastado: 20 },
    ]
    const [grupo] = agruparPorOwner(stats, locales)
    expect(grupo.ownerId).toBe('u1')
    expect(grupo.locales).toHaveLength(2)
    expect(grupo.volumenCobrado).toBe(300)
    expect(grupo.movimientos).toBe(5)
  })

  it('locales sin owner se agrupan por separado entre sí, no juntos', () => {
    const locales = [{ id: 'l1', nombre: 'L1', miembros_locales: [] }, { id: 'l2', nombre: 'L2', miembros_locales: [] }]
    const stats = [{ localId: 'l1', movimientos: 1, volumenCobrado: 0, volumenGastado: 0 }, { localId: 'l2', movimientos: 1, volumenCobrado: 0, volumenGastado: 0 }]
    expect(agruparPorOwner(stats, locales)).toHaveLength(2)
  })
})

describe('agruparPorTipoMedioPago', () => {
  it('agrupa por tipo de medio de pago, no por id', () => {
    const filas = [
      cobro({ medios_pago: { tipo: 'efectivo' } }),
      cobro({ monto: 50, medios_pago: { tipo: 'efectivo' } }),
      cobro({ monto: 30, medios_pago: { tipo: 'tarjeta' } }),
    ]
    const resultado = agruparPorTipoMedioPago(filas)
    expect(resultado.find((r) => r.tipo === 'efectivo').volumen).toBe(150)
    expect(resultado.find((r) => r.tipo === 'tarjeta').volumen).toBe(30)
  })

  it('gastos y reversas no entran en el agrupado (solo cobros efectivos)', () => {
    const filas = [gasto({ medios_pago: { tipo: 'efectivo' } }), cobro({ es_reversa: true, medios_pago: { tipo: 'efectivo' } })]
    expect(agruparPorTipoMedioPago(filas)).toEqual([])
  })

  it('cobro sin medio de pago asociado cae en sin_medio en vez de romper', () => {
    const [resultado] = agruparPorTipoMedioPago([cobro({ medios_pago: null })])
    expect(resultado.tipo).toBe('sin_medio')
  })
})

describe('localesInactivos', () => {
  const ahora = new Date('2026-10-10T00:00:00.000Z')

  it('local sin ninguna actividad se considera inactivo', () => {
    expect(localesInactivos([{ localId: 'l1', ultimaActividad: null }], 14, ahora)).toHaveLength(1)
  })

  it('local con actividad reciente no aparece', () => {
    expect(localesInactivos([{ localId: 'l1', ultimaActividad: '2026-10-09T00:00:00.000Z' }], 14, ahora)).toHaveLength(0)
  })

  it('local con actividad justo en el límite de días se considera inactivo', () => {
    expect(localesInactivos([{ localId: 'l1', ultimaActividad: '2026-09-26T00:00:00.000Z' }], 14, ahora)).toHaveLength(1)
  })
})

describe('suscripcionesPorVencerPronto', () => {
  const ahora = new Date('2026-10-10T00:00:00.000Z')

  it('activa y vence dentro de la ventana de aviso', () => {
    const subs = [{ estado: 'active', fecha_vencimiento: '2026-10-15T00:00:00.000Z' }]
    expect(suscripcionesPorVencerPronto(subs, 7, ahora)).toHaveLength(1)
  })

  it('ya vencida no entra (eso lo marca el badge VENCIDO existente)', () => {
    const subs = [{ estado: 'active', fecha_vencimiento: '2026-10-01T00:00:00.000Z' }]
    expect(suscripcionesPorVencerPronto(subs, 7, ahora)).toHaveLength(0)
  })

  it('suspendida o restringida no entra aunque venza pronto', () => {
    const subs = [{ estado: 'suspended', fecha_vencimiento: '2026-10-12T00:00:00.000Z' }]
    expect(suscripcionesPorVencerPronto(subs, 7, ahora)).toHaveLength(0)
  })
})
