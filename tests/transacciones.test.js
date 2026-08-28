import { describe, it, expect } from 'vitest'
import { calcularComision, calcularIva, comisionDe, calcularTotalesDia, calcularAcreditacionesDia, calcularResumenPeriodo, efectivoEsperado } from '../lib/domain/transacciones'

const efectivo = { nombre: 'Efectivo', tipo: 'efectivo', comision_porcentaje: 0, plazo_acreditacion_dias: 0 }
const credito  = { nombre: 'Crédito',  tipo: 'credito',  comision_porcentaje: 3.5, plazo_acreditacion_dias: 30 }
const debito   = { nombre: 'Débito',   tipo: 'debito',   comision_porcentaje: 0, plazo_acreditacion_dias: 0 }

let n = 0
const tx = (over) => ({
  id: `tx-${++n}`, tipo: 'COBRO_RECIBIDO', monto: 1000, es_reversa: false, revertida: false,
  creado_en: new Date(2026, 7, 25, 10, 0).toISOString(), medios_pago: efectivo, ...over,
})

describe('cálculos unitarios', () => {
  it('comisión', () => expect(calcularComision(1000, 3.5)).toBe(35))
  it('IVA 21% desde bruto', () => expect(calcularIva(1210, 21)).toEqual({ neto: 1000, iva: 210 }))
  it('IVA 10.5%', () => expect(calcularIva(1105, 10.5)).toEqual({ neto: 1000, iva: 105 }))
  it('IVA 0%', () => expect(calcularIva(1000, 0)).toEqual({ neto: 1000, iva: 0 }))
})

describe('comisionDe', () => {
  it('respeta comision_monto guardada aunque sea 0, sin recalcular desde el medio actual', () => {
    // Bug real que esto corrige: un cobro con 0% de comisión en su momento no
    // debe "heredar" una comisión nueva si más tarde alguien edita el medio
    // de pago y le sube el porcentaje.
    const t = { monto: 1000, comision_monto: 0, medios_pago: { comision_porcentaje: 5 } }
    expect(comisionDe(t)).toBe(0)
  })

  it('sin comision_monto guardada (fila vieja, columna ausente): deriva del medio', () => {
    const t = { monto: 1000, medios_pago: { comision_porcentaje: 3.5 } }
    expect(comisionDe(t)).toBe(35)
  })

  it('comision_monto guardada mayor a 0: la usa tal cual, ignora el medio', () => {
    const t = { monto: 1000, comision_monto: 50, medios_pago: { comision_porcentaje: 99 } }
    expect(comisionDe(t)).toBe(50)
  })
})

describe('calcularTotalesDia', () => {
  const DIA = '2026-08-25'

  it('un cobro a las 22:30 hora local cuenta en el día (bug UTC)', () => {
    const t = tx({ creado_en: new Date(2026, 7, 25, 22, 30).toISOString() })
    const { totales } = calcularTotalesDia([t], DIA)
    expect(totales.cobros).toBe(1000)
    expect(totales.efectivoEnCaja).toBe(1000)
  })

  it('efectivo va a caja; crédito (pendiente) no está disponible hoy; disponibleHoy ya no lo calcula esta función', () => {
    const r = calcularTotalesDia([
      tx({ monto: 1000, medios_pago: efectivo }),
      tx({ monto: 2000, medios_pago: debito }),
      tx({ monto: 3000, medios_pago: credito }),
    ], DIA)
    expect(r.totales.cobros).toBe(6000)
    expect(r.totales.efectivoEnCaja).toBe(1000)
    expect(r.totales.comisiones).toBe(105)
    expect(r.desgloseMedios[0].nombre).toBe('Crédito')
  })

  it('débito con plazo 0 acredita hoy: no queda pendiente (lo cuenta calcularAcreditacionesDia, no esta función)', () => {
    const r = calcularTotalesDia([tx({ monto: 2000, medios_pago: debito })], DIA)
    expect(r.totales.pendienteAcreditacion).toBe(0)
  })

  it('crédito con plazo > 0 sí queda pendiente, neto de comisión', () => {
    const r = calcularTotalesDia([tx({ monto: 3000, medios_pago: credito })], DIA)
    expect(r.totales.pendienteAcreditacion).toBe(3000 - 105)
  })

  it('gastos restan del neto real', () => {
    const r = calcularTotalesDia([tx({ monto: 5000 }), tx({ tipo: 'GASTO_REGISTRADO', monto: 1200 })], DIA)
    expect(r.totales.gastos).toBe(1200)
    expect(r.totales.netoReal).toBe(3800)
    expect(r.gastos).toHaveLength(1)
  })

  it('una transacción cancelada NO suma pero SÍ se lista, marcada', () => {
    const original = tx({ id: 'orig', monto: 10000, revertida: true, motivo_reversa: 'se cargó dos veces' })
    const reversa = tx({ monto: -10000, es_reversa: true, reversa_de: 'orig' })
    const r = calcularTotalesDia([original, reversa], DIA)
    expect(r.totales.cobros).toBe(0)
    expect(r.totales.efectivoEnCaja).toBe(0)
    expect(r.cobros).toHaveLength(1)              // el dueño la ve en la caja
    expect(r.cobros[0].anulada).toBe(true)
    expect(r.cobros[0].motivo_reversa).toBe('se cargó dos veces')
  })

  it('el asiento inverso no se lista como movimiento propio', () => {
    const r = calcularTotalesDia([tx({ monto: -500, es_reversa: true, reversa_de: 'x' })], DIA)
    expect(r.cobros).toHaveLength(0)
    expect(r.gastos).toHaveLength(0)
  })

  it('un gasto cancelado tampoco suma y se lista marcado', () => {
    const r = calcularTotalesDia([tx({ tipo: 'GASTO_REGISTRADO', monto: 800, revertida: true })], DIA)
    expect(r.totales.gastos).toBe(0)
    expect(r.gastos).toHaveLength(1)
    expect(r.gastos[0].anulada).toBe(true)
  })

  it('usa comision_monto guardada si existe', () => {
    const r = calcularTotalesDia([tx({ monto: 1000, medios_pago: credito, comision_monto: 50 })], DIA)
    expect(r.totales.comisiones).toBe(50)
  })

  it('efectivo esperado = inicial + efectivo del día', () => {
    expect(efectivoEsperado(500, { efectivoEnCaja: 1000 })).toBe(1500)
  })
})

describe('calcularAcreditacionesDia', () => {
  // Reproduce el bug real: una venta con tarjeta de crédito de HACE 2 DÍAS que
  // recién acredita HOY. `listarAcreditacionesDia` la trae porque filtra por
  // fecha de acreditación, no por fecha de creación — por eso acá llega aunque
  // `creado_en` sea de anteayer.
  it('cuenta una venta de días anteriores que acredita hoy (el bug de "Disponible" en $0)', () => {
    const ventaVieja = tx({
      monto: 3000, medios_pago: credito,
      creado_en: new Date(2026, 7, 23, 11, 0).toISOString(), // anteayer
      fecha_acreditacion_estimada: '2026-08-25',
    })
    const { disponibleHoy, acreditacionesHoy } = calcularAcreditacionesDia([ventaVieja])
    expect(disponibleHoy).toBe(3000 - 105)
    expect(acreditacionesHoy).toHaveLength(1)
  })

  it('excluye efectivo (no es "acreditación", ya está en la mano)', () => {
    const { disponibleHoy, acreditacionesHoy } = calcularAcreditacionesDia([tx({ monto: 1000, medios_pago: efectivo })])
    expect(disponibleHoy).toBe(0)
    expect(acreditacionesHoy).toHaveLength(0)
  })

  it('excluye anuladas y asientos inversos', () => {
    const original = tx({ id: 'o', monto: 1000, medios_pago: debito, revertida: true })
    const reversa = tx({ monto: -1000, medios_pago: debito, es_reversa: true, reversa_de: 'o' })
    const { disponibleHoy, acreditacionesHoy } = calcularAcreditacionesDia([original, reversa])
    expect(disponibleHoy).toBe(0)
    expect(acreditacionesHoy).toHaveLength(0)
  })

  it('usa comision_monto guardada si existe', () => {
    const { disponibleHoy } = calcularAcreditacionesDia([tx({ monto: 1000, medios_pago: credito, comision_monto: 50 })])
    expect(disponibleHoy).toBe(950)
  })
})

describe('calcularResumenPeriodo', () => {
  it('lee monto_iva/monto_neto guardados', () => {
    const { resumen, libroVentas } = calcularResumenPeriodo([
      tx({ monto: 1210, monto_neto: 1000, monto_iva: 210, alicuota_iva: 21, tipo_comprobante: 'B', medios_pago: credito, comision_monto: 42.35 }),
      tx({ tipo: 'GASTO_REGISTRADO', monto: 605, monto_neto: 500, monto_iva: 105, alicuota_iva: 21 }),
    ])
    expect(resumen.totalFacturado).toBe(1210)
    expect(resumen.ivaDebitoFiscal).toBe(210)
    expect(resumen.netoGravado).toBe(1000)
    expect(resumen.comisiones).toBe(42.35)
    expect(resumen.ingresoNetoReal).toBe(1167.65)
    expect(resumen.gastosOperativos).toBe(605)
    expect(resumen.ivaCreditoFiscal).toBe(105)
    expect(resumen.ivaAPagar).toBe(105)
    expect(resumen.resultadoEjercicio).toBe(562.65)
    expect(libroVentas[0].tipo).toBe('B')
  })

  it('monotributo: no discrimina IVA', () => {
    const { resumen } = calcularResumenPeriodo([tx({ monto: 1210, monto_iva: 210, monto_neto: 1000 })], { discriminaIva: false })
    expect(resumen.ivaDebitoFiscal).toBe(0)
    expect(resumen.netoGravado).toBe(1210)
  })

  it('fila vieja sin monto_iva: deriva de alicuota (default 21)', () => {
    const { resumen } = calcularResumenPeriodo([tx({ monto: 1210, monto_iva: 0, monto_neto: 0 })])
    expect(resumen.ivaDebitoFiscal).toBe(210)
  })

  it('excluye reversas y revertidas', () => {
    const { resumen } = calcularResumenPeriodo([
      tx({ id: 'o', monto: 1000, revertida: true }), tx({ monto: -1000, es_reversa: true, reversa_de: 'o' }),
    ])
    expect(resumen.totalFacturado).toBe(0)
    expect(resumen.cantidadVentas).toBe(0)
  })
})

/**
 * Dashboard (calcularTotalesDia) y Admin/Reportes (calcularResumenPeriodo) son
 * dos implementaciones separadas que nadie fuerza a coincidir: cada una filtra
 * reversas/anuladas y calcula comisión por su cuenta. Este test no prueba una
 * corrección puntual — prueba que, sobre el MISMO día, las dos siguen dando el
 * mismo número. Si alguna cambia de fórmula sin que la otra la siga, esto rompe.
 */
describe('calcularTotalesDia vs calcularResumenPeriodo — mismo dataset, mismo día', () => {
  it('cobros, gastos y neto coinciden entre las dos funciones', () => {
    const DIA = '2026-08-25'
    const transacciones = [
      tx({ monto: 1000, medios_pago: efectivo }),
      tx({ monto: 2000, medios_pago: debito }),
      tx({ monto: 3000, medios_pago: credito }),
      tx({ tipo: 'GASTO_REGISTRADO', monto: 800 }),
      // una cancelada y su asiento inverso: ambas funciones deben excluirlas igual
      tx({ id: 'orig', monto: 500, revertida: true }),
      tx({ monto: -500, es_reversa: true, reversa_de: 'orig' }),
    ]

    const { totales } = calcularTotalesDia(transacciones, DIA)
    const { resumen } = calcularResumenPeriodo(transacciones)

    expect(totales.cobros).toBe(resumen.totalFacturado)
    expect(totales.gastos).toBe(resumen.gastosOperativos)
    // netoReal = cobros - comisiones - gastos; resultadoEjercicio = (totalFacturado - comisiones) - gastosOperativos.
    // Misma fórmula, escrita dos veces: tienen que dar lo mismo.
    expect(totales.netoReal).toBe(resumen.resultadoEjercicio)
  })
})
